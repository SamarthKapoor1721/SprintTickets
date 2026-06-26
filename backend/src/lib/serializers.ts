import type {
  Comment,
  Message,
  Project,
  ProjectMember,
  ReviewRequest,
  User,
  Task,
  DailyProgressReport,
} from "@prisma/client";

type UserWithRelations = User;

export function serializeUser(user: UserWithRelations) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    department: user.department,
    role: user.role,
    is_active: user.isActive,
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
    reviewer?: User | null;
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
    reviewer_id: review.reviewerId,
    submitter: review.submitter ? serializeUser(review.submitter) : null,
    reviewer: review.reviewer ? serializeUser(review.reviewer) : null,
    created_at: review.createdAt,
    updated_at: review.updatedAt,
  };
}

export function serializeComment(
  comment: Comment & {
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

export function serializeMessage(message: Message) {
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
  lastMessage: Message | null;
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
  },
) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    project_id: task.projectId,
    assignee_id: task.assigneeId,
    creator_id: task.creatorId,
    assignee: task.assignee ? serializeUser(task.assignee) : null,
    creator: task.creator ? serializeUser(task.creator) : null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export function serializeReport(
  report: DailyProgressReport & {
    submitter?: User | null;
    project?: Project | null;
  },
) {
  return {
    id: report.id,
    content: report.content,
    date: report.date,
    submitter_id: report.submitterId,
    project_id: report.projectId,
    submitter: report.submitter ? serializeUser(report.submitter) : null,
    project: report.project ? serializeProject(report.project) : null,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  };
}
