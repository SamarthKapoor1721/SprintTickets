import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, requireRoles } from "../middleware/auth";
import { asyncHandler } from "../lib/async-handler";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { UserRole } from "@prisma/client";
import { forbidden } from "../lib/http-error";

export const summarizeRouter = Router();

summarizeRouter.post(
  "/",
  requireAuth,
  requireRoles(UserRole.ceo, UserRole.manager, UserRole.super_admin),
  asyncHandler(async (req, res) => {
    if (!env.ANTHROPIC_API_KEY) {
      throw forbidden("AI summarization is not configured (missing ANTHROPIC_API_KEY)");
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent data in parallel
    const [reviews, reports, tasks] = await Promise.all([
      prisma.reviewRequest.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        include: {
          submitter: { select: { fullName: true, email: true } },
          reviewers: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.dailyProgressReport.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        include: {
          submitter: { select: { fullName: true, email: true } },
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.task.findMany({
        where: { updatedAt: { gte: sevenDaysAgo } },
        include: {
          assignee: { select: { fullName: true } },
          project: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
    ]);

    // Build context string for Claude
    type ReviewRow = typeof reviews[number];
    type TaskRow = typeof tasks[number];
    const reviewsText = reviews.length === 0
      ? "No reviews in the last 7 days."
      : reviews.map((r: ReviewRow) =>
          `- [${r.status.toUpperCase()}] "${r.title}" (${r.priority} priority) — submitted by ${r.submitter?.fullName ?? r.submitter?.email ?? "unknown"}${r.reviewers && r.reviewers.length > 0 ? `, reviewers: ${r.reviewers.map(rev => rev.fullName || rev.email).join(", ")}` : ""}. Summary: ${r.summary?.slice(0, 200) ?? "none"}`
        ).join("\n");

    type ReportRow = typeof reports[number];
    const reportsText = reports.length === 0
      ? "No reports in the last 7 days."
      : reports.map((r: ReportRow) =>
          `- ${r.submitter?.fullName ?? r.submitter?.email ?? "unknown"} (${r.project?.name ?? "General"}) on ${String(r.date).slice(0, 10)}: Yesterday: ${r.yesterday?.slice(0, 120) ?? "—"} | Today: ${r.today?.slice(0, 120) ?? "—"} | Blockers: ${r.blockers?.trim() ? r.blockers.slice(0, 100) : "none"} | ${r.minutesSpent ?? 0} min`
        ).join("\n");

    const tasksText = tasks.length === 0
      ? "No task activity in the last 7 days."
      : tasks.map((t: TaskRow) =>
          `- [${t.status}] "${t.title}" (${t.priority}) in ${t.project?.name ?? "?"} — assignee: ${t.assignee?.fullName ?? "unassigned"}`
        ).join("\n");

    const prompt = `You are an executive assistant summarizing activity on Sprint Tickets, an internal project management and review platform.

Below is data from the last 7 days. Provide a concise executive summary for the CEO/project managers. Structure it as:

1. **Overall Status** — 2-3 sentences on the health of work across the organisation.
2. **Reviews** — Key highlights: what's pending, approved, rejected, or needs changes. Flag anything urgent.
3. **Daily Reports** — Patterns in team activity. Highlight any blockers or risks across reports.
4. **Task Activity** — Progress across the board. Any blocked or overdue work?
5. **Recommended Actions** — 3-5 specific, actionable things leadership should do or watch.

Keep the tone professional and concise. Use bullet points within sections. Do not make up data.

---

REVIEWS (last 7 days):
${reviewsText}

DAILY REPORTS (last 7 days):
${reportsText}

TASK ACTIVITY (last 7 days):
${tasksText}
`;

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    res.json({ summary: text, generated_at: new Date().toISOString() });
  }),
);
