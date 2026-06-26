import { Router } from "express";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth, requireRoles } from "../middleware/auth";
import { serializeUser } from "../lib/serializers";
import { UserRole } from "@prisma/client";
import { parseIntStrict } from "../lib/validation";

export const usersRouter = Router();

usersRouter.get(
  "",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.manager),
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
