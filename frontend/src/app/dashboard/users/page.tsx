"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Building2,
  ChevronRight,
  Mail,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createUser, listUsers, type Role, type User } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
}

const roleStyles: Record<Role, string> = {
  super_admin: "bg-slate-900 text-white",
  ceo: "bg-blue-100 text-blue-700",
  manager: "bg-violet-100 text-violet-700",
  employee: "bg-slate-100 text-slate-600",
}

const statusStyles = {
  active: "bg-emerald-100 text-emerald-700",
  disabled: "bg-slate-100 text-slate-500",
}

function initials(user: User) {
  return (user.full_name ?? user.email).slice(0, 1).toUpperCase()
}

function normalize(value: string) {
  return value.trim().length > 0 ? value.trim() : undefined
}

function matchesQuery(user: User, query: string) {
  if (!query) return true
  const haystack = [user.full_name, user.email, user.department, user.role]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const role = me?.role ?? "employee"
  const canManageUsers = role === "super_admin" || role === "ceo"
  const canOpenProfiles = canManageUsers

  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      load()
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const filteredUsers = users.filter((user) => matchesQuery(user, query.toLowerCase()))

  const stats = {
    total: users.length,
    active: users.filter((user) => user.is_active).length,
    leaders: users.filter((user) => user.role === "super_admin" || user.role === "ceo" || user.role === "manager").length,
    employees: users.filter((user) => user.role === "employee").length,
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-slate-400">People directory</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Users & access</h1>
          <p className="max-w-2xl text-slate-500">
            Super admins and CEOs can open profiles, edit accounts, and resend onboarding.
            Managers can still review the roster.
          </p>
        </div>
        {canManageUsers && <CreateUserDialog onSaved={load} currentRole={role} />}
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Total people" value={stats.total} hint="All visible accounts" icon={Users} />
        <StatCard label="Active" value={stats.active} hint="Accounts enabled" icon={Shield} />
        <StatCard label="Leaders" value={stats.leaders} hint="Super admins, CEOs, managers" icon={UserPlus} />
        <StatCard label="Employees" value={stats.employees} hint="Non-lead contributors" icon={Building2} />
      </motion.div>

      <Card className="glass overflow-hidden border-none">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-lg text-slate-900">Workspace directory</CardTitle>
              <CardDescription className="text-slate-500">
                {filteredUsers.length} visible of {users.length} total users.
              </CardDescription>
            </div>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, department, role..."
                className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : loading ? (
            <div className="p-6 text-sm text-slate-500">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No matching users found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <UserRow key={user.id} user={user} canOpenProfile={canOpenProfiles} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: number
  hint: string
  icon: LucideIcon
}) {
  return (
    <motion.div variants={item}>
      <Card className="glass border-none">
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{hint}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function UserRow({
  user,
  canOpenProfile,
}: {
  user: User
  canOpenProfile: boolean
}) {
  const content = (
    <div className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-sm font-semibold text-white shadow-sm shadow-primary/20">
          {initials(user)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-900">
              {user.full_name ?? "Unnamed user"}
            </span>
            <Badge className={`border-none capitalize ${roleStyles[user.role] ?? ""}`}>
              {user.role.replace("_", " ")}
            </Badge>
            <Badge
              className={`border-none capitalize ${
                user.is_active ? statusStyles.active : statusStyles.disabled
              }`}
            >
              {user.is_active ? "active" : "disabled"}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              {user.department ?? "No department"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">
          {canOpenProfile ? "Open profile" : "Roster view"}
        </span>
        {canOpenProfile && <ChevronRight className="h-4 w-4 text-slate-300" />}
      </div>
    </div>
  )

  if (!canOpenProfile) {
    return <div>{content}</div>
  }

  return (
    <Link href={`/dashboard/users/${user.id}`} className="block">
      {content}
    </Link>
  )
}

function CreateUserDialog({
  onSaved,
  currentRole,
}: {
  onSaved: () => void
  currentRole: Role
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [department, setDepartment] = useState("")
  const [role, setRole] = useState<Role>("employee")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [invite, setInvite] = useState<{
    link: string
    email: string
    emailSent: boolean
    emailError: string | null
  } | null>(null)

  const submit = async () => {
    if (!email.trim()) {
      setErr("Email is required")
      return
    }

    setBusy(true)
    setErr(null)
    try {
      const created = await createUser({
        email: email.trim(),
        full_name: normalize(fullName),
        department: normalize(department),
        role,
      })

      setInvite({
        link: created.onboardingUrl,
        email: created.email,
        emailSent: created.emailSent,
        emailError: created.emailError,
      })
      setEmail("")
      setFullName("")
      setDepartment("")
      setRole("employee")
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create user")
    } finally {
      setBusy(false)
    }
  }

  if (invite) {
    return (
      <Dialog
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setInvite(null)
            setOpen(false)
          }
        }}
      >
        <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{invite.emailSent ? "Invitation sent" : "User created"}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {invite.emailSent
                ? `The onboarding link was emailed to ${invite.email}.`
                : invite.emailError
                  ? `The user was created, but email delivery failed: ${invite.emailError}`
                  : `Share this onboarding link with ${invite.email}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label>Onboarding link</Label>
            <div className="flex gap-2">
              <Input readOnly value={invite.link} className="bg-slate-50" />
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(invite.link)}
                className="cursor-pointer"
              >
                Copy
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setInvite(null)
                setOpen(false)
              }}
              className="bg-primary text-white cursor-pointer hover:bg-primary/90"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 rounded-xl bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary/90 cursor-pointer">
            <UserPlus className="h-4 w-4" />
            New user
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription className="text-slate-500">
            Add a new manager or employee to the workspace. Super admins can also create CEOs.
          </DialogDescription>
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-700">Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                className="border-slate-200 bg-slate-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              {currentRole === "super_admin" && <option value="ceo">CEO</option>}
            </select>
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
            {busy ? "Creating..." : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
