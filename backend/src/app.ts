import cors from "cors";
import express from "express";
import multer from "multer";

import { env } from "./env";
import { HttpError } from "./lib/http-error";
import { isPrismaConnectionError } from "./lib/prisma-errors";
import { statusRouter } from "./routes/status";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { projectsRouter } from "./routes/projects";
import { reviewsRouter } from "./routes/reviews";
import { messagesRouter } from "./routes/messages";
import { tasksRouter } from "./routes/tasks";
import { reportsRouter } from "./routes/reports";
import { sprintsRouter } from "./routes/sprints";
import { dashboardRouter } from "./routes/dashboard";

export const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/", (_req, res) => {
  res.json({ message: "Welcome to Executive Review Hub API" });
});

app.use("/api/v1/status", statusRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/projects", projectsRouter);
app.use("/api/v1/reviews", reviewsRouter);
app.use("/api/v1/messages", messagesRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/sprints", sprintsRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use((_req, res) => {
  res.status(404).json({ detail: "Not found" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ detail: error.message });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ detail: "Invalid JSON body" });
    return;
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ detail: error.message });
    return;
  }

  if (isPrismaConnectionError(error)) {
    // Avoid dumping a stack for transient Neon / pooler connectivity issues.
    console.error(`Prisma connection error: ${error.code}`);
    res.status(503).json({ detail: "Database temporarily unavailable" });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ detail: env.isProduction ? "Internal server error" : "Internal server error" });
});
