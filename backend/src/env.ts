import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  PORT: z.coerce.number().int().positive().default(8008),
  APP_URL: z.string().trim().url().default("http://localhost:4321"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:4321,http://localhost:3000,http://localhost:3002"),
  SMTP_URL: z.string().trim().optional(),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().trim().default("no-reply@sprinttickets.local"),
  NODE_ENV: z.string().default("development"),
  REDIS_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => issue.message).join("; ");
  throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === "production",
  REDIS_URL: parsed.data.REDIS_URL ?? null,
  ANTHROPIC_API_KEY: parsed.data.ANTHROPIC_API_KEY ?? null,
};
