"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  FolderKanban,
  Hash,
  Mail,
  Power,
  RefreshCcw,
  Shield,
  Trash2,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  deleteUser,
  getUser,
  updateUser,
  type Project,
  type Review,
  type Role,
  type Task,
  type User,
  type UserDetail,
  type UserUpdateResult,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const roleStyles: Record<Role, string> = {
  super_admin: "bg-slate-900 text-white",
  ceo: "bg-blue-100 text-blue-700",
  manager: "bg-violet-100 text-violet-700",
  employee: "bg-slate-100 text-slate-600",
}

const statusStyles = {
  active: "bg-emerald-100 text-emerald-700",
  disabled: "bg-slate-100 text-slate-500",
  pending: "bg-amber-100 text-amber-700",
}

const priorityStyles = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-600",
}

const taskStatusStyles = {
  backlog: "bg-slate-100 text-slate-600",
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-indigo-100 text-indigo-700",
  blocked: "bg-red-100 text-red-700",
  done: "bg-emerald-100 text-emerald-700",
}

const reviewStatusStyles = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  needs_changes: "bg-orange-100 text-orange-700",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function timeAgo(value: string | null | undefined) {
  if (!value) return ""
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function normalizeNullable(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = Number(params.id)
  const startEdit = searchParams.get("edit") === "1"

  const { user: me } = useAuth()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    kind: "success" | "warning"
    title: string
    description: string
    link?: string | null
  } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getUser(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load user"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const timer = setTimeout(() => {
      load()
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const canEditTarget = Boolean(
    me &&
      detail &&
      (me.role === "super_admin" ||
        me.id === detail.id ||
        (me.role === "ceo" && detail.role !== "super_admin")),
  )

  const canDeleteTarget = Boolean(
    me &&
      detail &&
      me.id !== detail.id &&
      (me.role === "super_admin" || (me.role === "ceo" && detail.role !== "super_admin")),
  )

  const handleDelete = async () => {
    if (!detail) return
    if (!confirm(`Delete ${detail.full_name ?? detail.email}? This cannot be undone.`)) return
    try {
      await deleteUser(detail.id)
      router.push("/dashboard/users")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user")
    }
  }

  const handleResendInvite = async () => {
    if (!detail) return
    try {
      const updated = await updateUser(detail.id, { resend_invite: true })
      applyMutation(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend invite")
    }
  }

  const applyMutation = (updated: UserUpdateResult) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            ...updated,
          }
        : current,
    )

    if (updated.onboardingUrl) {
      setNotice({
        kind: updated.emailSent ? "success" : "warning",
        title: updated.emailSent ? "Invitation sent" : "Invitation link ready",
        description: updated.emailSent
          ? "The onboarding email was sent successfully."
          : updated.emailError ??
            "Email delivery is not configured, but the onboarding link is available below.",
        link: updated.onboardingUrl,
      })
    } else {
      setNotice(null)
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading user...</div>
  }

  if (error && !detail) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!detail) return null

  const ownedProjects = detail.owned_projects
  const memberProjects = detail.member_projects
  const submittedReviews = detail.submitted_reviews
  const reviewedReviews = detail.reviewed_reviews
  const assignedTasks = detail.assigned_tasks
  const createdTasks = detail.created_tasks
  const reports = detail.reports

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-6xl flex-col gap-6"
    >
      <button
        onClick={() => router.back()}
        className="flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </button>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`border-none capitalize ${roleStyles[detail.role] ?? ""}`}>
                {detail.role.replace("_", " ")}
              </Badge>
              <Badge
                className={`border-none capitalize ${
                  detail.is_active ? statusStyles.active : statusStyles.disabled
                }`}
              >
                {detail.is_active ? "active" : "disabled"}
              </Badge>
              <Badge className="border-none bg-slate-100 text-slate-600">
                Employee #{detail.employee_id}
              </Badge>
              {detail.onboarding_pending && (
                <Badge className={`border-none capitalize ${statusStyles.pending}`}>
                  onboarding pending
                </Badge>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">
                User profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {detail.full_name ?? detail.email}
              </h1>
              <p className="mt-2 max-w-3xl text-slate-500">
                {detail.department ?? "No department"} and direct access summary for the workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEditTarget && (
              <EditUserDialog
                viewer={me}
                target={detail}
                onSaved={applyMutation}
                startOpen={startEdit}
              />
            )}
            {detail.onboarding_pending && canEditTarget && (
              <Button
                variant="outline"
                onClick={handleResendInvite}
                className="gap-2 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCcw className="h-4 w-4" />
                Resend invite
              </Button>
            )}
            {canDeleteTarget && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="gap-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Owned teams" value={detail.counts.owned_projects} icon={FolderKanban} />
          <MetricCard label="Team memberships" value={detail.counts.member_projects} icon={Users} />
          <MetricCard label="Reviews" value={detail.counts.submitted_reviews} icon={BadgeCheck} />
          <MetricCard label="Reports" value={detail.counts.reports} icon={FileText} />
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{notice.title}</p>
              <p className={notice.kind === "success" ? "text-emerald-700" : "text-amber-700"}>
                {notice.description}
              </p>
            </div>
            <div className="flex gap-2">
              {notice.link && (
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(notice.link ?? "")}
                  className="cursor-pointer border-white/70 bg-white text-slate-700 hover:bg-white"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setNotice(null)}
                className="cursor-pointer text-slate-500 hover:bg-white/70"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tabs defaultValue="overview" className="flex flex-col gap-5">
        <TabsList variant="line" className="gap-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
            <Card className="glass border-none">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-900">Account</CardTitle>
                <CardDescription className="text-slate-500">
                  Core identity and access controls.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-sm">
                <Field label="Email" value={detail.email} icon={Mail} />
                <Field label="Employee ID" value={`#${detail.employee_id}`} icon={Hash} />
                <Field label="Department" value={detail.department ?? "Not set"} icon={Building2} />
                <Field
                  label="Role"
                  value={detail.role.replace("_", " ")}
                  icon={Shield}
                  valueClassName="capitalize"
                />
                <Field
                  label="Account status"
                  value={detail.is_active ? "Active" : "Disabled"}
                  icon={Power}
                  valueClassName={detail.is_active ? "text-emerald-700" : "text-slate-500"}
                />
                <Field
                  label="Onboarding"
                  value={detail.onboarding_pending ? "Pending" : "Completed"}
                  icon={CalendarDays}
                  valueClassName={detail.onboarding_pending ? "text-amber-700" : "text-emerald-700"}
                />
              </CardContent>
            </Card>

            <Card className="glass border-none">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg text-slate-900">Access snapshot</CardTitle>
                <CardDescription className="text-slate-500">
                  Quick status across the workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <MiniStack
                    label="Owned teams"
                    value={detail.counts.owned_projects}
                    helper="Projects led by this user"
                  />
                  <MiniStack
                    label="Member teams"
                    value={detail.counts.member_projects}
                    helper="Projects where they participate"
                  />
                  <MiniStack
                    label="Submitted reviews"
                    value={detail.counts.submitted_reviews}
                    helper="Requests sent to leadership"
                  />
                  <MiniStack
                    label="Assigned tasks"
                    value={detail.counts.assigned_tasks}
                    helper="Work currently on the board"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-5">
          <RelationCard
            title="Owned teams"
            description="Projects where this user is the lead."
            icon={FolderKanban}
          >
            {ownedProjects.length === 0 ? (
              <EmptyState text="No owned teams yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {ownedProjects.map((project) => (
                  <ProjectRow key={project.id} project={project} relation="Lead" />
                ))}
              </div>
            )}
          </RelationCard>

          <RelationCard
            title="Memberships"
            description="Projects where this user participates as a team member."
            icon={Users}
          >
            {memberProjects.length === 0 ? (
              <EmptyState text="No team memberships yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {memberProjects.map((project) => (
                  <ProjectRow key={project.id} project={project} relation="Member" />
                ))}
              </div>
            )}
          </RelationCard>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-5">
          <RelationCard
            title="Submitted reviews"
            description="Requests this user submitted."
            icon={BadgeCheck}
          >
            {submittedReviews.length === 0 ? (
              <EmptyState text="No submitted reviews yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {submittedReviews.map((review) => (
                  <ReviewRow key={review.id} review={review} relation="Submitted" />
                ))}
              </div>
            )}
          </RelationCard>

          <RelationCard
            title="Reviewed work"
            description="Requests assigned to this user for review."
            icon={ClipboardList}
          >
            {reviewedReviews.length === 0 ? (
              <EmptyState text="No assigned reviews yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {reviewedReviews.map((review) => (
                  <ReviewRow key={review.id} review={review} relation="Reviewer" />
                ))}
              </div>
            )}
          </RelationCard>

          <RelationCard
            title="Tasks"
            description="Delivery work created by or assigned to this user."
            icon={ClipboardList}
          >
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80">
                <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                  Assigned tasks
                </div>
                {assignedTasks.length === 0 ? (
                  <EmptyState text="No assigned tasks yet." compact />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {assignedTasks.map((task) => (
                      <TaskRow key={task.id} task={task} relation="Assigned" />
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80">
                <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                  Created tasks
                </div>
                {createdTasks.length === 0 ? (
                  <EmptyState text="No created tasks yet." compact />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {createdTasks.map((task) => (
                      <TaskRow key={task.id} task={task} relation="Created" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </RelationCard>
        </TabsContent>

        <TabsContent value="reports" className="space-y-5">
          <RelationCard
            title="Daily reports"
            description="Progress updates submitted by this user."
            icon={FileText}
          >
            {reports.length === 0 ? (
              <EmptyState text="No reports submitted yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <ReportRow key={report.id} report={report} />
                ))}
              </div>
            )}
          </RelationCard>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: LucideIcon
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function MiniStack({
  label,
  value,
  helper,
}: {
  label: string
  value: number
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  )
}

function Field({
  label,
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string
  value: string
  icon: LucideIcon
  valueClassName?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <p className={`mt-1 text-sm font-medium text-slate-900 ${valueClassName ?? ""}`}>{value}</p>
      </div>
    </div>
  )
}

function RelationCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <Card className="glass border-none">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <Icon className="h-4 w-4 text-slate-400" />
          {title}
        </CardTitle>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={compact ? "px-4 py-4 text-sm text-slate-400" : "p-6 text-sm text-slate-400"}>
      {text}
    </div>
  )
}

function ProjectRow({
  project,
  relation,
}: {
  project: Project
  relation: string
}) {
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-slate-900">{project.name}</span>
          <Badge className="border-none bg-blue-100 text-blue-700">{relation}</Badge>
          <Badge
            className={`border-none capitalize ${
              project.status === "active"
                ? statusStyles.active
                : project.status === "completed"
                  ? "bg-slate-100 text-slate-500"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {project.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {project.department ?? "No department"} {project.owner?.full_name ? `· Lead: ${project.owner.full_name}` : ""}
        </p>
      </div>
      <ChevronRightIcon />
    </Link>
  )
}

function ReviewRow({
  review,
  relation,
}: {
  review: Review
  relation: string
}) {
  return (
    <Link
      href={`/dashboard/reviews/${review.id}`}
      className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-slate-900">{review.title}</span>
          <Badge className="border-none bg-slate-100 text-slate-600">{relation}</Badge>
          <Badge className={`border-none capitalize ${priorityStyles[review.priority] ?? ""}`}>
            {review.priority}
          </Badge>
          <Badge className={`border-none capitalize ${reviewStatusStyles[review.status] ?? ""}`}>
            {review.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {review.review_type ?? "General review"} {review.project_id ? `· Project #${review.project_id}` : ""}
        </p>
      </div>
      <ChevronRightIcon />
    </Link>
  )
}

function TaskRow({
  task,
  relation,
}: {
  task: Task
  relation: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-slate-50">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-slate-900">{task.title}</span>
          <Badge className="border-none bg-slate-100 text-slate-600">{relation}</Badge>
          <Badge className={`border-none capitalize ${taskStatusStyles[task.status] ?? ""}`}>
            {task.status.replace("_", " ")}
          </Badge>
          <Badge className={`border-none capitalize ${priorityStyles[task.priority] ?? ""}`}>
            {task.priority}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {task.project_id ? `Project #${task.project_id}` : "No project"} · {timeAgo(task.created_at)}
        </p>
      </div>
      <span className="text-xs text-slate-400">{task.assignee?.full_name ?? "Unassigned"}</span>
    </div>
  )
}

function ReportRow({ report }: { report: UserDetail["reports"][number] }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-slate-50">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-none bg-blue-100 text-blue-700">
            {formatDate(report.date?.toString())}
          </Badge>
          {report.project && (
            <Badge className="border-none bg-slate-100 text-slate-600">
              {report.project.name}
            </Badge>
          )}
        </div>
        <p className="max-w-3xl whitespace-pre-wrap text-sm text-slate-700">{report.content}</p>
      </div>
      <span className="shrink-0 text-xs text-slate-400">{timeAgo(report.created_at)}</span>
    </div>
  )
}

function ChevronRightIcon() {
  return <ExternalLink className="h-4 w-4 shrink-0 text-slate-300" />
}

function EditUserDialog({
  viewer,
  target,
  onSaved,
  startOpen = false,
}: {
  viewer: User | null
  target: UserDetail
  onSaved: (updated: UserUpdateResult) => void
  startOpen?: boolean
}) {
  const [open, setOpen] = useState(startOpen)
  const [email, setEmail] = useState(target.email)
  const [fullName, setFullName] = useState(target.full_name ?? "")
  const [department, setDepartment] = useState(target.department ?? "")
  const [role, setRole] = useState<Role>(target.role)
  const [isActive, setIsActive] = useState(target.is_active)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isSelf = viewer?.id === target.id
  const canChangeRole =
    !isSelf &&
    (viewer?.role === "super_admin" ||
      (viewer?.role === "ceo" && target.role !== "super_admin"))
  const canToggleActive = !isSelf
  const roleOptions: Role[] =
    viewer?.role === "super_admin" ? ["employee", "manager", "ceo"] : ["employee", "manager"]

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setEmail(target.email)
        setFullName(target.full_name ?? "")
        setDepartment(target.department ?? "")
        setRole(target.role)
        setIsActive(target.is_active)
        setErr(null)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open, target])

  const submit = async () => {
    if (!email.trim()) {
      setErr("Email is required")
      return
    }

    if (!viewer) {
      setErr("You must be signed in")
      return
    }

    setBusy(true)
    setErr(null)
    try {
      const updated = await updateUser(target.id, {
        email: email.trim(),
        full_name: normalizeNullable(fullName),
        department: normalizeNullable(department),
        ...(canChangeRole ? { role } : {}),
        ...(canToggleActive ? { is_active: isActive } : {}),
      })
      onSaved(updated)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update user")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 rounded-xl bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary/90 cursor-pointer">
            Edit profile
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription className="text-slate-500">
            Adjust profile details and workspace access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-slate-200 bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-700">Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="border-slate-200 bg-slate-50"
              />
            </div>
          </div>

          {canChangeRole && (
            <div className="space-y-2">
              <Label className="text-slate-700">Role</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canToggleActive && (
            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <Shield className="h-4 w-4 text-slate-400" />
                Account active
              </span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
              />
            </label>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="ghost" className="text-slate-500 cursor-pointer">
                Cancel
              </Button>
            }
          />
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-primary text-white hover:bg-primary/90 cursor-pointer"
          >
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
