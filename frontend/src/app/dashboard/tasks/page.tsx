"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import {
  listTasks,
  listProjects,
  createTask,
  updateTask,
  deleteTask,
  type Task,
  type Project
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit3 } from "lucide-react"

const priorityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-600",
}

export default function TasksPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const canManage = role === "ceo" || role === "manager" || role === "super_admin"

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([listTasks(), listProjects()])
      .then(([t, p]) => {
        setTasks(t)
        setProjects(p)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tasks"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      load()
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Tasks</h1>
          <p className="text-slate-500">Track tasks and deliverables across projects.</p>
        </div>
        {canManage && <TaskDialog mode="create" onSaved={load} projects={projects} />}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="text-sm text-slate-500">No tasks found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(["todo", "in_progress", "done"] as const).map((status) => (
            <div key={status} className="flex flex-col gap-4">
              <h2 className="text-lg font-medium capitalize text-slate-700">
                {status.replace("_", " ")}
              </h2>
              {tasks.filter(t => t.status === status).map((t) => (
                <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="glass border-none transition-all hover:shadow-md">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base text-slate-900">{t.title}</CardTitle>
                        <Badge className={`border-none capitalize ${priorityStyles[t.priority] ?? ""}`}>
                          {t.priority}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 text-xs">
                        {t.description ?? "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between p-4 pt-2">
                      <div className="text-xs text-slate-500">
                        Assignee: <span className="font-medium text-slate-700">{t.assignee?.full_name ?? "Unassigned"}</span>
                      </div>
                      <TaskDialog mode="edit" task={t} onSaved={load} projects={projects} canManage={canManage} />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TaskDialog({ 
  mode, 
  task, 
  projects, 
  canManage = true,
  onSaved 
}: { 
  mode: "create" | "edit", 
  task?: Task, 
  projects: Project[], 
  canManage?: boolean,
  onSaved: () => void 
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? "todo")
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority ?? "medium")
  const [projectId, setProjectId] = useState<string>(task?.project_id ? String(task.project_id) : "")
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee_id ? String(task.assignee_id) : "")
  
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selectedProject = projects.find(p => p.id === Number(projectId))

  useEffect(() => {
    if (open && task) {
      const timer = setTimeout(() => {
        setTitle(task.title)
        setDescription(task.description ?? "")
        setStatus(task.status)
        setPriority(task.priority)
        setProjectId(String(task.project_id))
        setAssigneeId(task.assignee_id ? String(task.assignee_id) : "")
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open, task])

  const submit = async () => {
    if (!title.trim() || !projectId) {
      setErr("Title and project are required")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      if (mode === "create") {
        await createTask({
          title,
          description,
          status,
          priority,
          project_id: Number(projectId),
          assignee_id: assigneeId ? Number(assigneeId) : undefined
        })
      } else if (task) {
        if (canManage) {
          await updateTask(task.id, {
            title,
            description,
            status,
            priority,
            project_id: Number(projectId),
            assignee_id: assigneeId ? Number(assigneeId) : undefined
          })
        } else {
          // Non-managers can only update status
          await updateTask(task.id, { status })
        }
      }
      setOpen(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : `Failed to ${mode} task`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm("Are you sure you want to delete this task?")) return
    setBusy(true)
    try {
      await deleteTask(task.id)
      setOpen(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete task")
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
              <Plus className="h-4 w-4" /> New Task
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
              <Edit3 className="h-4 w-4 text-slate-400" />
            </Button>
          )
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Task" : "Edit Task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {(!canManage && mode === "edit") ? (
            <div className="space-y-2">
              <Label className="text-slate-700">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task["status"])}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-slate-700">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Design Login Page"
                  className="border-slate-200 bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task details..."
                  className="border-slate-200 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-700">Status</Label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Task["status"])}
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">Priority</Label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Task["priority"])}
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Project</Label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {selectedProject && (
                <div className="space-y-2">
                  <Label className="text-slate-700">Assignee</Label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                  >
                    <option value="">Unassigned</option>
                    {selectedProject.members.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <DialogFooter className="flex items-center justify-between">
          {(mode === "edit" && canManage) ? (
            <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer" onClick={handleDelete} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <DialogClose
              render={
                <Button variant="ghost" className="text-slate-500 cursor-pointer">
                  Cancel
                </Button>
              }
            />
            <Button onClick={submit} disabled={busy} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
