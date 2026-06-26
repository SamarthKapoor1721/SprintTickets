import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth, requireRoles } from "../middleware/auth";
import { serializeUser } from "../lib/serializers";
import { parseIntStrict, parseBody } from "../lib/validation";
import { canManageUser } from "../lib/rbac";
import { forbidden, conflict, notFound, unauthorized } from "../lib/http-error";
import { randomUUID } from "crypto";
import { buildOnboardingUrl, sendOnboardingInvite } from "../lib/invite";

export const usersRouter = Router();

usersRouter.get(
  "",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.manager, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    const skip = Number.isFinite(Number(req.query.skip))
      ? Math.max(0, parseIntStrict(req.query.skip, "skip"))
      : 0;
    const limit = Number.isFinite(Number(req.query.limit)) ? parseIntStrict(req.query.limit, "limit") : 100;
    const users = await prisma.user.findMany({
      skip,
      take: limit,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
    res.json(users.map(serializeUser));
  }),
);

const userCreateSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  role: z.enum(["employee", "manager", "ceo"]).optional().default("employee"),
});

usersRouter.post(
  "",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.super_admin),
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
        fullName: body.full_name,
        department: body.department,
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
  })
);

usersRouter.delete(
  "/:id",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.super_admin),
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

    await prisma.user.delete({ where: { id: targetId } });
    res.status(204).send();
  })
);
