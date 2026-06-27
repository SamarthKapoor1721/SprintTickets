import { Router } from "express";
import { UserRole } from "@prisma/client";
import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict } from "../lib/validation";
import { forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth, requireExactRoles } from "../middleware/auth";
import { serializeProject, serializeUser } from "../lib/serializers";
import { canManageProject, hasMinimumRole, isSuperAdmin } from "../lib/rbac";

export const projectsRouter = Router();

const projectCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  // Logo is stored as a small base64 data URL (icon-sized). Cap to ~1.5MB encoded.
  logo: z.string().max(2_000_000).optional().nullable(),
  status: z.enum(["active", "completed", "on_hold"]).optional(),
});

const projectUpdateSchema = projectCreateSchema.partial().extend({
  owner_id: z.number().int().nullable().optional(),
});

const projectMemberAddSchema = z.object({
  user_id: z.number().int(),
});

async function getProjectOrThrow(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      memberships: { include: { user: true } },
    },
  });

  if (!project) {
    throw notFound("Project not found");
  }

  return project;
}



projectsRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    const skip = Number.isFinite(Number(req.query.skip))
      ? Math.max(0, parseIntStrict(req.query.skip, "skip"))
      : 0;
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.max(0, parseIntStrict(req.query.limit, "limit"))
      : 100;
    if (!req.authUser) {
      throw unauthorized();
    }

    const cacheKey = `projects:list:${req.authUser.id}:${req.authUser.role}:${skip}:${limit}`;
    const cached = await cacheGet<unknown[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const where =
      hasMinimumRole(req.authUser.role, UserRole.ceo) || isSuperAdmin(req.authUser.role)
        ? undefined
        : {
            OR: [
              { ownerId: req.authUser.id },
              { memberships: { some: { userId: req.authUser.id } } },
            ],
          };

    const projects = await prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        owner: true,
        memberships: { include: { user: true } },
      },
    });

    const result = projects.map(serializeProject);
    await cacheSet(cacheKey, result, 60);
    res.json(result);
  }),
);

projectsRouter.post(
  "",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    const body = parseBody(projectCreateSchema, req.body);
    if (!req.authUser) {
      throw unauthorized();
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        department: body.department ?? null,
        logo: body.logo ?? null,
        status: body.status ?? "active",
        ownerId: req.authUser.id,
      },
      include: {
        owner: true,
        memberships: { include: { user: true } },
      },
    });

    await cacheInvalidate("projects:list:*");
    res.status(201).json(serializeProject(project));
  }),
);

projectsRouter.get(
  "/:projectId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      throw notFound("Project not found");
    }
    const project = await getProjectOrThrow(projectId);
    res.json(serializeProject(project));
  }),
);

projectsRouter.patch(
  "/:projectId",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      throw notFound("Project not found");
    }
    const body = parseBody(projectUpdateSchema, req.body);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { memberships: true },
    });
    if (!project) {
      throw notFound("Project not found");
    }
    if (!req.authUser || !canManageProject(req.authUser, project.ownerId)) {
      throw forbidden("Not your project");
    }

    const nextOwnerId =
      body.owner_id === undefined
        ? undefined
        : body.owner_id === null
          ? null
          : body.owner_id;
    if (nextOwnerId !== undefined && nextOwnerId !== null) {
      const nextOwner = await prisma.user.findUnique({ where: { id: nextOwnerId } });
      if (!nextOwner) {
        throw notFound("User not found");
      }
      if (
        req.authUser.role === UserRole.manager &&
        nextOwnerId !== project.ownerId &&
        !project.memberships.some((member) => member.userId === nextOwnerId)
      ) {
        throw forbidden("Managers can only transfer the lead to an existing team member");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description ?? null } : {}),
          ...(body.department !== undefined ? { department: body.department ?? null } : {}),
          ...(body.logo !== undefined ? { logo: body.logo ?? null } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(nextOwnerId !== undefined ? { ownerId: nextOwnerId } : {}),
        },
      });

      if (nextOwnerId === null && project.ownerId != null) {
        await tx.projectMember.deleteMany({
          where: { projectId, userId: project.ownerId },
        });
      }

      return tx.project.findUnique({
        where: { id: projectId },
        include: {
          owner: true,
          memberships: { include: { user: true } },
        },
      });
    });

    if (!updated) {
      throw notFound("Project not found");
    }

    await cacheInvalidate("projects:list:*");
    res.json(serializeProject(updated));
  }),
);

projectsRouter.delete(
  "/:projectId",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      throw notFound("Project not found");
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw notFound("Project not found");
    }
    if (!req.authUser || !canManageProject(req.authUser, project.ownerId)) {
      throw forbidden("Only the team lead or admin can delete this project");
    }

    await prisma.$transaction([
      prisma.reviewRequest.updateMany({
        where: { projectId },
        data: { projectId: null },
      }),
      prisma.projectMember.deleteMany({
        where: { projectId },
      }),
      prisma.project.delete({
        where: { id: projectId },
      }),
    ]);

    await cacheInvalidate("projects:list:*");
    res.status(204).send();
  }),
);

projectsRouter.get(
  "/:projectId/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      throw notFound("Project not found");
    }
    await getProjectOrThrow(projectId);
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });
    res.json(members.map((member) => serializeUser(member.user)));
  }),
);

projectsRouter.post(
  "/:projectId/members",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      throw notFound("Project not found");
    }
    const body = parseBody(projectMemberAddSchema, req.body);
    const project = await getProjectOrThrow(projectId);
    if (!req.authUser || !canManageProject(req.authUser, project.ownerId)) {
      throw forbidden("Only the project owner or admin can add members");
    }

    const user = await prisma.user.findUnique({ where: { id: body.user_id } });
    if (!user) {
      throw notFound("User not found");
    }
    if (req.authUser.role === UserRole.manager && user.role !== UserRole.employee) {
      throw forbidden("Managers can only add employees to a team");
    }

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: body.user_id,
        },
      },
      create: {
        projectId,
        userId: body.user_id,
      },
      update: {},
    });

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    await cacheInvalidate("projects:list:*");
    res.status(201).json(members.map((member) => serializeUser(member.user)));
  }),
);

projectsRouter.delete(
  "/:projectId/members/:userId",
  requireAuth,
  requireExactRoles(UserRole.manager, UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.projectId);
    const userId = Number(req.params.userId);
    if (!Number.isInteger(projectId) || !Number.isInteger(userId)) {
      throw notFound("Project not found");
    }
    const project = await getProjectOrThrow(projectId);
    if (!req.authUser || !canManageProject(req.authUser, project.ownerId)) {
      throw forbidden("Only the project owner or admin can remove members");
    }
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw notFound("User not found");
    }
    if (req.authUser.role === UserRole.manager && targetUser.role !== UserRole.employee) {
      throw forbidden("Managers can only remove employees from a team");
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    await cacheInvalidate("projects:list:*");
    res.json(members.map((member) => serializeUser(member.user)));
  }),
);
