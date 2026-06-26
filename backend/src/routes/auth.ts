import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { createAccessToken } from "../lib/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import { parseBody } from "../lib/validation";
import { badRequest, unauthorized } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeUser } from "../lib/serializers";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  full_name: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  role: z.nativeEnum(UserRole).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw badRequest("Email already registered");
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        hashedPassword: hashPassword(body.password),
        fullName: body.full_name ?? null,
        department: body.department ?? null,
        role: body.role ?? UserRole.employee,
      },
    });

    res.status(201).json(serializeUser(user));
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const raw = req.body?.username ? { email: req.body.username, password: req.body.password } : req.body;
    const body = parseBody(loginSchema, raw);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !verifyPassword(body.password, user.hashedPassword)) {
      throw badRequest("Incorrect email or password");
    }

    res.json({
      access_token: createAccessToken(user.id),
      token_type: "bearer",
    });
  }),
);

authRouter.post(
  "/login/json",
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !verifyPassword(body.password, user.hashedPassword)) {
      throw badRequest("Incorrect email or password");
    }

    res.json({
      access_token: createAccessToken(user.id),
      token_type: "bearer",
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) {
      throw unauthorized();
    }
    const user = await prisma.user.findUnique({ where: { id: req.authUser.id } });
    if (!user) {
      throw unauthorized();
    }
    res.json(serializeUser(user));
  }),
);
