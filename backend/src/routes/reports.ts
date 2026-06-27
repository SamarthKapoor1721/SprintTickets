import { type NextFunction, type Request, type Response, Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import multer from "multer";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict, parseOptionalInt } from "../lib/validation";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth, requireExactRoles } from "../middleware/auth";
import { serializeReport } from "../lib/serializers";
import { canManageProject, projectAccessWhere, reportAccessWhere, taskAccessWhere } from "../lib/rbac";
import { sendReportNotificationEmail } from "../lib/email";

export const reportsRouter = Router();

const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6,
  },
});

const reportCreateSchema = z.object({
  content: z.string().trim().optional().nullable(),
  yesterday: z.string().trim().optional().nullable(),
  today: z.string().trim().optional().nullable(),
  blockers: z.string().trim().optional().nullable(),
  minutes_spent: z.number().int().min(0).optional().nullable(),
  date: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  project_id: z.number().int().optional().nullable(),
  task_ids: z.array(z.number().int()).optional(),
});

const reportUpdateSchema = reportCreateSchema.partial();

const reportInclude = {
  submitter: true,
  project: {
    include: {
      owner: true,
      memberships: { include: { user: true } },
    },
  },
  taskLinks: {
    include: {
      task: {
        include: {
          assignee: true,
          creator: true,
          sprint: true,
        },
      },
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.DailyProgressReportInclude;

function andWhere(...parts: Prisma.DailyProgressReportWhereInput[]) {
  const cleaned = parts.filter((part) => Object.keys(part).length > 0);
  if (cleaned.length === 0) return {};
  if (cleaned.length === 1) return cleaned[0];
  return { AND: cleaned };
}

function buildContent(body: {
  content?: string | null;
  yesterday?: string | null;
  today?: string | null;
  blockers?: string | null;
}) {
  if (body.content?.trim()) return body.content.trim();

  const sections = [
    body.yesterday?.trim() ? `Yesterday:\n${body.yesterday.trim()}` : "",
    body.today?.trim() ? `Today:\n${body.today.trim()}` : "",
    body.blockers?.trim() ? `Blockers:\n${body.blockers.trim()}` : "",
  ].filter(Boolean);

  if (sections.length === 0) {
    throw badRequest("Daily update must include at least one progress field");
  }

  return sections.join("\n\n");
}

function parseReportDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("Invalid date format");
  }
  return date;
}

function parseMaybeMultipartPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as Record<string, unknown>;
  if (typeof body.payload !== "string") return raw;

  try {
    return JSON.parse(body.payload);
  } catch {
    throw badRequest("Invalid report payload");
  }
}

function maybeParseMultipartReport(req: Request, res: Response, next: NextFunction) {
  if (req.is("multipart/form-data")) {
    reportUpload.array("attachments", 6)(req, res, next);
    return;
  }
  next();
}

function getReportFiles(req: Request) {
  return Array.isArray(req.files) ? req.files : [];
}

async function assertProjectVisible(projectId: number | null | undefined, authUser: { id: number; role: UserRole }) {
  if (projectId == null) return;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...projectAccessWhere(authUser),
    },
  });
  if (!project) {
    throw forbidden("Not allowed to report on this project");
  }
}

async function assertTasksVisible(taskIds: number[] | undefined, authUser: { id: number; role: UserRole }) {
  if (!taskIds || taskIds.length === 0) return [];

  const uniqueTaskIds = [...new Set(taskIds)];
  const tasks = await prisma.task.findMany({
    where: {
      id: { in: uniqueTaskIds },
      ...taskAccessWhere(authUser),
    },
  });

  if (tasks.length !== uniqueTaskIds.length) {
    throw forbidden("One or more linked tasks are not accessible");
  }

  return uniqueTaskIds;
}

function canMutateReport(
  authUser: { id: number; role: UserRole },
  report: { submitterId: number; project?: { ownerId: number | null } | null },
) {
  if (authUser.role === UserRole.super_admin) return true;
  if (report.submitterId === authUser.id) return true;
  if (authUser.role === UserRole.manager && report.project) {
    return canManageProject(authUser, report.project.ownerId);
  }
  return false;
}

reportsRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();

    const projectId = parseOptionalInt(req.query.project_id);
    const submitterId = parseOptionalInt(req.query.submitter_id);
    const dateFrom = typeof req.query.date_from === "string" ? req.query.date_from : undefined;
    const dateTo = typeof req.query.date_to === "string" ? req.query.date_to : undefined;
    const skip = Number.isFinite(Number(req.query.skip)) ? Math.max(0, parseIntStrict(req.query.skip, "skip")) : 0;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.max(1, parseIntStrict(req.query.limit, "limit")) : 100;

    const where: Prisma.DailyProgressReportWhereInput = {
      ...(projectId !== undefined ? { projectId } : {}),
      ...(submitterId !== undefined ? { submitterId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: parseReportDate(dateFrom) } : {}),
              ...(dateTo ? { lte: parseReportDate(dateTo) } : {}),
            },
          }
        : {}),
    };

    const reports = await prisma.dailyProgressReport.findMany({
      where: andWhere(where, reportAccessWhere(req.authUser)),
      skip,
      take: limit,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: reportInclude,
    });

    res.json(reports.map(serializeReport));
  }),
);

reportsRouter.post(
  "",
  requireAuth,
  requireExactRoles(UserRole.employee, UserRole.manager),
  maybeParseMultipartReport,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const body = parseBody(reportCreateSchema, parseMaybeMultipartPayload(req.body));
    const files = getReportFiles(req);

    await assertProjectVisible(body.project_id, req.authUser);
    const taskIds = await assertTasksVisible(body.task_ids, req.authUser);
    const content = buildContent(body);

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyProgressReport.create({
        data: {
          content,
          yesterday: body.yesterday ?? null,
          today: body.today ?? null,
          blockers: body.blockers ?? null,
          minutesSpent: body.minutes_spent ?? null,
          date: parseReportDate(body.date),
          submitterId: req.authUser!.id,
          projectId: body.project_id ?? null,
        },
      });

      if (taskIds.length > 0) {
        await tx.dailyProgressReportTask.createMany({
          data: taskIds.map((taskId) => ({ reportId: created.id, taskId })),
          skipDuplicates: true,
        });
      }

      if (files.length > 0) {
        await tx.reportAttachment.createMany({
          data: files.map((file) => ({
            reportId: created.id,
            fileName: file.originalname,
            mimeType: file.mimetype || "application/octet-stream",
            sizeBytes: file.size,
            data: Buffer.from(file.buffer) as unknown as Prisma.Bytes,
          })),
        });
      }

      return tx.dailyProgressReport.findUnique({
        where: { id: created.id },
        include: reportInclude,
      });
    });

    if (!report) throw notFound("Report not found");

    const ceos = await prisma.user.findMany({ where: { role: UserRole.ceo } });
    const recipientEmails = new Set(ceos.map(u => u.email));
    
    if (report.project?.owner) {
      recipientEmails.add(report.project.owner.email);
    }
    
    if (recipientEmails.size > 0) {
      sendReportNotificationEmail(
        Array.from(recipientEmails),
        report.submitter.fullName || report.submitter.email,
        report.project?.name,
        report.date
      ).catch(console.error);
    }

    res.status(201).json(serializeReport(report));
  }),
);

reportsRouter.patch(
  "/:reportId",
  requireAuth,
  maybeParseMultipartReport,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const reportId = Number(req.params.reportId);
    if (!Number.isInteger(reportId)) throw notFound("Report not found");
    const body = parseBody(reportUpdateSchema, parseMaybeMultipartPayload(req.body));
    const files = getReportFiles(req);

    const existing = await prisma.dailyProgressReport.findUnique({
      where: { id: reportId },
      include: { project: true },
    });
    if (!existing) throw notFound("Report not found");
    if (!canMutateReport(req.authUser, existing)) {
      throw forbidden("Not allowed to edit this report");
    }

    await assertProjectVisible(body.project_id, req.authUser);
    const taskIds = body.task_ids !== undefined ? await assertTasksVisible(body.task_ids, req.authUser) : undefined;
    const content =
      body.content !== undefined ||
      body.yesterday !== undefined ||
      body.today !== undefined ||
      body.blockers !== undefined
        ? buildContent({
            content: body.content ?? existing.content,
            yesterday: body.yesterday ?? existing.yesterday,
            today: body.today ?? existing.today,
            blockers: body.blockers ?? existing.blockers,
          })
        : undefined;

    const report = await prisma.$transaction(async (tx) => {
      await tx.dailyProgressReport.update({
        where: { id: reportId },
        data: {
          ...(content !== undefined ? { content } : {}),
          ...(body.yesterday !== undefined ? { yesterday: body.yesterday ?? null } : {}),
          ...(body.today !== undefined ? { today: body.today ?? null } : {}),
          ...(body.blockers !== undefined ? { blockers: body.blockers ?? null } : {}),
          ...(body.minutes_spent !== undefined ? { minutesSpent: body.minutes_spent ?? null } : {}),
          ...(body.date !== undefined ? { date: parseReportDate(body.date) } : {}),
          ...(body.project_id !== undefined ? { projectId: body.project_id ?? null } : {}),
        },
      });

      if (taskIds !== undefined) {
        await tx.dailyProgressReportTask.deleteMany({ where: { reportId } });
        if (taskIds.length > 0) {
          await tx.dailyProgressReportTask.createMany({
            data: taskIds.map((taskId) => ({ reportId, taskId })),
            skipDuplicates: true,
          });
        }
      }

      if (files.length > 0) {
        await tx.reportAttachment.createMany({
          data: files.map((file) => ({
            reportId,
            fileName: file.originalname,
            mimeType: file.mimetype || "application/octet-stream",
            sizeBytes: file.size,
            data: Buffer.from(file.buffer) as unknown as Prisma.Bytes,
          })),
        });
      }

      return tx.dailyProgressReport.findUnique({
        where: { id: reportId },
        include: reportInclude,
      });
    });

    if (!report) throw notFound("Report not found");
    res.json(serializeReport(report));
  }),
);

reportsRouter.delete(
  "/:reportId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const reportId = Number(req.params.reportId);
    if (!Number.isInteger(reportId)) throw notFound("Report not found");

    const report = await prisma.dailyProgressReport.findUnique({
      where: { id: reportId },
      include: { project: true },
    });
    if (!report) throw notFound("Report not found");
    if (!canMutateReport(req.authUser, report)) {
      throw forbidden("Not allowed to delete this report");
    }

    await prisma.dailyProgressReport.delete({ where: { id: reportId } });
    res.status(204).send();
  }),
);

reportsRouter.get(
  "/:reportId/attachments/:attachmentId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const reportId = Number(req.params.reportId);
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(reportId) || !Number.isInteger(attachmentId)) {
      throw notFound("Attachment not found");
    }

    const report = await prisma.dailyProgressReport.findFirst({
      where: andWhere({ id: reportId }, reportAccessWhere(req.authUser)),
      select: { id: true },
    });
    if (!report) throw notFound("Report not found");

    const attachment = await prisma.reportAttachment.findFirst({
      where: { id: attachmentId, reportId },
    });
    if (!attachment) throw notFound("Attachment not found");

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", attachment.sizeBytes);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    res.send(Buffer.from(attachment.data));
  }),
);

reportsRouter.delete(
  "/:reportId/attachments/:attachmentId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const reportId = Number(req.params.reportId);
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(reportId) || !Number.isInteger(attachmentId)) {
      throw notFound("Attachment not found");
    }

    const report = await prisma.dailyProgressReport.findUnique({
      where: { id: reportId },
      include: { project: true },
    });
    if (!report) throw notFound("Report not found");
    if (!canMutateReport(req.authUser, report)) {
      throw forbidden("Not allowed to delete this attachment");
    }

    const attachment = await prisma.reportAttachment.findFirst({
      where: { id: attachmentId, reportId },
    });
    if (!attachment) throw notFound("Attachment not found");

    await prisma.reportAttachment.delete({ where: { id: attachmentId } });
    res.status(204).send();
  }),
);
