import { Router, Request, Response, NextFunction } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { parseBody, parseIntStrict, parseOptionalInt } from "../lib/validation";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeReviewComment, serializeReview } from "../lib/serializers";
import { hasMinimumRole, isSuperAdmin } from "../lib/rbac";
import { sendReviewCommentEmail } from "../lib/email";
import multer from "multer";

export const reviewsRouter = Router();

const reviewUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

function parseMaybeMultipartPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as Record<string, unknown>;
  if (typeof body.payload !== "string") return raw;

  try {
    return JSON.parse(body.payload);
  } catch {
    throw badRequest("Invalid review payload");
  }
}

function maybeParseMultipartReview(req: Request, res: Response, next: NextFunction) {
  if (req.is("multipart/form-data")) {
    reviewUpload.array("attachments", 6)(req, res, next);
    return;
  }
  next();
}

function getReviewFiles(req: Request) {
  return Array.isArray(req.files) ? req.files : [];
}

const reviewCreateSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().optional().nullable(),
  objective: z.string().trim().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  review_type: z.string().trim().optional().nullable(),
  website_url: z.string().trim().optional().nullable(),
  github_repo: z.string().trim().optional().nullable(),
  figma_link: z.string().trim().optional().nullable(),
  documentation_link: z.string().trim().optional().nullable(),
  tech_details: z.unknown().optional().nullable(),
  project_id: z.number().int().nullable().optional(),
  reviewer_id: z.number().int().nullable().optional(),
});

const reviewUpdateSchema = reviewCreateSchema.partial().extend({
  status: z.enum(["pending", "approved", "rejected", "needs_changes"]).optional(),
  reviewer_id: z.number().int().nullable().optional(),
});

const commentCreateSchema = z.object({
  content: z.string().trim().min(1),
});

async function getReviewOrThrow(reviewId: number) {
  const review = await prisma.reviewRequest.findUnique({
    where: { id: reviewId },
    include: {
      submitter: true,
      reviewer: true,
    },
  });

  if (!review) {
    throw notFound("Review not found");
  }

  return review;
}

reviewsRouter.get(
  "",
  requireAuth,
  asyncHandler(async (req, res) => {
    const allowedStatuses = ["pending", "approved", "rejected", "needs_changes"] as const;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
      throw badRequest("Invalid review status");
    }
    const projectId = parseOptionalInt(req.query.project_id);
    const skip = Number.isFinite(Number(req.query.skip))
      ? Math.max(0, parseIntStrict(req.query.skip, "skip"))
      : 0;
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.max(0, parseIntStrict(req.query.limit, "limit"))
      : 100;

    if (!req.authUser) {
      throw unauthorized();
    }

    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const cacheKey = `reviews:list:${req.authUser.id}:${qs}`;
    const cached = await cacheGet<unknown[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const whereBase: any = {};
    if (status) {
      whereBase.status = status;
    }
    if (projectId !== undefined && !Number.isNaN(projectId)) {
      whereBase.projectId = projectId;
    }

    const where =
      hasMinimumRole(req.authUser.role, UserRole.manager) || isSuperAdmin(req.authUser.role)
        ? whereBase
        : {
            ...whereBase,
            submitterId: req.authUser.id,
          };

    const reviews = await prisma.reviewRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        submitter: true,
        reviewer: true,
      },
    });

    const result = reviews.map(serializeReview);
    await cacheSet(cacheKey, result, 30);
    res.json(result);
  }),
);

reviewsRouter.post(
  "",
  requireAuth,
  maybeParseMultipartReview,
  asyncHandler(async (req, res) => {
    const body = parseBody(reviewCreateSchema, parseMaybeMultipartPayload(req.body));
    const files = getReviewFiles(req);
    if (!req.authUser) {
      throw unauthorized();
    }

    const data: Prisma.ReviewRequestUncheckedCreateInput = {
      title: body.title,
      summary: body.summary ?? null,
      objective: body.objective ?? null,
      status: "pending",
      priority: body.priority ?? "medium",
      reviewType: body.review_type ?? null,
      websiteUrl: body.website_url ?? null,
      githubRepo: body.github_repo ?? null,
      figmaLink: body.figma_link ?? null,
      documentationLink: body.documentation_link ?? null,
      techDetails:
        body.tech_details === undefined
          ? Prisma.DbNull
          : body.tech_details === null
            ? Prisma.DbNull
            : (body.tech_details as Prisma.InputJsonValue),
      projectId: body.project_id ?? null,
      reviewerId: body.reviewer_id ?? null,
      submitterId: req.authUser.id,
      attachments: files.length > 0 ? {
        create: files.map((file) => ({
          fileName: file.originalname,
          mimeType: file.mimetype || "application/octet-stream",
          sizeBytes: file.size,
          data: Buffer.from(file.buffer) as unknown as Prisma.Bytes,
        }))
      } : undefined,
    };

    const review = await prisma.reviewRequest.create({
      data,
      include: {
        submitter: true,
        reviewer: true,
      },
    });

    await cacheInvalidate("reviews:list:*");
    res.status(201).json(serializeReview(review));
  }),
);

reviewsRouter.get(
  "/:reviewId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reviewId = Number(req.params.reviewId);
    if (!Number.isInteger(reviewId)) {
      throw badRequest("Review id must be a number");
    }
    const review = await getReviewOrThrow(reviewId);
    res.json(serializeReview(review));
  }),
);

reviewsRouter.patch(
  "/:reviewId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reviewId = Number(req.params.reviewId);
    if (!Number.isInteger(reviewId)) {
      throw badRequest("Review id must be a number");
    }
    const body = parseBody(reviewUpdateSchema, req.body);
    if (!req.authUser) {
      throw unauthorized();
    }

    const review = await prisma.reviewRequest.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw notFound("Review not found");
    }

    const isDecision = body.status !== undefined || body.reviewer_id !== undefined;
    const isPrivileged = hasMinimumRole(req.authUser.role, UserRole.manager) || isSuperAdmin(req.authUser.role);

    if (isDecision && !isPrivileged) {
      throw forbidden("Only reviewers can change status");
    }
    if (!isDecision && review.submitterId !== req.authUser.id && !isPrivileged) {
      throw forbidden("Not your review");
    }

    const data: Prisma.ReviewRequestUncheckedUpdateInput = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.summary !== undefined ? { summary: body.summary ?? null } : {}),
      ...(body.objective !== undefined ? { objective: body.objective ?? null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.reviewer_id !== undefined ? { reviewerId: body.reviewer_id ?? null } : {}),
      ...(body.website_url !== undefined ? { websiteUrl: body.website_url ?? null } : {}),
      ...(body.github_repo !== undefined ? { githubRepo: body.github_repo ?? null } : {}),
      ...(body.figma_link !== undefined ? { figmaLink: body.figma_link ?? null } : {}),
      ...(body.documentation_link !== undefined
        ? { documentationLink: body.documentation_link ?? null }
        : {}),
      ...(body.tech_details !== undefined
        ? {
            techDetails:
              body.tech_details === null
                ? Prisma.DbNull
                : (body.tech_details as Prisma.InputJsonValue),
          }
        : {}),
    };

    const updated = await prisma.reviewRequest.update({
      where: { id: reviewId },
      data,
      include: {
        submitter: true,
        reviewer: true,
      },
    });

    await cacheInvalidate("reviews:list:*");
    res.json(serializeReview(updated));
  }),
);

reviewsRouter.get(
  "/:reviewId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reviewId = Number(req.params.reviewId);
    if (!Number.isInteger(reviewId)) {
      throw badRequest("Review id must be a number");
    }
    await getReviewOrThrow(reviewId);
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.max(1, Math.min(200, parseIntStrict(req.query.limit, "limit")))
      : 100;

    const comments = await prisma.reviewComment.findMany({
      where: { reviewRequestId: reviewId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: { author: true },
    });
    res.json(comments.reverse().map(serializeReviewComment));
  }),
);

reviewsRouter.post(
  "/:reviewId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const reviewId = Number(req.params.reviewId);
    if (!Number.isInteger(reviewId)) {
      throw badRequest("Review id must be a number");
    }
    const body = parseBody(commentCreateSchema, req.body);
    if (!req.authUser) {
      throw unauthorized();
    }
    const review = await getReviewOrThrow(reviewId);

    const comment = await prisma.reviewComment.create({
      data: {
        content: body.content,
        reviewRequestId: reviewId,
        authorId: req.authUser.id,
      },
      include: {
        author: true,
      },
    });

    const recipientEmails = new Set<string>();
    if (review.submitter?.email && review.submitter.id !== req.authUser.id) {
      recipientEmails.add(review.submitter.email);
    }
    if (review.reviewer?.email && review.reviewer.id !== req.authUser.id) {
      recipientEmails.add(review.reviewer.email);
    }
    
    sendReviewCommentEmail(
      Array.from(recipientEmails),
      review.title,
      req.authUser.fullName || req.authUser.email,
      body.content
    ).catch(console.error);

    res.status(201).json(serializeReviewComment(comment));
  }),
);

reviewsRouter.get(
  "/:reviewId/attachments/:attachmentId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const reviewId = Number(req.params.reviewId);
    const attachmentId = Number(req.params.attachmentId);

    if (!Number.isInteger(reviewId) || !Number.isInteger(attachmentId)) {
      throw badRequest("Invalid IDs");
    }

    const review = await getReviewOrThrow(reviewId);

    const attachment = await prisma.reviewAttachment.findFirst({
      where: { id: attachmentId, reviewRequestId: reviewId },
    });

    if (!attachment) throw notFound("Attachment not found");

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", attachment.sizeBytes);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    res.send(Buffer.from(attachment.data));
  })
);

reviewsRouter.delete(
  "/:reviewId/attachments/:attachmentId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const reviewId = Number(req.params.reviewId);
    const attachmentId = Number(req.params.attachmentId);

    if (!Number.isInteger(reviewId) || !Number.isInteger(attachmentId)) {
      throw badRequest("Invalid IDs");
    }

    const review = await getReviewOrThrow(reviewId);
    if (review.submitterId !== req.authUser.id && req.authUser.role !== UserRole.super_admin) {
      throw forbidden("Not allowed to delete this attachment");
    }

    const attachment = await prisma.reviewAttachment.findFirst({
      where: { id: attachmentId, reviewRequestId: reviewId },
    });

    if (!attachment) throw notFound("Attachment not found");

    await prisma.reviewAttachment.delete({ where: { id: attachmentId } });
    await cacheInvalidate("reviews:list:*");
    res.status(204).send();
  })
);
