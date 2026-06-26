import { Router } from "express";
import { Prisma, User, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { isPrismaConnectionError } from "../lib/prisma-errors";
import { asyncHandler } from "../lib/async-handler";
import { unauthorized } from "../lib/http-error";
import { requireAuth } from "../middleware/auth";
import { serializeReport, serializeSprint, serializeTask } from "../lib/serializers";
import { hasMinimumRole, projectAccessWhere, reportAccessWhere, taskAccessWhere } from "../lib/rbac";

export const dashboardRouter = Router();

const taskStatuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"] as const;

const taskInclude = {
  assignee: true,
  creator: true,
  sprint: true,
  project: {
    include: {
      owner: true,
      memberships: { include: { user: true } },
    },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

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
  attachments: true,
} satisfies Prisma.DailyProgressReportInclude;

const sprintInclude = {
  project: {
    include: {
      owner: true,
      memberships: { include: { user: true } },
    },
  },
  _count: { select: { tasks: true } },
} satisfies Prisma.SprintInclude;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function emptySummary(role: UserRole) {
  return {
    role,
    metrics: {
      projects: 0,
      total_tasks: 0,
      active_sprints: 0,
      overdue_tasks: 0,
      blocked_tasks: 0,
      reports_today: 0,
      missing_reports: 0,
    },
    tasks_by_status: {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      blocked: 0,
      done: 0,
    },
    active_sprints: [],
    overdue_tasks: [],
    blocked_tasks: [],
    recent_tasks: [],
    recent_reports: [],
    missing_reports: [],
  };
}

async function usersExpectedToReport(authUser: { id: number; role: UserRole }) {
  if (hasMinimumRole(authUser.role, UserRole.ceo)) {
    return prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.manager, UserRole.employee] },
      },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
    });
  }

  if (authUser.role === UserRole.manager) {
    const projects = await prisma.project.findMany({
      where: { ownerId: authUser.id },
      include: { memberships: { include: { user: true } }, owner: true },
    });
    const seen = new Map<number, User>();
    for (const project of projects) {
      if (project.owner?.isActive) seen.set(project.owner.id, project.owner);
      for (const membership of project.memberships) {
        if (membership.user.isActive) seen.set(membership.user.id, membership.user);
      }
    }
    return [...seen.values()].sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
  }

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  return user ? [user] : [];
}

dashboardRouter.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.authUser) throw unauthorized();

    try {
      const today = startOfToday();
      const taskScope = taskAccessWhere(req.authUser);
      const projectScope = projectAccessWhere(req.authUser);
      const reportScope = reportAccessWhere(req.authUser);

      const projectsCount = await prisma.project.count({ where: projectScope });
      const activeSprints = await prisma.sprint.findMany({
        where: { status: "active", project: projectScope },
        orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
        include: sprintInclude,
      });
      const overdueTasks = await prisma.task.findMany({
        where: {
          ...taskScope,
          status: { not: "done" },
          dueDate: { lt: today },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        take: 8,
        include: taskInclude,
      });
      const blockedTasks = await prisma.task.findMany({
        where: {
          ...taskScope,
          status: "blocked",
        },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        take: 8,
        include: taskInclude,
      });
      const recentTasks = await prisma.task.findMany({
        where: taskScope,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: taskInclude,
      });
      const recentReports = await prisma.dailyProgressReport.findMany({
        where: reportScope,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: reportInclude,
      });
      const reportsToday = await prisma.dailyProgressReport.findMany({
        where: {
          ...reportScope,
          date: today,
        },
        select: { submitterId: true },
      });
      const expectedUsers = await usersExpectedToReport(req.authUser);
      const taskRows = await prisma.task.findMany({
        where: taskScope,
        select: { status: true },
      });

      const reportersToday = new Set(reportsToday.map((report) => report.submitterId));
      const missingReports = expectedUsers.filter((user) => !reportersToday.has(user.id));
      const taskCounts = taskStatuses.map((status) => ({
        status,
        count: taskRows.filter((row) => row.status === status).length,
      }));
      const totalTasks = taskRows.length;

      res.json({
        role: req.authUser.role,
        metrics: {
          projects: projectsCount,
          total_tasks: totalTasks,
          active_sprints: activeSprints.length,
          overdue_tasks: overdueTasks.length,
          blocked_tasks: blockedTasks.length,
          reports_today: reportsToday.length,
          missing_reports: missingReports.length,
        },
        tasks_by_status: Object.fromEntries(taskCounts.map((item) => [item.status, item.count])),
        active_sprints: activeSprints.map(serializeSprint),
        overdue_tasks: overdueTasks.map(serializeTask),
        blocked_tasks: blockedTasks.map(serializeTask),
        recent_tasks: recentTasks.map(serializeTask),
        recent_reports: recentReports.map(serializeReport),
        missing_reports: missingReports.map((user) => ({
          id: user.id,
          employee_id: user.id,
          email: user.email,
          full_name: user.fullName,
          department: user.department,
          role: user.role,
          is_active: user.isActive,
        })),
      });
    } catch (error) {
      if (isPrismaConnectionError(error)) {
        res.json(emptySummary(req.authUser.role));
        return;
      }
      throw error;
    }
  }),
);
