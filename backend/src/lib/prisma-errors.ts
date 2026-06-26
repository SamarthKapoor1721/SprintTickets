import { Prisma } from "@prisma/client";

const CONNECTION_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P2024"]);

export function isPrismaConnectionError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && CONNECTION_ERROR_CODES.has(error.code);
}
