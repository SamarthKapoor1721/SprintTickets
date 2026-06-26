import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict, parseOptionalInt } from "../lib/validation";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth, requireRoles } from "../middleware/auth";
import { serializeSprint } from "../lib/serializers";
import { canManageProject, projectAccessWhere } from "../lib/rbac";

export const sprintsRouter = Router();

const sprintStatuses = ["planned", "active", "completed"] as const;

const sprintCreateSchema = z.object({
  name: z.string().trim().min(1),
  goal: z.string().trim().optional().nullable(),
  status: z.enum(sprintStatuses).optional(),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  project_id: z.number().int(),
});

const sprintUpdateSchema = sprintCreateSchema.partial();

const sprintInclude = {
  project: {
    include: {
      owner: true,
      memberships: { include: { user: true } },
    },
  },
  _count: { select: { tasks: true } },
} satisfies Prisma.SprintInclude;

function nullableDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("Invalid date");
  }
  return date;
}

function andWhere(...parts: Prisma.SprintWhereInput[]) {
  const cleaned = parts.filter((part) => Object.keys(part).length > 0);
  if (cleaned.length === 0) return {};
  if (cleaned.length === 1) return cleaned[0];
  return { AND: cleaned };
}

async function getProjectForMutation(projectId: number, authUser: { id: number; role: UserRole }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound("Project not found");
  if (!canManageProject(authUser, project.ownerId)) {
    throw forbidden("Not allowed to manage sprints for this project");
  }
  return project;
}

sprintsRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();

    const projectId = parseOptionalInt(req.query.project_id);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !sprintStatuses.includes(status as (typeof sprintStatuses)[number])) {
      throw badRequest("Invalid sprint status");
    }

    const where: Prisma.SprintWhereInput = {
      ...(projectId !== undefined ? { projectId } : {}),
      ...(status ? { status: status as Prisma.EnumSprintStatusFilter["equals"] } : {}),
    };

    const sprints = await prisma.sprint.findMany({
      where: andWhere(where, { project: projectAccessWhere(req.authUser) }),
      orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
      include: sprintInclude,
    });

    res.json(sprints.map(serializeSprint));
  }),
);

sprintsRouter.post(
  "",
  requireAuth,
  requireRoles(UserRole.manager, UserRole.ceo, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const body = parseBody(sprintCreateSchema, req.body);
    await getProjectForMutation(body.project_id, req.authUser);

    const startDate = nullableDate(body.start_date);
    const endDate = nullableDate(body.end_date);

    const sprint = await prisma.sprint.create({
      data: {
        name: body.name,
        goal: body.goal ?? null,
        status: body.status ?? "planned",
        startDate,
        endDate,
        projectId: body.project_id,
      },
      include: sprintInclude,
    });

    res.status(201).json(serializeSprint(sprint));
  }),
);

sprintsRouter.patch(
  "/:sprintId",
  requireAuth,
  requireRoles(UserRole.manager, UserRole.ceo, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const sprintId = Number(req.params.sprintId);
    if (!Number.isInteger(sprintId)) throw notFound("Sprint not found");
    const body = parseBody(sprintUpdateSchema, req.body);

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });
    if (!sprint) throw notFound("Sprint not found");
    if (!canManageProject(req.authUser, sprint.project.ownerId)) {
      throw forbidden("Not allowed to manage this sprint");
    }

    if (body.project_id !== undefined) {
      await getProjectForMutation(body.project_id, req.authUser);
    }

    const startDate = nullableDate(body.start_date);
    const endDate = nullableDate(body.end_date);

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.goal !== undefined ? { goal: body.goal ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.start_date !== undefined ? { startDate } : {}),
        ...(body.end_date !== undefined ? { endDate } : {}),
        ...(body.project_id !== undefined ? { projectId: body.project_id } : {}),
      },
      include: sprintInclude,
    });

    res.json(serializeSprint(updated));
  }),
);

sprintsRouter.delete(
  "/:sprintId",
  requireAuth,
  requireRoles(UserRole.manager, UserRole.ceo, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const sprintId = Number(req.params.sprintId);
    if (!Number.isInteger(sprintId)) throw notFound("Sprint not found");

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });
    if (!sprint) throw notFound("Sprint not found");
    if (!canManageProject(req.authUser, sprint.project.ownerId)) {
      throw forbidden("Not allowed to delete this sprint");
    }

    await prisma.sprint.delete({ where: { id: sprintId } });
    res.status(204).send();
  }),
);
