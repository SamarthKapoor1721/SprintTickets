"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import {
  listUsers,
  createUser,
  deleteUser,
  type Role,
  type User
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  DialogClose
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAppBaseUrl } from "@/lib/site"
import { Trash2, UserPlus } from "lucide-react"

export default function UsersPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  
  // Only super_admin, ceo, manager can view users (per backend).
  // Only super_admin, ceo can create/delete.
  const canManage = role === "ceo" || role === "super_admin"

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
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

  // Hide page if employee
  if (role === "employee") {
    return <div className="text-sm text-slate-500">You do not have access to view users.</div>
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Users</h1>
          <p className="text-slate-500">Manage directory and system access.</p>
        </div>
        {canManage && <UserDialog onSaved={load} currentRole={role} />}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading users…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => {
            const canDelete = (role === "super_admin" && u.id !== user?.id) || 
                              (role === "ceo" && (u.role === "manager" || u.role === "employee") && u.id !== user?.id)
            return (
              <motion.div key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="glass flex h-full flex-col border-none transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base text-slate-900">
                        {u.full_name ?? "Unnamed"}
                      </CardTitle>
                      <Badge className="border-none capitalize bg-slate-100 text-slate-700">
                        {u.role.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardDescription className="text-slate-500">
                      {u.email}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between mt-auto pt-2">
                    <span className="text-xs text-slate-400">{u.department ?? "No department"}</span>
                    {canDelete && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UserDialog({ 
  onSaved,
  currentRole
}: { 
  onSaved: () => void,
  currentRole: Role
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [department, setDepartment] = useState("")
  const [role, setRole] = useState<Role>("employee")
  
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [magicLink, setMagicLink] = useState<string | null>(null)

  const submit = async () => {
    if (!email.trim()) {
      setErr("Email is required")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const newUser = await createUser({
        email,
        full_name: fullName,
        department,
        role
      })
      const link = new URL("/auth/onboard", getAppBaseUrl())
      link.searchParams.set("token", newUser.onboardingToken)
      const magicUrl = link.toString()
      setMagicLink(magicUrl)
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

  if (magicLink) {
    return (
      <Dialog open={true} onOpenChange={(val) => { if (!val) { setMagicLink(null); setOpen(false); }}}>
        <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Created!</DialogTitle>
            <DialogDescription>
              Share this magic link with the user so they can activate their account and set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Magic Link</Label>
            <div className="flex gap-2">
              <Input readOnly value={magicLink} className="bg-slate-50" />
              <Button onClick={() => navigator.clipboard.writeText(magicLink)} variant="outline" className="cursor-pointer">
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setMagicLink(null); setOpen(false); }} className="bg-primary text-white cursor-pointer">
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
          <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
            <UserPlus className="h-4 w-4" /> New User
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Add a new manager or employee to the workspace.
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
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
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
          <Button onClick={submit} disabled={busy} className="bg-primary text-white hover:bg-primary/90 cursor-pointer">
            {busy ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
