import { Router } from "express";
import { UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth, requireRoles } from "../middleware/auth";
import { unauthorized } from "../lib/http-error";
import { reportAccessWhere, taskAccessWhere } from "../lib/rbac";

export const activityRouter = Router();

type ActivityItem = {
  id: string;
  type:
    | "review_submitted"
    | "review_decision"
    | "review_comment"
    | "report_submitted"
    | "task_created"
    | "task_updated";
  actor: string;
  action: string;
  target: string | null;
  title: string;
  status: string | null;
  link: string;
  timestamp: string;
};

function name(u: { fullName: string | null; email: string } | null | undefined) {
  if (!u) return "Someone";
  return u.fullName || u.email;
}

// A consolidated, read-only feed of recent activity across reviews, reports,
// and tasks. CEOs / super admins see everything; managers see work within
// their projects (via the same access-where helpers the resource routes use).
activityRouter.get(
  "/",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.manager, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();
    const authUser = req.authUser;

    const [reviews, comments, reports, tasks] = await Promise.all([
      prisma.reviewRequest.findMany({
        orderBy: { updatedAt: "desc" },
        take: 25,
        include: {
          submitter: { select: { fullName: true, email: true } },
          reviewers: { select: { fullName: true, email: true } },
        },
      }),
      prisma.reviewComment.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          author: { select: { fullName: true, email: true } },
          reviewRequest: { select: { id: true, title: true } },
        },
      }),
      prisma.dailyProgressReport.findMany({
        where: reportAccessWhere(authUser),
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          submitter: { select: { fullName: true, email: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: taskAccessWhere(authUser),
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: {
          assignee: { select: { fullName: true, email: true } },
          creator: { select: { fullName: true, email: true } },
          project: { select: { name: true } },
        },
      }),
    ]);

    const items: ActivityItem[] = [];

    for (const r of reviews) {
      const reviewerNames = r.reviewers.map((rev) => name(rev)).join(", ");
      const decided = r.status !== "pending" && r.updatedAt && r.createdAt &&
        r.updatedAt.getTime() - r.createdAt.getTime() > 1000;
      items.push({
        id: `review-${r.id}`,
        type: decided ? "review_decision" : "review_submitted",
        actor: name(r.submitter),
        action: decided
          ? `review marked ${r.status.replace("_", " ")}`
          : reviewerNames
            ? `submitted a review to ${reviewerNames}`
            : "submitted a review",
        target: reviewerNames || null,
        title: r.title,
        status: r.status,
        link: `/dashboard/reviews/${r.id}`,
        timestamp: (r.updatedAt ?? r.createdAt ?? new Date()).toISOString(),
      });
    }

    for (const c of comments) {
      if (!c.reviewRequest) continue;
      items.push({
        id: `comment-${c.id}`,
        type: "review_comment",
        actor: name(c.author),
        action: "commented on a review",
        target: c.reviewRequest.title,
        title: c.reviewRequest.title,
        status: null,
        link: `/dashboard/reviews/${c.reviewRequest.id}`,
        timestamp: (c.createdAt ?? new Date()).toISOString(),
      });
    }

    for (const r of reports) {
      items.push({
        id: `report-${r.id}`,
        type: "report_submitted",
        actor: name(r.submitter),
        action: "submitted a daily report",
        target: r.project?.name ?? null,
        title: r.project?.name ? `${r.project.name} report` : "Daily report",
        status: null,
        link: `/dashboard/reports`,
        timestamp: (r.createdAt ?? new Date()).toISOString(),
      });
    }

    for (const t of tasks) {
      const created = t.createdAt && t.updatedAt &&
        t.updatedAt.getTime() - t.createdAt.getTime() < 1000;
      items.push({
        id: `task-${t.id}`,
        type: created ? "task_created" : "task_updated",
        actor: name(t.assignee ?? t.creator),
        action: created
          ? `created task in ${t.project?.name ?? "a project"}`
          : `updated a task (${t.status.replace("_", " ")})`,
        target: t.project?.name ?? null,
        title: t.title,
        status: t.status,
        link: `/dashboard/tasks`,
        timestamp: (t.updatedAt ?? t.createdAt ?? new Date()).toISOString(),
      });
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    res.json(items.slice(0, 40));
  }),
);
