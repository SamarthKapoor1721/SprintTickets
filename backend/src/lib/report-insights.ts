import type { ReportAttachment, Sprint, Task } from "@prisma/client";

function uniq(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function stripLeadingMarkers(value: string) {
  return value
    .replace(/^(yesterday|today|blockers?)\s*:\s*/i, "")
    .replace(/^\s*[-*•]+\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .trim();
}

export function splitReportPointers(value: string | null | undefined) {
  if (!value) return [];
  return uniq(
    value
      .split(/\r?\n|;/)
      .map(stripLeadingMarkers)
      .filter(Boolean)
      .map((item) => item.replace(/\s+/g, " ").trim()),
  ).slice(0, 8);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function taskSummary(
  task: Pick<Task, "id" | "title" | "status" | "priority" | "issueType" | "dueDate"> & {
    sprint?: Pick<Sprint, "name"> | null;
  },
) {
  const due = task.dueDate ? ` due ${task.dueDate.toLocaleDateString([], { month: "short", day: "numeric" })}` : "";
  const sprint = task.sprint?.name ? ` · ${task.sprint.name}` : "";
  const priority = task.priority !== "medium" ? ` · ${task.priority}` : "";
  return `${task.issueType.toUpperCase()} #${task.id}: ${task.title} · ${task.status}${priority}${sprint}${due}`;
}

function attachmentSummary(attachment: Pick<ReportAttachment, "fileName" | "mimeType" | "sizeBytes">) {
  const kind = attachment.mimeType.startsWith("application/pdf")
    ? "PDF"
    : attachment.mimeType.startsWith("application/")
      ? "Doc"
      : "File";
  return `${kind}: ${attachment.fileName} (${formatBytes(attachment.sizeBytes)})`;
}

export function buildReportInsights(input: {
  content: string;
  yesterday: string | null;
  today: string | null;
  blockers: string | null;
  tasks: (Pick<Task, "id" | "title" | "status" | "priority" | "issueType" | "dueDate"> & {
    sprint?: Pick<Sprint, "name"> | null;
  })[];
  attachments: Pick<ReportAttachment, "fileName" | "mimeType" | "sizeBytes">[];
}) {
  const yesterday = splitReportPointers(input.yesterday);
  const today = splitReportPointers(input.today);
  const blockers = splitReportPointers(input.blockers);
  const content = splitReportPointers(input.content);
  const tasks = uniq(input.tasks.map(taskSummary));
  const attachments = uniq(input.attachments.map(attachmentSummary));

  const executive = uniq([
    ...blockers.map((item) => `Blocker: ${item}`),
    ...today.map((item) => `Today: ${item}`),
    ...yesterday.map((item) => `Done: ${item}`),
    ...tasks.slice(0, 3).map((item) => `Task: ${item}`),
    ...attachments.slice(0, 2).map((item) => `Attachment: ${item}`),
    ...content.slice(0, 2).map((item) => `Note: ${item}`),
  ]).slice(0, 6);

  return {
    yesterday,
    today,
    blockers,
    content,
    tasks,
    attachments,
    executive,
  };
}
