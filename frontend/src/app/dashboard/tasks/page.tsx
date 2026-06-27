"use client"

import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react"
import { TEAMS } from "@/lib/teams"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import {
  addTaskComment,
  createTask,
  deleteTask,
  listProjects,
  listSprints,
  listTaskComments,
  listTasks,
  listUsers,
  updateTask,
  type Project,
  type Sprint,
  type Task,
  type TaskComment,
  type TaskIssueType,
  type TaskPriority,
  type TaskStatus,
  type User,
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import {
  formatDateOnly,
  isPastDateOnly,
  isSuspiciousDateOnly,
  normalizeDateOnly,
} from "@/lib/date"
import {
  AlertCircle,
  Bug,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Flame,
  GitBranch,
  MessageSquare,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react"

const columns: { status: TaskStatus; label: string; icon: typeof Clock3 }[] = [
  { status: "backlog", label: "Backlog", icon: GitBranch },
  { status: "todo", label: "To do", icon: Clock3 },
  { status: "in_progress", label: "In progress", icon: Flame },
  { status: "in_review", label: "In review", icon: ShieldAlert },
  { status: "blocked", label: "Blocked", icon: AlertCircle },
  { status: "done", label: "Done", icon: CheckCircle2 },
]

const priorityStyles: Record<TaskPriority, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-600",
}

const issueStyles: Record<TaskIssueType, string> = {
  story: "bg-emerald-100 text-emerald-700",
  task: "bg-slate-100 text-slate-600",
  bug: "bg-red-100 text-red-700",
  epic: "bg-indigo-100 text-indigo-700",
}

function formatTaskDate(value: string | null | undefined) {
  if (!value) return "No due date"
  const formatted = isSuspiciousDateOnly(value)
    ? formatDateOnly(value, { month: "short", day: "numeric", year: "numeric" })
    : formatDateOnly(value)
  return formatted || "No due date"
}

function teamUsers(project?: Project | null) {
  if (!project) return []
  const seen = new Set<number>()
  const users: User[] = []
  if (project.owner) {
    users.push(project.owner)
    seen.add(project.owner.id)
  }
  for (const member of project.members) {
    if (!seen.has(member.id)) {
      users.push(member)
      seen.add(member.id)
    }
  }
  return users
}

export default function TasksPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const canManage = role === "manager" || role === "super_admin" || role === "ceo"

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [projectFilter, setProjectFilter] = useState("")
  const [sprintFilter, setSprintFilter] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [search, setSearch] = useState("")
  const [activeStatus, setActiveStatus] = useState<TaskStatus | "all">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listTasks({
        projectId: projectFilter ? Number(projectFilter) : undefined,
        sprintId: sprintFilter ? Number(sprintFilter) : undefined,
        assigneeId: assigneeFilter ? Number(assigneeFilter) : undefined,
        search: search.trim() || undefined,
      }),
      listProjects(),
      listSprints(projectFilter ? { projectId: Number(projectFilter) } : {}),
    ])
      .then(([taskData, projectData, sprintData]) => {
        setTasks(taskData)
        setProjects(projectData)
        setSprints(sprintData)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tasks"))
      .finally(() => setLoading(false))
  }, [assigneeFilter, projectFilter, search, sprintFilter])

  useEffect(() => {
    const timer = setTimeout(load, 150)
    return () => clearTimeout(timer)
  }, [load])

  const visibleSprints = useMemo(
    () => sprints.filter((sprint) => !projectFilter || sprint.project_id === Number(projectFilter)),
    [projectFilter, sprints],
  )
  const people = useMemo(() => {
    const seen = new Set<number>()
    const out: User[] = []
    for (const project of projects) {
      for (const member of teamUsers(project)) {
        if (!seen.has(member.id)) {
          out.push(member)
          seen.add(member.id)
        }
      }
    }
    return out
  }, [projects])

  const counts = {
    total: tasks.length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    overdue: tasks.filter((task) => task.status !== "done" && isPastDateOnly(task.due_date)).length,
    done: tasks.filter((task) => task.status === "done").length,
  }

  const updateStatus = async (task: Task, status: TaskStatus) => {
    try {
      await updateTask(task.id, { status })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Work board</h1>
          <p className="text-slate-500">Plan, assign, discuss, and move work through the delivery flow.</p>
        </div>
        {canManage && <TaskDialog mode="create" onSaved={load} projects={projects} sprints={sprints} canManage={canManage} />}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total work" value={counts.total} />
        <Metric label="Blocked" value={counts.blocked} tone="red" />
        <Metric label="Overdue" value={counts.overdue} tone="amber" />
        <Metric label="Done" value={counts.done} tone="green" />
      </div>

      <Card className="glass border-none">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value)
              setSprintFilter("")
            }}
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
          >
            <option value="">All sprints</option>
            {visibleSprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
          >
            <option value="">All assignees</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.full_name ?? person.email}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading board…
        </div>
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1.5">
            <StatusTab
              label="All"
              count={tasks.length}
              active={activeStatus === "all"}
              onClick={() => setActiveStatus("all")}
            />
            {columns.map(({ status, label, icon: Icon }) => (
              <StatusTab
                key={status}
                label={label}
                icon={Icon}
                count={tasks.filter((task) => task.status === status).length}
                active={activeStatus === status}
                onClick={() => setActiveStatus(status)}
              />
            ))}
          </div>

          {/* Cards grid for the active status */}
          {(() => {
            const visible = activeStatus === "all"
              ? tasks
              : tasks.filter((task) => task.status === activeStatus)
            if (visible.length === 0) {
              return (
                <div className="rounded-[14px] border border-dashed border-[#e2e8f0] bg-white px-4 py-16 text-center text-[13px] text-slate-400">
                  No issues in this category.
                </div>
              )
            }
            return (
              <div className="flex flex-col gap-2">
                {visible.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManage={canManage}
                    projects={projects}
                    sprints={sprints}
                    onSaved={load}
                    onStatus={updateStatus}
                  />
                ))}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

function StatusTab({
  label,
  count,
  active,
  icon: Icon,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  icon?: typeof Clock3
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
        active
          ? "border-primary bg-primary text-white"
          : "border-[#eef2f7] bg-white text-slate-600 hover:bg-[#f4f7fb]"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />}
      {label}
      <span
        className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold ${
          active ? "bg-white/25 text-white" : "bg-[#f1f5f9] text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function Metric({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "red" | "amber" | "green" }) {
  const toneConfig = {
    blue:  { iconBg: "#eff4ff", iconColor: "#2563eb", icon: "◈" },
    red:   { iconBg: "#fef2f2", iconColor: "#dc2626", icon: "⊗" },
    amber: { iconBg: "#fef6e7", iconColor: "#b45309", icon: "⚠" },
    green: { iconBg: "#ecfdf3", iconColor: "#15803d", icon: "✓" },
  }
  const t = toneConfig[tone]
  return (
    <div className="rounded-[14px] border border-[#eef2f7] bg-white px-[18px] py-[15px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        <div
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] text-[13px]"
          style={{ background: t.iconBg, color: t.iconColor }}
        >
          {t.icon}
        </div>
      </div>
      <p className="mt-2.5 text-[26px] font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  )
}

function TaskCard({
  task,
  canManage,
  projects,
  sprints,
  onSaved,
  onStatus,
}: {
  task: Task
  canManage: boolean
  projects: Project[]
  sprints: Sprint[]
  onSaved: () => void
  onStatus: (task: Task, status: TaskStatus) => void
}) {
  const overdue = task.status !== "done" && isPastDateOnly(task.due_date)
  const dueDate = formatTaskDate(task.due_date)

  // The whole row is the dialog trigger; interactive controls stop propagation.
  const row = (
    <div
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer items-center gap-3 rounded-[10px] border border-[#eef2f7] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]"
    >
      {/* Title + badges + sub-meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`flex-shrink-0 rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold capitalize ${issueStyles[task.issue_type]}`}>
            {task.issue_type === "bug" && <Bug className="mr-0.5 inline h-2.5 w-2.5" />}
            {task.issue_type}
          </span>
          <span className={`flex-shrink-0 rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold capitalize ${priorityStyles[task.priority]}`}>
            {task.priority}
          </span>
          <p className="truncate text-[13px] font-medium text-slate-900">{task.title}</p>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-slate-400">
          <span className="truncate">{task.project?.name ?? `#${task.project_id}`}</span>
          <span className="text-slate-300">•</span>
          <span className="truncate">{task.assignee?.full_name ?? task.assignee?.email ?? "Unassigned"}</span>
        </div>
      </div>

      {/* Right-side meta */}
      <span className="flex items-center gap-0.5 text-[11.5px] text-slate-400">
        <MessageSquare className="h-3 w-3" strokeWidth={1.8} />
        {task.comments_count}
      </span>
        <span className={`w-[92px] text-right text-[11.5px] ${overdue ? "font-semibold text-red-500" : "text-slate-400"}`}>
        {dueDate}
      </span>

      {/* Quick status change — does not open the dialog */}
      <select
        value={task.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { e.stopPropagation(); onStatus(task, e.target.value as TaskStatus) }}
        className="h-7 w-[112px] flex-shrink-0 rounded-[7px] border border-[#eef2f7] bg-[#f8fafc] px-2 text-[11.5px] text-slate-600 focus:outline-none"
      >
        {columns.map((col) => (
          <option key={col.status} value={col.status}>{col.label}</option>
        ))}
      </select>
    </div>
  )

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <TaskDialog mode="edit" task={task} onSaved={onSaved} projects={projects} sprints={sprints} canManage={canManage} trigger={row} />
    </motion.div>
  )
}

function TaskDialog({
  mode,
  task,
  projects,
  sprints,
  canManage,
  onSaved,
  trigger,
}: {
  mode: "create" | "edit"
  task?: Task
  projects: Project[]
  sprints: Sprint[]
  canManage: boolean
  onSaved: () => void
  trigger?: ReactElement
}) {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [issueType, setIssueType] = useState<TaskIssueType>(task?.issue_type ?? "task")
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo")
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium")
  const [projectId, setProjectId] = useState(task?.project_id ? String(task.project_id) : "")
  const [sprintId, setSprintId] = useState(task?.sprint_id ? String(task.sprint_id) : "")
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ? String(task.assignee_id) : "")
  const [dueDate, setDueDate] = useState(normalizeDateOnly(task?.due_date))
  const [estimate, setEstimate] = useState(task?.estimate_minutes != null ? String(task.estimate_minutes) : "")
  const [logged, setLogged] = useState(task?.logged_minutes != null ? String(task.logged_minutes) : "0")
  const [comments, setComments] = useState<TaskComment[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selectedProject = projects.find((project) => project.id === Number(projectId)) ?? task?.project
  const team = teamUsers(selectedProject)
  const teamIds = new Set(team.map((member) => member.id))
  const otherEmployees = allUsers.filter(
    (u) => !teamIds.has(u.id) && (role === "super_admin" || u.role === "employee"),
  )

  // Group other employees by their team/department for the assignee dropdown.
  const knownDepts = new Set(TEAMS as readonly string[])
  const otherByTeam: { label: string; members: User[] }[] = TEAMS.map((t) => ({
    label: t,
    members: otherEmployees.filter((u) => u.department === t),
  })).filter((g) => g.members.length > 0)
  const otherUncategorised = otherEmployees.filter((u) => !u.department || !knownDepts.has(u.department))
  if (otherUncategorised.length > 0) otherByTeam.push({ label: "Other", members: otherUncategorised })
  const sprintOptions = sprints.filter((sprint) => !projectId || sprint.project_id === Number(projectId))

  useEffect(() => {
    if (!open || !canManage) return
    listUsers().then(setAllUsers).catch(() => setAllUsers([]))
  }, [open, canManage])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setTitle(task?.title ?? "")
      setDescription(task?.description ?? "")
      setIssueType(task?.issue_type ?? "task")
      setStatus(task?.status ?? "todo")
      setPriority(task?.priority ?? "medium")
      setProjectId(task?.project_id ? String(task.project_id) : "")
      setSprintId(task?.sprint_id ? String(task.sprint_id) : "")
      setAssigneeId(task?.assignee_id ? String(task.assignee_id) : "")
      setDueDate(normalizeDateOnly(task?.due_date))
      setEstimate(task?.estimate_minutes != null ? String(task.estimate_minutes) : "")
      setLogged(task?.logged_minutes != null ? String(task.logged_minutes) : "0")
      setErr(null)
      if (task) {
        listTaskComments(task.id).then(setComments).catch(() => setComments([]))
      } else {
        setComments([])
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [open, task])

  const submit = async () => {
    if (canManage && (!title.trim() || !projectId)) {
      setErr("Title and project are required")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      if (mode === "create") {
        await createTask({
          title: title.trim(),
          description: description.trim() || null,
          issue_type: issueType,
          status,
          priority,
          project_id: Number(projectId),
          sprint_id: sprintId ? Number(sprintId) : null,
          assignee_id: assigneeId ? Number(assigneeId) : null,
          due_date: dueDate || null,
          estimate_minutes: estimate ? Number(estimate) : null,
          logged_minutes: logged ? Number(logged) : 0,
        })
      } else if (task) {
        await updateTask(
          task.id,
          canManage
            ? {
                title: title.trim(),
                description: description.trim() || null,
                issue_type: issueType,
                status,
                priority,
                project_id: Number(projectId),
                sprint_id: sprintId ? Number(sprintId) : null,
                assignee_id: assigneeId ? Number(assigneeId) : null,
                due_date: dueDate || null,
                estimate_minutes: estimate ? Number(estimate) : null,
                logged_minutes: logged ? Number(logged) : 0,
              }
            : {
                status,
                logged_minutes: logged ? Number(logged) : 0,
              },
        )
      }
      setOpen(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save task")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!task || !confirm("Delete this task?")) return
    setBusy(true)
    try {
      await deleteTask(task.id)
      setOpen(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete task")
    } finally {
      setBusy(false)
    }
  }

  const submitComment = async () => {
    if (!task || !comment.trim()) return
    try {
      const saved = await addTaskComment(task.id, comment)
      setComments((current) => [...current, saved])
      setComment("")
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add comment")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={!trigger}
        render={
          trigger ? (
            trigger
          ) : mode === "create" ? (
            <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
              <Plus className="h-4 w-4" />
              New issue
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
              <Edit3 className="h-4 w-4 text-slate-400" />
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[92vh] overflow-hidden border-slate-200 bg-slate-50 p-0 text-slate-900 sm:max-w-5xl">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {task && (
                    <>
                      <Badge className={`border-none capitalize ${issueStyles[task.issue_type]}`}>{task.issue_type}</Badge>
                      <Badge className={`border-none capitalize ${priorityStyles[task.priority]}`}>{task.priority}</Badge>
                    </>
                  )}
                  <Badge className="border-none bg-slate-100 text-slate-700 capitalize">{status}</Badge>
                  {task && (
                    <Badge className="border-none bg-blue-50 text-blue-700">
                      {task.comments_count} comment{task.comments_count === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-2xl tracking-tight">{mode === "create" ? "Create issue" : "Issue details"}</DialogTitle>
                  <DialogDescription className="max-w-2xl text-sm text-slate-500">
                    {canManage ? "Manage ownership, sprint, delivery dates, and discussion." : "Update your status and logged time."}
                  </DialogDescription>
                </div>
              </div>
              {task && (
                <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right md:block">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Task</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">#{task.id}</div>
                  <div className="mt-1 max-w-[210px] truncate text-xs text-slate-500">
                    {task.assignee?.full_name ?? task.assignee?.email ?? "Unassigned"}
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
            <div className="space-y-5">
              <Panel title="Core details" description="The issue brief and delivery status.">
                {canManage ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="border-slate-200 bg-white" />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-40 border-slate-200 bg-white" />
                    </div>
                    {task?.due_date && isSuspiciousDateOnly(task.due_date) && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Legacy due date detected on this task. Correct it before saving so executives do not see malformed data.
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <SelectField label="Issue type" value={issueType} onChange={(value) => setIssueType(value as TaskIssueType)} options={["story", "task", "bug", "epic"]} />
                      <SelectField label="Priority" value={priority} onChange={(value) => setPriority(value as TaskPriority)} options={["low", "medium", "high", "critical"]} />
                      <SelectField label="Status" value={status} onChange={(value) => setStatus(value as TaskStatus)} options={columns.map((column) => column.status)} />
                      <div className="space-y-2">
                        <Label>Due date</Label>
                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border-slate-200 bg-white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectField label="Status" value={status} onChange={(value) => setStatus(value as TaskStatus)} options={columns.map((column) => column.status)} />
                    <div className="space-y-2">
                      <Label>Logged minutes</Label>
                      <Input type="number" min="0" value={logged} onChange={(e) => setLogged(e.target.value)} className="border-slate-200 bg-white" />
                    </div>
                  </div>
                )}
              </Panel>

              {task && (
                <Panel title="Discussion" description="Comments stay attached to this work item.">
                  <div className="space-y-3">
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {comments.length === 0 ? (
                        <p className="text-sm text-slate-400">No comments yet.</p>
                      ) : (
                        comments.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                            <div className="mb-1 text-xs font-medium text-slate-500">
                              {item.author?.full_name ?? item.author?.email ?? "Unknown"}
                            </div>
                            <p className="whitespace-pre-wrap text-slate-700">{item.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" className="border-slate-200 bg-white" />
                      <Button onClick={submitComment} variant="outline" className="cursor-pointer">Send</Button>
                    </div>
                  </div>
                </Panel>
              )}
            </div>

            <div className="space-y-5">
              {canManage && (
                <Panel title="Ownership" description="Who owns the work and where it belongs.">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <select
                        value={projectId}
                        onChange={(e) => {
                          setProjectId(e.target.value)
                          setSprintId("")
                          setAssigneeId("")
                        }}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      >
                        <option value="">Select project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sprint</Label>
                      <select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                        <option value="">Backlog / no sprint</option>
                        {sprintOptions.map((sprint) => (
                          <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assignee</Label>
                      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                        <option value="">Unassigned</option>
                        {team.length > 0 && (
                          <optgroup label="Project team">
                            {team.map((member) => (
                              <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>
                            ))}
                          </optgroup>
                        )}
                        {otherByTeam.map(({ label, members }) => (
                          <optgroup key={label} label={label}>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Estimate min</Label>
                        <Input type="number" min="0" value={estimate} onChange={(e) => setEstimate(e.target.value)} className="border-slate-200 bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label>Logged min</Label>
                        <Input type="number" min="0" value={logged} onChange={(e) => setLogged(e.target.value)} className="border-slate-200 bg-white" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                      Assigning an eligible user outside the project team adds them automatically.
                    </div>
                  </div>
                </Panel>
              )}

              {task && (
                <Panel title="Snapshot" description="A compact executive summary of this issue.">
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-slate-500">Project</span>
                      <span className="font-medium text-slate-900">{task.project?.name ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-slate-500">Sprint</span>
                      <span className="font-medium text-slate-900">{task.sprint?.name ?? "No sprint"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-slate-500">Assignee</span>
                      <span className="font-medium text-slate-900">{task.assignee?.full_name ?? task.assignee?.email ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-slate-500">Due date</span>
                      <span className={`font-medium ${isPastDateOnly(task.due_date) && task.status !== "done" ? "text-red-600" : "text-slate-900"}`}>
                        {formatTaskDate(task.due_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-slate-500">Estimate / logged</span>
                      <span className="font-medium text-slate-900">
                        {task.estimate_minutes ?? "—"} / {task.logged_minutes}
                      </span>
                    </div>
                  </div>
                </Panel>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
            <DialogFooter className="flex items-center justify-between">
              {mode === "edit" && canManage && (
                <Button variant="ghost" onClick={handleDelete} disabled={busy} className="mr-auto gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <DialogClose render={<Button variant="ghost" className="text-slate-500 cursor-pointer">Cancel</Button>} />
              <Button onClick={submit} disabled={busy} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
                {busy ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-4 space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
        {description && <p className="text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm capitalize text-slate-900">
        {options.map((option) => (
          <option key={option} value={option}>{option.replace("_", " ")}</option>
        ))}
      </select>
    </div>
  )
}
