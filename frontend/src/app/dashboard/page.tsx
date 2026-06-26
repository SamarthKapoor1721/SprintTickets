"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, AlertCircle, ChevronRight, CheckCircle2, FolderKanban, LucideIcon } from "lucide-react"
import { listProjects, listReviews, type Project, type Review } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  needs_changes: "bg-orange-100 text-orange-700",
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tint,
}: {
  label: string
  value: number | string
  hint?: string
  icon: LucideIcon
  tint: string
}) {
  return (
    <motion.div variants={item}>
      <Card className="glass border-none">
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ReviewRow({ r }: { r: Review }) {
  return (
    <Link
      href={`/dashboard/reviews/${r.id}`}
      className="flex items-center justify-between p-5 transition-colors hover:bg-slate-50 group cursor-pointer"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-slate-900">{r.title}</span>
          {r.priority === "critical" && (
            <Badge className="border-none bg-red-100 text-red-700">Critical</Badge>
          )}
          <Badge className={`border-none ${statusStyles[r.status] ?? ""}`}>
            {r.status.replace("_", " ")}
          </Badge>
        </div>
        <span className="text-sm text-slate-500">
          {r.submitter?.full_name ? `Submitted by ${r.submitter.full_name}` : "Submitted"}
          {r.submitter?.department ? ` · ${r.submitter.department}` : ""}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const [reviews, setReviews] = useState<Review[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listReviews(), listProjects()])
      .then(([r, p]) => {
        setReviews(r)
        setProjects(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pending = reviews.filter((r) => r.status === "pending")
  const approved = reviews.filter((r) => r.status === "approved")
  const urgent = pending.filter((r) => r.priority === "critical" || r.priority === "high")

  const titles: Record<string, string> = {
    ceo: "CEO Dashboard",
    manager: "Manager Dashboard",
    employee: "Employee Dashboard",
  }
  const descriptions: Record<string, string> = {
    ceo: "System overview and pending executive approvals.",
    manager: "Manage your team's projects and track CEO approvals.",
    employee: "View your assigned projects and submit work for review.",
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{titles[role]}</h1>
          <p className="text-slate-500">{descriptions[role]}</p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex">
          <Clock className="h-4 w-4" />
          <span>{loading ? "Syncing…" : "Live data"}</span>
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <Stat label="Pending Reviews" value={pending.length} hint="Awaiting decision" icon={Clock} tint="bg-amber-100 text-amber-600" />
        <Stat label="Urgent" value={urgent.length} hint={urgent.length ? "High / critical priority" : "Nothing urgent"} icon={AlertCircle} tint="bg-red-100 text-red-600" />
        <Stat label="Approved" value={approved.length} hint="Total approved" icon={CheckCircle2} tint="bg-emerald-100 text-emerald-600" />
        <Stat
          label={role === "employee" ? "My Reviews" : "Projects"}
          value={role === "employee" ? reviews.length : projects.length}
          icon={FolderKanban}
          tint="bg-blue-100 text-blue-600"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="glass border-none">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-lg text-slate-900">
                {role === "ceo" ? "Needs Your Review" : role === "manager" ? "Team Submissions" : "My Recent Activity"}
              </CardTitle>
              <CardDescription className="text-slate-500">
                {pending.length > 0
                  ? `${pending.length} review${pending.length === 1 ? "" : "s"} pending.`
                  : "Nothing pending right now."}
              </CardDescription>
            </div>
            {role === "employee" && (
              <Link href="/dashboard/reviews/new">
                <Button className="bg-primary text-white hover:bg-primary/90 cursor-pointer">Submit New</Button>
              </Link>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading…</div>
            ) : reviews.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No reviews yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(pending.length > 0 ? pending : reviews).slice(0, 6).map((r) => (
                  <ReviewRow key={r.id} r={r} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {approved.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="glass border-none">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                Recently Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {approved.slice(0, 5).map((r) => (
                  <ReviewRow key={r.id} r={r} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
