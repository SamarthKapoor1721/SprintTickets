"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Crown, Plus, Users } from "lucide-react"
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
import { createProject, listProjects, type Project, type User } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

function initials(u: User) {
  return (u.full_name ?? u.email).slice(0, 1).toUpperCase()
}

// Owner (lead) first, then members, de-duplicated — used for the avatar stack.
function teamOf(p: Project): { user: User; lead: boolean }[] {
  const seen = new Set<number>()
  const out: { user: User; lead: boolean }[] = []
  if (p.owner) {
    out.push({ user: p.owner, lead: true })
    seen.add(p.owner.id)
  }
  for (const m of p.members) {
    if (!seen.has(m.id)) {
      out.push({ user: m, lead: false })
      seen.add(m.id)
    }
  }
  return out
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canManage = role === "manager" || role === "super_admin"

  const refresh = useCallback(() => {
    setLoading(true)
    listProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load projects"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      refresh()
    }, 0)
    return () => clearTimeout(timer)
  }, [refresh])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Teams</h1>
          <p className="text-slate-500">Each project is a team. Open one to manage members and reviews.</p>
        </div>
        {canManage && <NewProjectDialog onCreated={refresh} />}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading teams…</div>
      ) : projects.length === 0 ? (
        <div className="text-sm text-slate-500">No teams yet. Create your first project.</div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {projects.map((p) => {
            const team = teamOf(p)
            return (
              <motion.div key={p.id} variants={item}>
                <Link href={`/dashboard/projects/${p.id}`}>
                  <Card className="glass flex h-full flex-col border-none transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base text-slate-900">{p.name}</CardTitle>
                        <Badge className={`border-none capitalize ${statusStyles[p.status] ?? ""}`}>
                          {p.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription className="text-slate-500">
                        {p.department ?? "No department"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-4">
                      <p className="line-clamp-2 text-sm text-slate-500">
                        {p.description ?? "No description provided."}
                      </p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex -space-x-2">
                          {team.slice(0, 4).map(({ user, lead }) => (
                            <div key={user.id} className="relative" title={user.full_name ?? user.email}>
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-xs font-bold text-white ring-2 ring-white">
                                {initials(user)}
                              </div>
                              {lead && (
                                <Crown className="absolute -right-1 -top-1.5 h-3 w-3 fill-amber-400 text-amber-400" />
                              )}
                            </div>
                          ))}
                          {team.length > 4 && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600 ring-2 ring-white">
                              +{team.length - 4}
                            </div>
                          )}
                          {team.length === 0 && (
                            <span className="text-xs text-slate-400">No team yet</span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Users className="h-3.5 w-3.5" /> {team.length}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [department, setDepartment] = useState("")
  const [status, setStatus] = useState("active")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) {
      setErr("Project name is required")
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      await createProject({ name, description, department, status })
      setName("")
      setDescription("")
      setDepartment("")
      setStatus("active")
      setOpen(false)
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create project")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
            <Plus className="h-4 w-4" /> New Team
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Team / Project</DialogTitle>
          <DialogDescription className="text-slate-500">
            You become the team lead. Add members after creating.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile App Launch"
              className="border-slate-200 bg-slate-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this team working on?"
              className="border-slate-200 bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-700">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                className="border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
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
          <DialogClose render={<Button variant="ghost" className="text-slate-500 cursor-pointer">Cancel</Button>} />
          <Button onClick={submit} disabled={submitting} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
            {submitting ? "Creating…" : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
