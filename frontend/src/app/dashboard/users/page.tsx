"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import {
  listUsers,
  createUser,
  deleteUser,
  type Role,
  type User,
  type UserInvite,
} from "@/lib/api"
import { TEAMS } from "@/lib/teams"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, Pencil, Trash2, UserPlus, Users, Copy, ExternalLink } from "lucide-react"

const ROLE_COLORS: Record<string, string> = {
  ceo: "bg-blue-100 text-blue-700",
  manager: "bg-violet-100 text-violet-700",
  employee: "bg-slate-100 text-slate-600",
  super_admin: "bg-amber-100 text-amber-700",
}

type InviteNotice = {
  kind: "success" | "warning"
  title: string
  description: string
  link: string
}

type InviteResult = {
  email?: string
  emailSent?: boolean
  emailError?: string | null
  onboardingUrl?: string | null
}

type UserGroup = {
  label: string
  members: User[]
}

function getUserCategory(user: User) {
  const dept = user.department?.trim()
  if (user.role === "ceo" || dept?.toLowerCase() === "ai pm") {
    return "CEO"
  }
  return dept || "Other"
}

export default function UsersPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"

  const canViewProfiles = role === "ceo" || role === "super_admin"
  const canCreateUsers = role === "super_admin" || role === "ceo" || role === "manager"
  const canEditUsers = role === "super_admin"

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteNotice, setInviteNotice] = useState<InviteNotice | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("All")

  const load = useCallback(() => {
    setLoading(true)
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const handleDelete = async (targetId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      await deleteUser(targetId)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete user")
    }
  }

  const showInviteNotice = (result: InviteResult) => {
    if (!result.onboardingUrl) {
      return
    }

    setInviteNotice({
      kind: result.emailSent ? "success" : "warning",
      title: result.emailSent ? "Invitation sent" : "Invite link ready",
      description: result.emailSent
        ? `The invite email was sent to ${result.email ?? "the user"} and the link is available below.`
        : result.emailError ??
          "Email delivery is not configured, but the invite link is available below.",
      link: result.onboardingUrl,
    })
  }

  const handleCreateUser = (result: UserInvite) => {
    showInviteNotice(result)
    load()
  }

  if (role === "employee") {
    return <div className="text-sm text-slate-500">You do not have access to view users.</div>
  }

  const visibleUsers = role === "ceo" ? users.filter((u) => u.role !== "super_admin") : users

  const groupedMap = new Map<string, User[]>()
  for (const u of visibleUsers) {
    const label = getUserCategory(u)
    const members = groupedMap.get(label) ?? []
    members.push(u)
    groupedMap.set(label, members)
  }

  const groups: UserGroup[] = Array.from(groupedMap.entries())
    .map(([label, members]) => ({
      label,
      members: [...members].sort((a, b) =>
        (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
      ),
    }))
    .sort((a, b) => {
      if (a.label === "CEO") return -1
      if (b.label === "CEO") return 1
      if (a.label === "Other") return 1
      if (b.label === "Other") return -1
      return a.label.localeCompare(b.label)
    })

  const categoryCounts = groups.map((group) => ({ label: group.label, count: group.members.length }))
  const selectedGroups = activeCategory === "All"
    ? groups
    : groups.filter((group) => group.label === activeCategory)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Users</h1>
          <p className="text-slate-500">Manage directory and system access.</p>
        </div>
        {canCreateUsers && <UserDialog onCreated={handleCreateUser} currentRole={role} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={activeCategory === "All" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory("All")}
          className="rounded-full"
        >
          All
          <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px] leading-none">
            {visibleUsers.length}
          </span>
        </Button>
        {categoryCounts.map(({ label, count }) => (
          <Button
            key={label}
            type="button"
            variant={activeCategory === label ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(label)}
            className="rounded-full"
          >
            {label}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px] leading-none">
              {count}
            </span>
          </Button>
        ))}
      </div>

      {inviteNotice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            inviteNotice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{inviteNotice.title}</p>
              <p className={inviteNotice.kind === "success" ? "text-emerald-700" : "text-amber-700"}>
                {inviteNotice.description}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(inviteNotice.link)}
                className="cursor-pointer border-white/70 bg-white text-slate-700 hover:bg-white"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </Button>
              <a
                href={inviteNotice.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-white/70 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-white/90"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open invite
              </a>
              <Button
                variant="ghost"
                onClick={() => setInviteNotice(null)}
                className="cursor-pointer text-slate-500 hover:bg-white/70"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-slate-500">No users found.</div>
      ) : (
        <div className="flex flex-col gap-8">
          {selectedGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
              No users found in this category.
            </div>
          ) : (
            selectedGroups.map(({ label, members }) => (
              <section key={label}>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                <h2 className="text-[14px] font-semibold text-slate-800">{label}</h2>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f1f5f9] px-1.5 text-[11px] font-semibold text-slate-500">
                  {members.length}
                </span>
                <div className="h-px flex-1 bg-[#eef2f7]" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#eef2f7] bg-white">
                {members.map((u, i) => {
                  const canDelete =
                    (role === "super_admin" || role === "ceo") && u.id !== user?.id
                  return (
                    <motion.div
                      key={u.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f8fafc] ${
                        i > 0 ? "border-t border-[#f1f5f9]" : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-[13px] font-semibold text-white">
                        {(u.full_name ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                      </div>

                      {/* Name + email */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-slate-900">
                          {u.full_name ?? "Unnamed"}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <p className="truncate text-[12.5px] text-slate-400">
                            {u.email} · #{u.employee_id}
                          </p>
                        </div>
                      </div>

                      {/* Role */}
                      <Badge
                        className={`hidden shrink-0 border-none capitalize sm:inline-flex ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {u.role.replace("_", " ")}
                      </Badge>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        {canViewProfiles && (
                          <>
                            <Link
                              href={`/dashboard/users/${u.id}`}
                              title="View"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {canEditUsers && (
                              <Link
                                href={`/dashboard/users/${u.id}?edit=1`}
                                title="Edit"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            )}
                          </>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(u.id)}
                            title="Delete"
                            className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </section>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function UserDialog({
  onCreated,
  currentRole,
}: {
  onCreated: (result: UserInvite) => void
  currentRole: Role
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [department, setDepartment] = useState("")
  const [role, setRole] = useState<Role>("employee")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const closeCreateDialog = () => {
    setOpen(false)
    setErr(null)
  }

  const roleOptions: Role[] =
    currentRole === "super_admin"
      ? ["employee", "manager", "ceo"]
      : currentRole === "ceo"
        ? ["employee", "manager"]
        : ["employee"]

  const submit = async () => {
    if (!email.trim()) {
      setErr("Email is required")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const newUser = await createUser({ email, full_name: fullName, department, role })
      onCreated(newUser)
      setEmail("")
      setFullName("")
      setDepartment("")
      setRole("employee")
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create user")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
            <UserPlus className="h-4 w-4" /> New User
          </Button>
        }
      />
      <DialogContent
        showCloseButton={false}
        onClose={closeCreateDialog}
        className="border-slate-200 bg-white text-slate-900 sm:max-w-md"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={closeCreateDialog}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Add a new member to the workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="border-slate-200 bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-700">Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Team</Label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
              >
                <option value="">Select team…</option>
                {TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={closeCreateDialog}
            className="text-slate-500 cursor-pointer"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
            {busy ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
