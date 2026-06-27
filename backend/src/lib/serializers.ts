import type {
  ReviewComment,
  DirectMessage,
  Project,
  ProjectMember,
  ReviewRequest,
  User,
  Task,
  Sprint,
  TaskComment,
  DailyProgressReport,
  DailyProgressReportTask,
  ReportAttachment,
} from "@prisma/client";

import { buildReportInsights } from "./report-insights";

type UserWithRelations = User;

export function serializeUser(user: UserWithRelations) {
  return {
    id: user.id,
    employee_id: user.id,
    email: user.email,
    full_name: user.fullName,
    department: user.department,
    role: user.role,
    is_active: user.isActive,
  };
}

export function serializeUserDetail(
  user: UserWithRelations,
  relations: {
    ownedProjects?: (Project & {
      owner?: User | null;
      memberships?: (ProjectMember & { user: User })[];
    })[];
    memberProjects?: (Project & {
      owner?: User | null;
      memberships?: (ProjectMember & { user: User })[];
    })[];
    submittedReviews?: (ReviewRequest & {
      submitter?: User | null;
      reviewers?: User[];
    })[];
    reviewedReviews?: (ReviewRequest & {
      submitter?: User | null;
      reviewers?: User[];
    })[];
    assignedTasks?: (Task & {
      assignee?: User | null;
      creator?: User | null;
    })[];
    createdTasks?: (Task & {
      assignee?: User | null;
      creator?: User | null;
    })[];
    reports?: (DailyProgressReport & {
      submitter?: User | null;
      project?: Project | null;
    })[];
  },
) {
  const ownedProjects = (relations.ownedProjects ?? []).map(serializeProject);
  const memberProjects = (relations.memberProjects ?? []).map(serializeProject);
  const submittedReviews = (relations.submittedReviews ?? []).map(serializeReview);
  const reviewedReviews = (relations.reviewedReviews ?? []).map(serializeReview);
  const assignedTasks = (relations.assignedTasks ?? []).map(serializeTask);
  const createdTasks = (relations.createdTasks ?? []).map(serializeTask);
  const reports = (relations.reports ?? []).map(serializeReport);

  return {
    ...serializeUser(user),
    onboarding_pending: Boolean(user.onboardingToken) || !user.hashedPassword,
    counts: {
      owned_projects: ownedProjects.length,
      member_projects: memberProjects.length,
      submitted_reviews: submittedReviews.length,
      reviewed_reviews: reviewedReviews.length,
      assigned_tasks: assignedTasks.length,
      created_tasks: createdTasks.length,
      reports: reports.length,
    },
    owned_projects: ownedProjects,
    member_projects: memberProjects,
    submitted_reviews: submittedReviews,
    reviewed_reviews: reviewedReviews,
    assigned_tasks: assignedTasks,
    created_tasks: createdTasks,
    reports,
  };
}

export function serializeProject(
  project: Project & {
    owner?: User | null;
    memberships?: (ProjectMember & { user: User })[];
  },
) {
  const members = (project.memberships ?? []).map((member) => serializeUser(member.user));

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    department: project.department,
    status: project.status,
    owner_id: project.ownerId,
    owner: project.owner ? serializeUser(project.owner) : null,
    members,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

export function serializeReview(
  review: ReviewRequest & {
    submitter?: User | null;
    reviewers?: User[];
    attachments?: ReviewAttachment[];
  },
) {
  return {
    id: review.id,
    title: review.title,
    summary: review.summary,
    objective: review.objective,
    status: review.status,
    priority: review.priority,
    review_type: review.reviewType,
    website_url: review.websiteUrl,
    github_repo: review.githubRepo,
    figma_link: review.figmaLink,
    documentation_link: review.documentationLink,
    tech_details: review.techDetails,
    project_id: review.projectId,
    submitter_id: review.submitterId,
    submitter: review.submitter ? serializeUser(review.submitter) : null,
    reviewers: review.reviewers ? review.reviewers.map(serializeUser) : [],
    attachments: (review.attachments ?? []).map(a => ({
      id: a.id,
      file_name: a.fileName,
      mime_type: a.mimeType,
      size_bytes: a.sizeBytes,
    })),
    created_at: review.createdAt,
    updated_at: review.updatedAt,
  };
}

export function serializeReviewAttachment(attachment: ReviewAttachment) {
  return {
    id: attachment.id,
    review_request_id: attachment.reviewRequestId,
    file_name: attachment.fileName,
    mime_type: attachment.mimeType,
    size_bytes: attachment.sizeBytes,
    created_at: attachment.createdAt,
  };
}

export function serializeReviewComment(
  comment: ReviewComment & {
    author?: User | null;
  },
) {
  return {
    id: comment.id,
    content: comment.content,
    review_request_id: comment.reviewRequestId,
    author_id: comment.authorId,
    author: comment.author ? serializeUser(comment.author) : null,
    created_at: comment.createdAt,
  };
}

export function serializeSprint(
  sprint: Sprint & {
    project?: (Project & {
      owner?: User | null;
      memberships?: (ProjectMember & { user: User })[];
    }) | null;
    _count?: { tasks?: number };
  },
) {
  return {
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    start_date: sprint.startDate,
    end_date: sprint.endDate,
    project_id: sprint.projectId,
    project: sprint.project ? serializeProject(sprint.project) : null,
    task_count: sprint._count?.tasks ?? 0,
    created_at: sprint.createdAt,
    updated_at: sprint.updatedAt,
  };
}

export function serializeDirectMessage(message: DirectMessage) {
  return {
    id: message.id,
    content: message.content,
    sender_id: message.senderId,
    recipient_id: message.recipientId,
    is_read: message.isRead,
    created_at: message.createdAt,
  };
}

export function serializeContact(input: {
  user: User;
  lastMessage: DirectMessage | null;
  unread: number;
}) {
  return {
    user: serializeUser(input.user),
    last_message: input.lastMessage?.content ?? null,
    last_at: input.lastMessage?.createdAt ?? null,
    unread: input.unread,
  };
}

export function serializeTask(
  task: Task & {
    assignee?: User | null;
    creator?: User | null;
    project?: (Project & {
      owner?: User | null;
      memberships?: (ProjectMember & { user: User })[];
    }) | null;
    sprint?: Sprint | null;
    _count?: { comments?: number };
  },
) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    issue_type: task.issueType,
    status: task.status,
    priority: task.priority,
    project_id: task.projectId,
    project: task.project ? serializeProject(task.project) : null,
    sprint_id: task.sprintId,
    sprint: task.sprint ? serializeSprint(task.sprint) : null,
    assignee_id: task.assigneeId,
    creator_id: task.creatorId,
    assignee: task.assignee ? serializeUser(task.assignee) : null,
    creator: task.creator ? serializeUser(task.creator) : null,
    due_date: task.dueDate,
    estimate_minutes: task.estimateMinutes,
    logged_minutes: task.loggedMinutes,
    comments_count: task._count?.comments ?? 0,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export function serializeTaskComment(
  comment: TaskComment & {
    author?: User | null;
  },
) {
  return {
    id: comment.id,
    content: comment.content,
    task_id: comment.taskId,
    author_id: comment.authorId,
    author: comment.author ? serializeUser(comment.author) : null,
    created_at: comment.createdAt,
  };
}

export function serializeReport(
  report: DailyProgressReport & {
    submitter?: User | null;
    project?: (Project & {
      owner?: User | null;
      memberships?: (ProjectMember & { user: User })[];
    }) | null;
    taskLinks?: (DailyProgressReportTask & {
      task: Task & {
        assignee?: User | null;
        creator?: User | null;
        sprint?: Sprint | null;
      };
    })[];
    attachments?: ReportAttachment[];
  },
) {
  const attachments = (report.attachments ?? []).map((attachment) => ({
    id: attachment.id,
    file_name: attachment.fileName,
    mime_type: attachment.mimeType,
    size_bytes: attachment.sizeBytes,
    download_url: `/api/v1/reports/${report.id}/attachments/${attachment.id}`,
    created_at: attachment.createdAt,
  }));

  const pointers = buildReportInsights({
    content: report.content,
    yesterday: report.yesterday,
    today: report.today,
    blockers: report.blockers,
    tasks: (report.taskLinks ?? []).map((link) => link.task),
    attachments: report.attachments ?? [],
  });

  return {
    id: report.id,
    content: report.content,
    yesterday: report.yesterday,
    today: report.today,
    blockers: report.blockers,
    minutes_spent: report.minutesSpent,
    date: report.date,
    submitter_id: report.submitterId,
    project_id: report.projectId,
    submitter: report.submitter ? serializeUser(report.submitter) : null,
    project: report.project ? serializeProject(report.project) : null,
    tasks: (report.taskLinks ?? []).map((link) => serializeTask(link.task)),
    attachments,
    pointers,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  };
}
