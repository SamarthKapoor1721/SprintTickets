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

const onboardSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  full_name: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
});

authRouter.post(
  "/onboard",
  asyncHandler(async (req, res) => {
    const body = parseBody(onboardSchema, req.body);
    const user = await prisma.user.findUnique({ where: { onboardingToken: body.token } });
    if (!user || !user.onboardingToken) {
      throw badRequest("Invalid or expired onboarding token");
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword: hashPassword(body.password),
        fullName: body.full_name ?? user.fullName,
        department: body.department ?? user.department,
        onboardingToken: null,
      },
    });

    res.status(200).json({
      user: serializeUser(updatedUser),
      access_token: createAccessToken(updatedUser.id),
      token_type: "bearer",
    });
  }),
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const raw = req.body?.username ? { email: req.body.username, password: req.body.password } : req.body;
    const body = parseBody(loginSchema, raw);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.hashedPassword || !verifyPassword(body.password, user.hashedPassword)) {
      throw badRequest("Incorrect email or password");
    }

    res.json({
      user: serializeUser(user),
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
    if (!user || !user.hashedPassword || !verifyPassword(body.password, user.hashedPassword)) {
      throw badRequest("Incorrect email or password");
    }

    res.json({
      user: serializeUser(user),
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

authRouter.get(
  "/google",
  asyncHandler(async (req, res) => {
    // Stub for Google OAuth redirect
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw badRequest("Google Auth is not configured");
    }
    const redirectUri = `${req.protocol}://${req.get("host")}/api/v1/auth/google/callback`;
    const scope = "email profile";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
  })
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    // Stub for Google OAuth callback handling
    res.json({ message: "Google Auth Callback Stub. Implement token exchange here." });
  })
);
