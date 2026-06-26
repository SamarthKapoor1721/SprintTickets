"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

function toDateInput(value: string | null | undefined) {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No due date"
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" })
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
  const canManage = role === "ceo" || role === "manager" || role === "super_admin"

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [projectFilter, setProjectFilter] = useState("")
  const [sprintFilter, setSprintFilter] = useState("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [search, setSearch] = useState("")
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
    overdue: tasks.filter((task) => task.status !== "done" && task.due_date && new Date(task.due_date) < new Date()).length,
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
        <div className="text-sm text-slate-500">Loading board...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-6">
          {columns.map(({ status, label, icon: Icon }) => {
            const columnTasks = tasks.filter((task) => task.status === status)
            return (
              <section key={status} className="min-h-[360px] rounded-2xl border border-slate-200 bg-slate-50/80">
                <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-800">{label}</h2>
                  </div>
                  <Badge className="border-none bg-white text-slate-500">{columnTasks.length}</Badge>
                </div>
                <div className="space-y-3 p-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-400">
                      No issues
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        canManage={canManage}
                        projects={projects}
                        sprints={sprints}
                        onSaved={load}
                        onStatus={updateStatus}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "red" | "amber" | "green" }) {
  const tones = {
    blue: "text-blue-700 bg-blue-50",
    red: "text-red-700 bg-red-50",
    amber: "text-amber-700 bg-amber-50",
    green: "text-emerald-700 bg-emerald-50",
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-2 w-fit rounded-xl px-3 py-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
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
  const overdue = task.status !== "done" && task.due_date && new Date(task.due_date) < new Date()
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="space-y-3 p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm leading-5 text-slate-900">{task.title}</CardTitle>
            <TaskDialog mode="edit" task={task} onSaved={onSaved} projects={projects} sprints={sprints} canManage={canManage} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={`border-none capitalize ${issueStyles[task.issue_type]}`}>
              {task.issue_type === "bug" && <Bug className="mr-1 h-3 w-3" />}
              {task.issue_type}
            </Badge>
            <Badge className={`border-none capitalize ${priorityStyles[task.priority]}`}>{task.priority}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-1">
          {task.description && <p className="line-clamp-2 text-xs leading-5 text-slate-500">{task.description}</p>}
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <span>{task.project?.name ?? `Project #${task.project_id}`}</span>
              <span className={overdue ? "font-medium text-red-600" : ""}>{formatDate(task.due_date)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{task.assignee?.full_name ?? task.assignee?.email ?? "Unassigned"}</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {task.comments_count}
              </span>
            </div>
          </div>
          <select
            value={task.status}
            onChange={(e) => onStatus(task, e.target.value as TaskStatus)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
          >
            {columns.map((column) => (
              <option key={column.status} value={column.status}>{column.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>
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
}: {
  mode: "create" | "edit"
  task?: Task
  projects: Project[]
  sprints: Sprint[]
  canManage: boolean
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [issueType, setIssueType] = useState<TaskIssueType>(task?.issue_type ?? "task")
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo")
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium")
  const [projectId, setProjectId] = useState(task?.project_id ? String(task.project_id) : "")
  const [sprintId, setSprintId] = useState(task?.sprint_id ? String(task.sprint_id) : "")
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ? String(task.assignee_id) : "")
  const [dueDate, setDueDate] = useState(toDateInput(task?.due_date))
  const [estimate, setEstimate] = useState(task?.estimate_minutes != null ? String(task.estimate_minutes) : "")
  const [logged, setLogged] = useState(task?.logged_minutes != null ? String(task.logged_minutes) : "0")
  const [comments, setComments] = useState<TaskComment[]>([])
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selectedProject = projects.find((project) => project.id === Number(projectId)) ?? task?.project
  const team = teamUsers(selectedProject)
  const sprintOptions = sprints.filter((sprint) => !projectId || sprint.project_id === Number(projectId))

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
      setDueDate(toDateInput(task?.due_date))
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
        render={
          mode === "create" ? (
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
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-200 bg-white text-slate-900 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create issue" : "Issue details"}</DialogTitle>
          <DialogDescription>
            {canManage ? "Manage ownership, sprint, delivery dates, and discussion." : "Update your status and logged time."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            {canManage ? (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="border-slate-200 bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-32 border-slate-200 bg-slate-50" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField label="Issue type" value={issueType} onChange={(value) => setIssueType(value as TaskIssueType)} options={["story", "task", "bug", "epic"]} />
                  <SelectField label="Priority" value={priority} onChange={(value) => setPriority(value as TaskPriority)} options={["low", "medium", "high", "critical"]} />
                  <SelectField label="Status" value={status} onChange={(value) => setStatus(value as TaskStatus)} options={columns.map((column) => column.status)} />
                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border-slate-200 bg-slate-50" />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField label="Status" value={status} onChange={(value) => setStatus(value as TaskStatus)} options={columns.map((column) => column.status)} />
                <div className="space-y-2">
                  <Label>Logged minutes</Label>
                  <Input type="number" min="0" value={logged} onChange={(e) => setLogged(e.target.value)} className="border-slate-200 bg-slate-50" />
                </div>
              </div>
            )}

            {task && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <MessageSquare className="h-4 w-4 text-slate-500" />
                  Discussion
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-slate-400">No comments yet.</p>
                  ) : (
                    comments.map((item) => (
                      <div key={item.id} className="rounded-xl bg-white px-3 py-2 text-sm">
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
            )}
          </div>

          {canManage && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>
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
              <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
                <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                Team members must be added to the project before they can be assigned.
              </div>
            </div>
          )}
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

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
      </DialogContent>
    </Dialog>
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
