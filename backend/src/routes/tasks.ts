import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict, parseOptionalInt } from "../lib/validation";
import { forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeTask } from "../lib/serializers";
import { hasMinimumRole, canManageTask } from "../lib/rbac";

export const tasksRouter = Router();

const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  project_id: z.number().int(),
  assignee_id: z.number().int().optional().nullable(),
});

const taskUpdateSchema = taskCreateSchema.partial();

tasksRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();

    const projectId = parseOptionalInt(req.query.project_id);
    const skip = Number.isFinite(Number(req.query.skip)) ? Math.max(0, parseIntStrict(req.query.skip, "skip")) : 0;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(0, parseIntStrict(req.query.limit, "limit")) : 100;

    let where: any = {};
    if (projectId !== undefined && !Number.isNaN(projectId)) {
      where.projectId = projectId;
    }

    if (!hasMinimumRole(req.authUser.role, UserRole.ceo)) {
      if (req.authUser.role === UserRole.manager) {
        where.project = {
          OR: [
            { ownerId: req.authUser.id },
            { memberships: { some: { userId: req.authUser.id } } }
          ]
        };
      } else {
        where.assigneeId = req.authUser.id;
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { assignee: true, creator: true },
    });

    res.json(tasks.map(serializeTask));
  })
);

tasksRouter.post(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const body = parseBody(taskCreateSchema, req.body);

    const project = await prisma.project.findUnique({ where: { id: body.project_id } });
    if (!project) throw notFound("Project not found");

    if (!canManageTask(req.authUser, project.ownerId)) {
      throw forbidden("Not allowed to create tasks for this project");
    }

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? "todo",
        priority: body.priority ?? "medium",
        projectId: body.project_id,
        assigneeId: body.assignee_id ?? null,
        creatorId: req.authUser.id,
      },
      include: { assignee: true, creator: true },
    });

    res.status(201).json(serializeTask(task));
  })
);

tasksRouter.patch(
  "/:taskId",
  requireAuth,
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

    const isManagerOrAbove = canManageTask(req.authUser, task.project.ownerId);
    
    if (!isManagerOrAbove) {
      if (task.assigneeId !== req.authUser.id) {
        throw forbidden("Not your task");
      }
      if (body.title !== undefined || body.description !== undefined || body.priority !== undefined || body.assignee_id !== undefined || body.project_id !== undefined) {
         throw forbidden("You can only update the status of the task");
      }
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.assignee_id !== undefined ? { assigneeId: body.assignee_id ?? null } : {}),
        ...(body.project_id !== undefined ? { projectId: body.project_id } : {}),
      },
      include: { assignee: true, creator: true },
    });

    res.json(serializeTask(updated));
  })
);

tasksRouter.delete(
  "/:taskId",
  requireAuth,
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
  })
);
