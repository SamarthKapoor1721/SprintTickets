import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict, parseOptionalInt } from "../lib/validation";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth, requireExactRoles } from "../middleware/auth";
import { serializeTask, serializeTaskComment } from "../lib/serializers";
import { canManageTask, hasMinimumRole, taskAccessWhere } from "../lib/rbac";
import { sendTaskCommentEmail } from "../lib/email";

export const tasksRouter = Router();

const taskStatuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"] as const;
const taskPriorities = ["low", "medium", "high", "critical"] as const;
const taskIssueTypes = ["story", "task", "bug", "epic"] as const;

const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  issue_type: z.enum(taskIssueTypes).optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  project_id: z.number().int(),
  sprint_id: z.number().int().optional().nullable(),
  assignee_id: z.number().int().optional().nullable(),
  due_date: z.string().trim().optional().nullable(),
  estimate_minutes: z.number().int().min(0).optional().nullable(),
  logged_minutes: z.number().int().min(0).optional(),
});

const taskUpdateSchema = taskCreateSchema.partial();

const taskCommentCreateSchema = z.object({
  content: z.string().trim().min(1),
});

const taskInclude = {
  assignee: true,
  creator: true,
  sprint: true,
  project: {
    include: {
      owner: true,
      memberships: { include: { user: true } },
    },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

function nullableDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("Invalid date");
  }
  return date;
}

function andWhere(...parts: Prisma.TaskWhereInput[]) {
  const cleaned = parts.filter((part) => Object.keys(part).length > 0);
  if (cleaned.length === 0) return {};
  if (cleaned.length === 1) return cleaned[0];
  return { AND: cleaned };
}

async function assertAssignable(
  projectId: number,
  assigneeId: number | null | undefined,
  authUser: { id: number; role: UserRole },
) {
  if (assigneeId == null) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      memberships: true,
    },
  });
  if (!project) throw notFound("Project not found");

  const user = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!user) throw notFound("Assignee not found");

  const belongsToTeam =
    project.ownerId === assigneeId ||
    project.memberships.some((member) => member.userId === assigneeId);
  if (!belongsToTeam) {
    if (authUser.role === UserRole.manager && user.role !== UserRole.employee) {
      throw forbidden("Managers can only assign employees outside the team");
    }
    // Auto-add the assignee to the project team when they are allowed to join it.
    await prisma.projectMember.create({
      data: { projectId, userId: assigneeId },
    });
  }
}

async function assertSprintBelongsToProject(projectId: number, sprintId: number | null | undefined) {
  if (sprintId == null) return;

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw notFound("Sprint not found");
  if (sprint.projectId !== projectId) {
    throw badRequest("Sprint does not belong to this project");
  }
}

async function findAccessibleTaskOrThrow(taskId: number, authUser: { id: number; role: UserRole }) {
  const task = await prisma.task.findFirst({
    where: andWhere({ id: taskId }, taskAccessWhere(authUser)),
    include: taskInclude,
  });
  if (!task) throw notFound("Task not found");
  return task;
}

tasksRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();

    const projectId = parseOptionalInt(req.query.project_id);
    const sprintId = parseOptionalInt(req.query.sprint_id);
    const assigneeId = parseOptionalInt(req.query.assignee_id);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const skip = Number.isFinite(Number(req.query.skip)) ? Math.max(0, parseIntStrict(req.query.skip, "skip")) : 0;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(1, parseIntStrict(req.query.limit, "limit")) : 200;

    if (status && !taskStatuses.includes(status as (typeof taskStatuses)[number])) {
      throw badRequest("Invalid task status");
    }
    if (priority && !taskPriorities.includes(priority as (typeof taskPriorities)[number])) {
      throw badRequest("Invalid task priority");
    }

    const filters: Prisma.TaskWhereInput = {
      ...(projectId !== undefined ? { projectId } : {}),
      ...(sprintId !== undefined ? { sprintId } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(status ? { status: status as Prisma.EnumTaskStatusFilter["equals"] } : {}),
      ...(priority ? { priority: priority as Prisma.EnumTaskPriorityFilter["equals"] } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const tasks = await prisma.task.findMany({
      where: andWhere(filters, taskAccessWhere(req.authUser)),
      skip,
      take: limit,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: taskInclude,
    });

    res.json(tasks.map(serializeTask));
  }),
);

tasksRouter.post(
  "",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const body = parseBody(taskCreateSchema, req.body);

    const project = await prisma.project.findUnique({ where: { id: body.project_id } });
    if (!project) throw notFound("Project not found");

    if (!canManageTask(req.authUser, project.ownerId)) {
      throw forbidden("Not allowed to create tasks for this project");
    }

    await assertAssignable(body.project_id, body.assignee_id, req.authUser);
    await assertSprintBelongsToProject(body.project_id, body.sprint_id);
    const dueDate = nullableDate(body.due_date);

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        issueType: body.issue_type ?? "task",
        status: body.status ?? "todo",
        priority: body.priority ?? "medium",
        projectId: body.project_id,
        sprintId: body.sprint_id ?? null,
        assigneeId: body.assignee_id ?? null,
        creatorId: req.authUser.id,
        dueDate,
        estimateMinutes: body.estimate_minutes ?? null,
        loggedMinutes: body.logged_minutes ?? 0,
      },
      include: taskInclude,
    });

    res.status(201).json(serializeTask(task));
  }),
);

tasksRouter.get(
  "/:taskId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) throw notFound("Task not found");

    const task = await findAccessibleTaskOrThrow(taskId, req.authUser);
    res.json(serializeTask(task));
  }),
);

tasksRouter.patch(
  "/:taskId",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) throw notFound("Task not found");

    const body = parseBody(taskUpdateSchema, req.body);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw notFound("Task not found");

    const managerCanEdit = canManageTask(req.authUser, task.project.ownerId);
    const canSelfUpdate =
      task.assigneeId === req.authUser.id ||
      task.creatorId === req.authUser.id ||
      hasMinimumRole(req.authUser.role, UserRole.manager);

    if (!managerCanEdit) {
      if (!canSelfUpdate) {
        throw forbidden("Not your task");
      }
      const managerOnlyFields = [
        body.title,
        body.description,
        body.issue_type,
        body.priority,
        body.project_id,
        body.sprint_id,
        body.assignee_id,
        body.due_date,
        body.estimate_minutes,
      ];
      if (managerOnlyFields.some((value) => value !== undefined)) {
        throw forbidden("You can only update task status and logged time");
      }
    }

    const nextProjectId = body.project_id ?? task.projectId;
    if (body.project_id !== undefined) {
      const nextProject = await prisma.project.findUnique({ where: { id: body.project_id } });
      if (!nextProject) throw notFound("Project not found");
      if (!canManageTask(req.authUser, nextProject.ownerId)) {
        throw forbidden("Not allowed to move tasks into this project");
      }
    }

    await assertAssignable(nextProjectId, body.assignee_id, req.authUser);
    await assertSprintBelongsToProject(nextProjectId, body.sprint_id);
    const dueDate = nullableDate(body.due_date);

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.issue_type !== undefined ? { issueType: body.issue_type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.project_id !== undefined ? { projectId: body.project_id } : {}),
        ...(body.sprint_id !== undefined ? { sprintId: body.sprint_id ?? null } : {}),
        ...(body.assignee_id !== undefined ? { assigneeId: body.assignee_id ?? null } : {}),
        ...(body.due_date !== undefined ? { dueDate } : {}),
        ...(body.estimate_minutes !== undefined ? { estimateMinutes: body.estimate_minutes ?? null } : {}),
        ...(body.logged_minutes !== undefined ? { loggedMinutes: body.logged_minutes } : {}),
      },
      include: taskInclude,
    });

    res.json(serializeTask(updated));
  }),
);

tasksRouter.delete(
  "/:taskId",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) throw notFound("Task not found");

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw notFound("Task not found");

    if (!canManageTask(req.authUser, task.project.ownerId)) {
      throw forbidden("Not allowed to delete this task");
    }

    await prisma.task.delete({ where: { id: taskId } });
    res.status(204).send();
  }),
);

tasksRouter.get(
  "/:taskId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) throw notFound("Task not found");
    await findAccessibleTaskOrThrow(taskId, req.authUser);

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { author: true },
    });

    res.json(comments.map(serializeTaskComment));
  }),
);

tasksRouter.post(
  "/:taskId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) throw notFound("Task not found");
    const body = parseBody(taskCommentCreateSchema, req.body);
    const task = await findAccessibleTaskOrThrow(taskId, req.authUser);

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        authorId: req.authUser.id,
        content: body.content,
      },
      include: { author: true },
    });

    const recipientEmails = new Set<string>();
    if (task.assignee?.email && task.assignee.id !== req.authUser.id) {
      recipientEmails.add(task.assignee.email);
    }
    if (task.creator?.email && task.creator.id !== req.authUser.id) {
      recipientEmails.add(task.creator.email);
    }

    sendTaskCommentEmail(
      Array.from(recipientEmails),
      task.title,
      req.authUser.fullName || req.authUser.email,
      body.content
    ).catch(console.error);

    res.status(201).json(serializeTaskComment(comment));
  }),
);
