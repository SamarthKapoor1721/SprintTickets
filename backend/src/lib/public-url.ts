import type { Request } from "express";

import { env } from "../env";

export function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function resolvePublicAppUrl(req?: Request) {
  const origin = req?.get("origin")?.trim();

  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // Ignore invalid origins and fall back to the configured public URL.
    }
  }

  return normalizeBaseUrl(env.APP_URL);
}
