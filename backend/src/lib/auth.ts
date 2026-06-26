import jwt from "jsonwebtoken";

import { env } from "../env";
import type { UserRole } from "@prisma/client";

export function createAccessToken(userId: number) {
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "8d",
  });
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
  }) as jwt.JwtPayload;

  const sub = decoded.sub;
  if (!sub) {
    throw new Error("Missing token subject");
  }

  const userId = Number(sub);
  if (!Number.isInteger(userId)) {
    throw new Error("Invalid token subject");
  }

  return userId;
}

export type Role = UserRole;
