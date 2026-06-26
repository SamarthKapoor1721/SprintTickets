import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict, parseOptionalInt } from "../lib/validation";
import { forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeReport } from "../lib/serializers";
import { hasMinimumRole } from "../lib/rbac";

export const reportsRouter = Router();

const reportCreateSchema = z.object({
  content: z.string().trim().min(1),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  project_id: z.number().int().optional().nullable(),
});

reportsRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();

    const projectId = parseOptionalInt(req.query.project_id);
    const skip = Number.isFinite(Number(req.query.skip)) ? Math.max(0, parseIntStrict(req.query.skip, "skip")) : 0;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(0, parseIntStrict(req.query.limit, "limit")) : 100;

    let where: any = {};
    if (projectId !== undefined && !Number.isNaN(projectId)) {
      where.projectId = projectId;
    }

    if (!hasMinimumRole(req.authUser.role, UserRole.ceo)) {
      if (req.authUser.role === UserRole.manager) {
         // managers see reports from their projects or their own reports
         where.OR = [
           { submitterId: req.authUser.id },
           { project: { ownerId: req.authUser.id } },
           { project: { memberships: { some: { userId: req.authUser.id } } } }
         ];
      } else {
         where.submitterId = req.authUser.id;
      }
    }

    const reports = await prisma.dailyProgressReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: "desc" },
      include: { submitter: true, project: true },
    });

    res.json(reports.map(serializeReport));
  })
);

reportsRouter.post(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const body = parseBody(reportCreateSchema, req.body);

    const report = await prisma.dailyProgressReport.create({
      data: {
        content: body.content,
        date: new Date(body.date),
        submitterId: req.authUser.id,
        projectId: body.project_id ?? null,
      },
      include: { submitter: true, project: true },
    });

    res.status(201).json(serializeReport(report));
  })
);
