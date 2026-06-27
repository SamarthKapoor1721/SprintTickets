import { randomUUID } from "crypto";
import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { buildOnboardingUrl, sendOnboardingInvite } from "../lib/invite";
import { unauthorized, badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import { asyncHandler } from "../lib/async-handler";
import { prisma } from "../lib/prisma";
import { canManageUser } from "../lib/rbac";
import { serializeUser, serializeUserDetail } from "../lib/serializers";
import { parseBody, parseIntStrict } from "../lib/validation";
import { requireAuth, requireRoles, requireExactRoles } from "../middleware/auth";

export const usersRouter = Router();

const projectDetailInclude = {
  owner: true,
  memberships: { include: { user: true } },
} as const;

const reviewDetailInclude = {
  submitter: true,
  reviewer: true,
} as const;

const taskDetailInclude = {
  assignee: true,
  creator: true,
} as const;

function normalizeNullableString(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

usersRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    const skip = Number.isFinite(Number(req.query.skip))
      ? Math.max(0, parseIntStrict(req.query.skip, "skip"))
      : 0;
    const limit = Number.isFinite(Number(req.query.limit))
      ? parseIntStrict(req.query.limit, "limit")
      : 100;
    const users = await prisma.user.findMany({
      skip,
      take: limit,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
    res.json(users.map(serializeUser));
  }),
);

usersRouter.get(
  "/:id",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const userId = parseIntStrict(req.params.id, "id");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw notFound("User not found");
    }

    const [
      ownedProjects,
      memberProjects,
      submittedReviews,
      reviewedReviews,
      assignedTasks,
      createdTasks,
      reports,
    ] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: userId },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: projectDetailInclude,
      }),
      prisma.project.findMany({
        where: {
          ownerId: { not: userId },
          memberships: { some: { userId } },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: projectDetailInclude,
      }),
      prisma.reviewRequest.findMany({
        where: { submitterId: userId },
        orderBy: { createdAt: "desc" },
        include: reviewDetailInclude,
      }),
      prisma.reviewRequest.findMany({
        where: { reviewerId: userId },
        orderBy: { createdAt: "desc" },
        include: reviewDetailInclude,
      }),
      prisma.task.findMany({
        where: { assigneeId: userId },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: taskDetailInclude,
      }),
      prisma.task.findMany({
        where: { creatorId: userId },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: taskDetailInclude,
      }),
      prisma.dailyProgressReport.findMany({
        where: { submitterId: userId },
        orderBy: { date: "desc" },
        include: {
          submitter: true,
          project: { include: projectDetailInclude },
          taskLinks: {
            include: {
              task: {
                include: {
                  assignee: true,
                  creator: true,
                  sprint: true,
                },
              },
            },
          },
          attachments: true,
        },
      }),
    ]);

    res.json(
      serializeUserDetail(user, {
        ownedProjects,
        memberProjects,
        submittedReviews,
        reviewedReviews,
        assignedTasks,
        createdTasks,
        reports,
      }),
    );
  }),
);

const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  role: z.enum(["employee", "manager", "ceo"]).optional().default("employee"),
});

const userUpdateSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  full_name: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  role: z.enum(["employee", "manager", "ceo"]).optional(),
  is_active: z.boolean().optional(),
  resend_invite: z.boolean().optional(),
});

usersRouter.post(
  "",
  requireAuth,
  requireRoles(UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const body = parseBody(userCreateSchema, req.body);

    if (!canManageUser(req.authUser.role, body.role as UserRole)) {
      throw forbidden(`You do not have permission to create a user with role ${body.role}`);
    }

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      throw conflict("A user with that email already exists");
    }

    const onboardingToken = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: body.email,
        onboardingToken,
        fullName: normalizeNullableString(body.full_name),
        department: normalizeNullableString(body.department),
        role: body.role as UserRole,
      },
    });

    const onboardingUrl = buildOnboardingUrl(onboardingToken);
    const delivery = await sendOnboardingInvite({
      to: body.email,
      fullName: body.full_name,
      onboardingUrl,
    });

    res.status(201).json({
      ...serializeUser(user),
      onboardingToken,
      onboardingUrl,
      emailSent: delivery.sent,
      emailError: delivery.error,
    });
  }),
);

usersRouter.patch(
  "/:id",
  requireAuth,
  requireRoles(UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const targetId = parseIntStrict(req.params.id, "id");
    const body = parseBody(userUpdateSchema, req.body);

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      throw notFound("User not found");
    }

    const isSelf = req.authUser.id === targetUser.id;
    const nextRole = body.role ?? targetUser.role;

    if (isSelf && (body.role !== undefined || body.is_active !== undefined)) {
      throw forbidden("You cannot change your own role or active status");
    }

    if (!isSelf && !canManageUser(req.authUser.role, nextRole as UserRole)) {
      throw forbidden(`You do not have permission to edit a ${nextRole} user`);
    }

    const nextEmail = body.email ?? undefined;
    if (nextEmail && nextEmail !== targetUser.email) {
      const existing = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (existing && existing.id !== targetUser.id) {
        throw conflict("A user with that email already exists");
      }
    }

    if (body.resend_invite && !targetUser.onboardingToken) {
      throw badRequest("This user has already activated their account");
    }

    const onboardingToken = targetUser.onboardingToken;
    const shouldSendInvite =
      Boolean(onboardingToken) &&
      (body.resend_invite === true || (nextEmail !== undefined && nextEmail !== targetUser.email));
    const onboardingUrl = shouldSendInvite && onboardingToken ? buildOnboardingUrl(onboardingToken) : null;

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(body.full_name !== undefined
          ? { fullName: normalizeNullableString(body.full_name) }
          : {}),
        ...(body.department !== undefined
          ? { department: normalizeNullableString(body.department) }
          : {}),
        ...(body.role !== undefined ? { role: body.role as UserRole } : {}),
        ...(body.is_active !== undefined ? { isActive: body.is_active } : {}),
      },
    });

    let emailSent = false;
    let emailError: string | null = null;

    if (onboardingUrl) {
      const delivery = await sendOnboardingInvite({
        to: updatedUser.email,
        fullName: updatedUser.fullName,
        onboardingUrl,
      });
      emailSent = delivery.sent;
      emailError = delivery.error;
    }

    res.json({
      ...serializeUser(updatedUser),
      onboardingUrl,
      emailSent,
      emailError,
    });
  }),
);

usersRouter.delete(
  "/:id",
  requireAuth,
  requireRoles(UserRole.super_admin, UserRole.ceo),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const targetId = parseIntStrict(req.params.id, "id");

    if (targetId === req.authUser.id) {
      throw forbidden("You cannot delete yourself");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      throw notFound("User not found");
    }

    if (!canManageUser(req.authUser.role, targetUser.role)) {
      throw forbidden("You do not have permission to delete this user");
    }

    await prisma.$transaction([
      prisma.directMessage.deleteMany({
        where: {
          OR: [{ senderId: targetId }, { recipientId: targetId }],
        },
      }),
      prisma.user.delete({ where: { id: targetId } }),
    ]);
    res.status(204).send();
  }),
);
