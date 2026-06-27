"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, CalendarDays, ChevronRight, Crown, Edit3, Trash2, UserPlus, X } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { formatDateOnly, normalizeDateOnly } from "@/lib/date"
import {
  addMember,
  createSprint,
  deleteSprint,
  deleteProject,
  getProject,
  listMembers,
  listReviews,
  listSprints,
  listUsers,
  removeMember,
  updateSprint,
  updateProject,
  type Project,
  type Review,
  type Sprint,
  type User,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
}
const reviewStatusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  needs_changes: "bg-orange-100 text-orange-700",
}
const sprintStatusStyles: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
}

function initials(u: User) {
  return (u.full_name ?? u.email).slice(0, 1).toUpperCase()
}

function Avatar({ u, lead }: { u: User; lead?: boolean }) {
  return (
    <div className="relative">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-xs font-bold text-white">
        {initials(u)}
      </div>
      {lead && (
        <Crown className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      )}
    </div>
  )
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    Promise.all([getProject(id), listMembers(id), listReviews({ projectId: id }), listSprints({ projectId: id })])
      .then(([p, m, r, s]) => {
        setProject(p)
        setMembers(m)
        setReviews(r)
        setSprints(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load project"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const timer = setTimeout(() => {
      load()
      if (role === "manager" || role === "super_admin" || role === "ceo") {
        listUsers().then(setAllUsers).catch(() => {})
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [load, role])

  const canManage =
    Boolean(project) &&
    (role === "super_admin" || role === "ceo" || (role === "manager" && project?.owner_id === user?.id))

  const memberIds = new Set(members.map((m) => m.id))
  const addable = allUsers.filter(
    (u) => !memberIds.has(u.id) && (role === "super_admin" || role === "ceo" || u.role === "employee"),
  )
  const leadCandidates =
    (role === "super_admin" || role === "ceo")
      ? allUsers
      : allUsers.filter((u) => u.id === project?.owner_id || (u.role === "employee" && memberIds.has(u.id)))

  const handleAdd = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      setMembers(await addMember(id, Number(selected)))
      setSelected("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member")
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (userId: number) => {
    setBusy(true)
    setError(null)
    try {
      setMembers(await removeMember(id, userId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteProject(id)
      router.push("/dashboard/projects")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project")
      setBusy(false)
    }
  }

  const handleLeadChange = async (nextOwnerId: number | null) => {
    const previousOwnerId = project?.owner_id ?? null
    setBusy(true)
    setError(null)
    try {
      const updated = await updateProject(id, { owner_id: nextOwnerId })
      setProject(updated)
      if (nextOwnerId === null && previousOwnerId != null) {
        setMembers((current) => current.filter((member) => member.id !== previousOwnerId))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update team lead")
      throw e
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading project…</div>
  if (error && !project)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  if (!project) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <Link
        href="/dashboard/projects"
        className="flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> All teams
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
            <Badge className={`border-none capitalize ${statusStyles[project.status] ?? ""}`}>
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-slate-600">{project.description ?? "No description provided."}</p>
          <p className="text-sm text-slate-400">{project.department ?? "No department"}</p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <EditProjectDialog
              project={project}
              onSaved={(updated) => setProject(updated)}
            />
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    className="gap-2 text-slate-500 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                }
              />
              <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete this team?</DialogTitle>
                  <DialogDescription className="text-slate-500">
                    This permanently deletes <span className="font-medium text-slate-700">{project.name}</span> and
                    its team. Its reviews are kept but detached from the project. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="ghost" className="text-slate-500 cursor-pointer">Cancel</Button>} />
                  <Button
                    onClick={handleDelete}
                    disabled={busy}
                    className="bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                  >
                    {busy ? "Deleting…" : "Delete team"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Team */}
      <Card className="glass border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-900">Team</CardTitle>
          <CardDescription className="text-slate-500">
            {members.length} member{members.length === 1 ? "" : "s"} · led by{" "}
            {project.owner?.full_name ?? "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {project.owner ? (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar u={project.owner} lead />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{project.owner.full_name}</p>
                    <p className="text-xs capitalize text-slate-500">
                      Team Lead · {project.owner.role}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ManageLeadDialog
                      project={project}
                      users={leadCandidates}
                      onSaved={handleLeadChange}
                      triggerLabel="Change lead"
                      triggerVariant="outline"
                      currentRole={role}
                    />
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Remove the current team lead?")) return
                        try {
                          await handleLeadChange(null)
                        } catch {
                          // Error state is surfaced above the page.
                        }
                      }}
                      disabled={busy}
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove lead
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">No team lead assigned</p>
                  <p className="text-xs text-slate-500">Assign a new lead to restore manager controls.</p>
                </div>
                {canManage && (
                  <ManageLeadDialog
                    project={project}
                    users={leadCandidates}
                    onSaved={handleLeadChange}
                    triggerLabel="Assign lead"
                    triggerVariant="default"
                    currentRole={role}
                  />
                )}
              </div>
            )}
            {members
              .filter((m) => m.id !== project.owner_id)
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar u={m} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.full_name ?? m.email}</p>
                      <p className="text-xs capitalize text-slate-500">{m.role} · {m.department ?? "—"}</p>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      onClick={() => handleRemove(m.id)}
                      disabled={busy}
                      aria-label={`Remove ${m.full_name ?? m.email}`}
                      className="h-7 w-7 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            {members.filter((m) => m.id !== project.owner_id).length === 0 && (
              <p className="text-sm text-slate-400">No team members yet.</p>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Select a user to add"
                className="h-9 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              >
                <option value="">Add a team member…</option>
                {addable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? u.email} ({u.role})
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAdd}
                disabled={busy || !selected}
                className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-none">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Sprints</CardTitle>
              <CardDescription className="text-slate-500">
                Plan delivery cycles and attach tasks to active work.
              </CardDescription>
            </div>
            {canManage && (
              <SprintDialog
                mode="create"
                projectId={id}
                onSaved={load}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sprints.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
              No sprints yet.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  projectId={id}
                  canManage={canManage}
                  onSaved={load}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews for this project */}
      <Card className="glass border-none">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-lg text-slate-900">Team Reviews</CardTitle>
          <CardDescription className="text-slate-500">
            Work submitted under this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reviews.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No reviews for this project yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviews.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/reviews/${r.id}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 group cursor-pointer"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{r.title}</span>
                      <Badge className={`border-none ${reviewStatusStyles[r.status] ?? ""}`}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <span className="text-sm text-slate-500">
                      {r.submitter?.full_name ?? "Unknown"}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function EditProjectDialog({
  project,
  onSaved,
}: {
  project: Project
  onSaved: (updated: Project) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? "")
  const [department, setDepartment] = useState(project.department ?? "")
  const [status, setStatus] = useState<Project["status"]>(project.status as Project["status"])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setName(project.name)
        setDescription(project.description ?? "")
        setDepartment(project.department ?? "")
        setStatus(project.status as Project["status"])
        setErr(null)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open, project])

  const submit = async () => {
    if (!name.trim()) {
      setErr("Project name is required")
      return
    }

    setBusy(true)
    setErr(null)
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        department: department.trim().length > 0 ? department.trim() : null,
        status,
      })
      onSaved(updated)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update team")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <Edit3 className="h-4 w-4" />
            Edit team
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription className="text-slate-500">
            Update the team name, description, department, or status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-slate-200 bg-slate-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-28 border-slate-200 bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-700">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Project["status"])}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              >
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
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
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManageLeadDialog({
  project,
  users,
  onSaved,
  triggerLabel,
  triggerVariant,
  currentRole,
}: {
  project: Project
  users: User[]
  onSaved: (ownerId: number | null) => Promise<void> | void
  triggerLabel: string
  triggerVariant: "default" | "outline"
  currentRole: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedOwnerId, setSelectedOwnerId] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setSelectedOwnerId(project.owner_id != null ? String(project.owner_id) : "")
        setErr(null)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open, project.owner_id])

  const submit = async () => {
    setBusy(true)
    setErr(null)
    try {
      await onSaved(selectedOwnerId ? Number(selectedOwnerId) : null)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update team lead")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            className={`gap-2 cursor-pointer ${
              triggerVariant === "outline"
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-primary text-white hover:bg-primary/90"
            }`}
          >
            <Edit3 className="h-4 w-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage team lead</DialogTitle>
          <DialogDescription className="text-slate-500">
            {currentRole === "manager"
              ? "Managers can only move the lead to an employee already on the team."
              : "Move the lead role to another user or clear it completely."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Lead</Label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
            >
              <option value="">No team lead assigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name ?? user.email} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Clearing the lead removes the current lead from the team roster if they are only there as lead.
          </div>
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
            {busy ? "Saving…" : "Save lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatSprintDate(value: string | null) {
  if (!value) return "Not set"
  return formatDateOnly(value, { month: "short", day: "numeric", year: "numeric" }) || "Not set"
}

function sprintDateInput(value: string | null) {
  if (!value) return ""
  return normalizeDateOnly(value)
}

function SprintCard({
  sprint,
  projectId,
  canManage,
  onSaved,
}: {
  sprint: Sprint
  projectId: number
  canManage: boolean
  onSaved: () => void
}) {
  const [err, setErr] = useState<string | null>(null)
  const handleStatus = async (status: Sprint["status"]) => {
    try {
      await updateSprint(sprint.id, { status })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update sprint")
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${sprint.name}? Tasks will move out of this sprint.`)) return
    try {
      await deleteSprint(sprint.id)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete sprint")
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-900">{sprint.name}</h3>
            <Badge className={`border-none capitalize ${sprintStatusStyles[sprint.status] ?? ""}`}>
              {sprint.status}
            </Badge>
          </div>
          <p className="line-clamp-2 text-sm text-slate-500">{sprint.goal ?? "No sprint goal set."}</p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <SprintDialog mode="edit" sprint={sprint} projectId={projectId} onSaved={onSaved} />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatSprintDate(sprint.start_date)}
        </span>
        <span>Ends {formatSprintDate(sprint.end_date)}</span>
        <span>{sprint.task_count} task{sprint.task_count === 1 ? "" : "s"}</span>
      </div>
      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleStatus("planned")}
            className="h-8 border-slate-200 bg-white text-xs text-slate-600 cursor-pointer"
          >
            Plan
          </Button>
          <Button
            variant="outline"
            onClick={() => handleStatus("active")}
            className="h-8 border-slate-200 bg-white text-xs text-emerald-700 cursor-pointer"
          >
            Activate
          </Button>
          <Button
            variant="outline"
            onClick={() => handleStatus("completed")}
            className="h-8 border-slate-200 bg-white text-xs text-blue-700 cursor-pointer"
          >
            Complete
          </Button>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  )
}

function SprintDialog({
  mode,
  sprint,
  projectId,
  onSaved,
}: {
  mode: "create" | "edit"
  sprint?: Sprint
  projectId: number
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(sprint?.name ?? "")
  const [goal, setGoal] = useState(sprint?.goal ?? "")
  const [status, setStatus] = useState<Sprint["status"]>(sprint?.status ?? "planned")
  const [startDate, setStartDate] = useState(sprintDateInput(sprint?.start_date ?? null))
  const [endDate, setEndDate] = useState(sprintDateInput(sprint?.end_date ?? null))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setName(sprint?.name ?? "")
      setGoal(sprint?.goal ?? "")
      setStatus(sprint?.status ?? "planned")
      setStartDate(sprintDateInput(sprint?.start_date ?? null))
      setEndDate(sprintDateInput(sprint?.end_date ?? null))
      setErr(null)
    }, 0)
    return () => clearTimeout(timer)
  }, [open, sprint])

  const submit = async () => {
    if (!name.trim()) {
      setErr("Sprint name is required")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const payload = {
        name: name.trim(),
        goal: goal.trim() || null,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        project_id: projectId,
      }
      if (mode === "create") {
        await createSprint(payload)
      } else if (sprint) {
        await updateSprint(sprint.id, payload)
      }
      setOpen(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save sprint")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
              <CalendarDays className="h-4 w-4" />
              New sprint
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 cursor-pointer">
              <Edit3 className="h-4 w-4" />
            </Button>
          )
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create sprint" : "Edit sprint"}</DialogTitle>
          <DialogDescription className="text-slate-500">
            Set the sprint goal, dates, and lifecycle status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-slate-200 bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label>Goal</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} className="min-h-24 border-slate-200 bg-slate-50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-slate-200 bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-slate-200 bg-slate-50" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Sprint["status"])} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900">
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" className="text-slate-500 cursor-pointer">Cancel</Button>} />
          <Button onClick={submit} disabled={busy} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
            {busy ? "Saving..." : "Save sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
