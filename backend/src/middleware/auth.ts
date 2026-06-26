import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { forbidden, unauthorized } from "../lib/http-error";
import { verifyAccessToken } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    throw unauthorized();
  }

  const token = header.slice("bearer ".length).trim();
  if (!token) {
    throw unauthorized();
  }

  let userId: number;
  try {
    userId = verifyAccessToken(token);
  } catch {
    throw unauthorized();
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw unauthorized();
  }

  req.authUser = { id: user.id, role: user.role };
  next();
});

export function requireRoles(...roles: UserRole[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      throw unauthorized();
    }
    if (!roles.includes(req.authUser.role)) {
      throw forbidden();
    }
    next();
  });
}
