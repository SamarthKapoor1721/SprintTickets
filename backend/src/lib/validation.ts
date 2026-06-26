import { ZodError, type ZodTypeAny } from "zod";

import { badRequest } from "./http-error";

export function parseBody<T extends ZodTypeAny>(schema: T, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw badRequest(message);
  }
  return parsed.data as ReturnType<T["parse"]>;
}

export function formatError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}

export function parseIntStrict(value: unknown, label: string) {
  const parsed = typeof value === "string" ? Number(value) : Number(value ?? NaN);
  if (!Number.isInteger(parsed)) {
    throw badRequest(`${label} must be a number`);
  }
  return parsed;
}

export function parseOptionalInt(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw badRequest("Query parameter must be a number");
  }
  return parsed;
}
