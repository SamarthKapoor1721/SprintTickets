"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  ListTodo,
  ShieldAlert,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getDashboardSummary, type DashboardSummary, type Task, type TaskStatus } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const statusLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
}

const statusStyles: Record<TaskStatus, string> = {
  backlog: "bg-slate-100 text-slate-600",
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-indigo-100 text-indigo-700",
  blocked: "bg-red-100 text-red-700",
  done: "bg-emerald-100 text-emerald-700",
}

const priorityStyles = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-600",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No due date"
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  const title = {
    super_admin: "Company work control",
    ceo: "CEO work control",
    manager: "Team delivery control",
    employee: "My work today",
  }[role]

  const description = {
    super_admin: "Global delivery visibility across teams, blockers, reports, and sprints.",
    ceo: "Company-wide work health, blocked items, overdue tasks, and daily report coverage.",
    manager: "Owned team progress, sprint health, blockers, and update completion.",
    employee: "Assigned tasks, due work, blockers, and your daily update status.",
  }[role]

  const completion = useMemo(() => {
    if (!summary || summary.metrics.total_tasks === 0) return 0
    return Math.round(((summary.tasks_by_status.done ?? 0) / summary.metrics.total_tasks) * 100)
  }, [summary])

  if (loading) return <div className="text-sm text-slate-500">Loading dashboard...</div>

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Dashboard unavailable"}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-slate-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/tasks">
            <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
              <ListTodo className="h-4 w-4" />
              Open board
            </Button>
          </Link>
          <Link href="/dashboard/reports">
            <Button variant="outline" className="gap-2 border-slate-200 bg-white cursor-pointer">
              <FileText className="h-4 w-4" />
              Daily updates
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Projects" value={summary.metrics.projects} icon={FolderKanban} />
        <Metric label="Total tasks" value={summary.metrics.total_tasks} icon={ListTodo} />
        <Metric label="Blocked" value={summary.metrics.blocked_tasks} icon={ShieldAlert} tone="red" />
        <Metric label="Missing updates" value={summary.metrics.missing_reports} icon={Users} tone="amber" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="glass border-none">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-900">Work distribution</CardTitle>
            <CardDescription className="text-slate-500">
              {completion}% complete across visible tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {(Object.keys(statusLabels) as TaskStatus[]).map((status) => {
              const count = summary.tasks_by_status[status] ?? 0
              const width = summary.metrics.total_tasks > 0 ? Math.max(4, (count / summary.metrics.total_tasks) * 100) : 0
              return (
                <div key={status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{statusLabels[status]}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="glass border-none">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-900">Sprint pulse</CardTitle>
            <CardDescription className="text-slate-500">
              {summary.metrics.active_sprints} active sprint{summary.metrics.active_sprints === 1 ? "" : "s"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {summary.active_sprints.length === 0 ? (
              <p className="text-sm text-slate-400">No active sprints.</p>
            ) : (
              summary.active_sprints.slice(0, 4).map((sprint) => (
                <Link key={sprint.id} href={`/dashboard/projects/${sprint.project_id}`} className="block rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 transition hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900">{sprint.name}</span>
                    <Badge className="border-none bg-emerald-100 text-emerald-700">{sprint.task_count} tasks</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{sprint.project?.name ?? `Project #${sprint.project_id}`}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <TaskList title="Blocked work" description="Items that need attention." tasks={summary.blocked_tasks} empty="No blocked tasks." />
        <TaskList title="Overdue work" description="Visible tasks past due and not done." tasks={summary.overdue_tasks} empty="No overdue work." />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="glass border-none">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-900">Recent work</CardTitle>
            <CardDescription className="text-slate-500">Latest visible task activity.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {summary.recent_tasks.length === 0 ? (
              <Empty text="No recent tasks." />
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.recent_tasks.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-none">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-900">Daily update coverage</CardTitle>
            <CardDescription className="text-slate-500">
              {summary.metrics.reports_today} submitted today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {summary.missing_reports.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                All expected updates are in.
              </div>
            ) : (
              <div className="space-y-2">
                {summary.missing_reports.slice(0, 6).map((person) => (
                  <div key={person.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700">{person.full_name ?? person.email}</span>
                    <Badge className="border-none bg-amber-100 text-amber-700">missing</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {summary.recent_reports.slice(0, 3).map((report) => (
                <Link key={report.id} href="/dashboard/reports" className="block rounded-xl border border-slate-100 px-3 py-2 transition hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">{report.submitter?.full_name ?? report.submitter?.email ?? "Unknown"}</span>
                    <span className="text-xs text-slate-400">{new Date(report.date).toLocaleDateString()}</span>
                  </div>
                  {report.pointers.executive.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {report.pointers.executive.slice(0, 2).map((pointer) => (
                        <Badge key={pointer} className="border-none bg-slate-100 text-slate-600">
                          {pointer}
                        </Badge>
                      ))}
                      {report.attachments.length > 0 && (
                        <Badge className="border-none bg-indigo-100 text-indigo-700">{report.attachments.length} files</Badge>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{report.today ?? report.content}</p>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string
  value: number
  icon: typeof FolderKanban
  tone?: "blue" | "red" | "amber"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass border-none">
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TaskList({ title, description, tasks, empty }: { title: string; description: string; tasks: Task[]; empty: string }) {
  return (
    <Card className="glass border-none">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="text-lg text-slate-900">{title}</CardTitle>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <Empty text={empty} />
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TaskRow({ task }: { task: Task }) {
  return (
    <Link href="/dashboard/tasks" className="flex items-center justify-between gap-4 p-4 transition hover:bg-slate-50">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-slate-900">{task.title}</span>
          <Badge className={`border-none capitalize ${statusStyles[task.status]}`}>
            {statusLabels[task.status]}
          </Badge>
          <Badge className={`border-none capitalize ${priorityStyles[task.priority]}`}>
            {task.priority}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {task.project?.name ?? `Project #${task.project_id}`} · {task.assignee?.full_name ?? task.assignee?.email ?? "Unassigned"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
        <span>{formatDate(task.due_date)}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="p-6 text-sm text-slate-400">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        {text}
      </div>
    </div>
  )
}
