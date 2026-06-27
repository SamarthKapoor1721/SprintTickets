"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  createReport,
  deleteReport,
  deleteReportAttachment,
  downloadReportAttachment,
  getReportAttachmentUrl,
  getAISummary,
  listProjects,
  listReports,
  listTasks,
  updateReport,
  type Project,
  type Report,
  type ReportAttachment,
  type Task,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
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
import { formatDateOnly, normalizeDateOnly, todayInputValue } from "@/lib/date"
import { FilePreviewModal, isPreviewable } from "@/components/file-preview"
import {
  CalendarDays,
  CheckSquare,
  Clock3,
  Download,
  Edit3,
  Eye,
  FileText,
  Paperclip,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react"

const ACCEPTED_FILES = ".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.csv,.md"

function todayInput() {
  return todayInputValue()
}

function dateInput(value: string | null | undefined) {
  if (!value) return todayInput()
  return normalizeDateOnly(value) || todayInput()
}

function formatDate(value: string) {
  return formatDateOnly(value, { weekday: "short", month: "short", day: "numeric" })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export default function ReportsPage() {
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const canSummarize = role === "ceo" || role === "super_admin" || role === "manager"
  const canCreateReport = role !== "ceo" && role !== "super_admin"

  const [reports, setReports] = useState<Report[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [projectFilter, setProjectFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null)

  const fetchSummary = async () => {
    setAiOpen(true)
    if (aiText) return // use cached until dismissed
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await getAISummary()
      setAiText(result.summary)
      setAiGeneratedAt(result.generated_at)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to generate summary")
    } finally {
      setAiLoading(false)
    }
  }

  const dismissAi = () => {
    setAiOpen(false)
    setAiText(null)
    setAiGeneratedAt(null)
    setAiError(null)
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listReports(projectFilter ? { projectId: Number(projectFilter) } : {}),
      listProjects(),
      listTasks(projectFilter ? { projectId: Number(projectFilter) } : {}),
    ])
      .then(([reportData, projectData, taskData]) => {
        setReports(reportData)
        setProjects(projectData)
        setTasks(taskData)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load daily updates"))
      .finally(() => setLoading(false))
  }, [projectFilter])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const totals = useMemo(() => {
    const today = todayInput()
    return {
      todayReports: reports.filter((report) => dateInput(report.date) === today).length,
      blockers: reports.filter((report) => report.blockers?.trim()).length,
      minutes: reports.reduce((sum, report) => sum + (report.minutes_spent ?? 0), 0),
      attachments: reports.reduce((sum, report) => sum + report.attachments.length, 0),
    }
  }, [reports])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Daily updates</h1>
          <p className="text-slate-500">Structured progress, blockers, time, linked tasks, and uploaded documents.</p>
        </div>
        <div className="flex items-center gap-2">
          {canSummarize && (
            <Button
              onClick={fetchSummary}
              variant="outline"
              className="gap-2 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              AI Summary
            </Button>
          )}
          {canCreateReport && <ReportDialog mode="create" projects={projects} tasks={tasks} onSaved={load} />}
        </div>
      </div>

      {/* AI Summary panel */}
      {aiOpen && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-[13.5px] font-semibold text-violet-900">AI Executive Summary</span>
              {aiGeneratedAt && (
                <span className="text-[11px] text-violet-500">
                  · {new Date(aiGeneratedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <button onClick={dismissAi} className="rounded-lg p-1 text-violet-400 hover:bg-violet-100 hover:text-violet-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 py-4 text-[13px] text-violet-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              Analysing reviews, reports, and tasks…
            </div>
          ) : aiError ? (
            <p className="text-sm text-red-600">{aiError}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-slate-800">
              {aiText?.split("\n").map((line, i) => {
                const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                if (line.startsWith("## ") || line.startsWith("# ")) {
                  return <h3 key={i} className="mt-3 text-[13.5px] font-semibold text-violet-900" dangerouslySetInnerHTML={{ __html: bold.replace(/^#{1,3} /, "") }} />
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return <p key={i} className="ml-3 text-[13px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: `• ${bold.slice(2)}` }} />
                }
                if (!line.trim()) return <div key={i} className="h-1" />
                return <p key={i} className="text-[13px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: bold }} />
              })}
            </div>
          )}
          {aiText && (
            <button
              onClick={() => { setAiText(null); setAiGeneratedAt(null); fetchSummary() }}
              className="mt-3 flex items-center gap-1.5 text-[12px] text-violet-500 hover:text-violet-700 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" /> Regenerate
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Reports" value={reports.length} icon={FileText} />
        <Metric label="Today" value={totals.todayReports} icon={CalendarDays} />
        <Metric label="Blockers" value={totals.blockers} icon={ShieldAlert} tone="red" />
        <Metric label="Minutes logged" value={totals.minutes} icon={Clock3} tone="green" />
      </div>

      <Card className="glass border-none">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 md:w-72"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="text-sm text-slate-400">
            {loading ? "Syncing..." : `${reports.length} updates visible · ${totals.attachments} attachments`}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No daily updates found.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {reports.map((report) => {
            // Only the original submitter can edit or delete their own report.
            // CEO and admin are review-only; managers and employees can still work their own reports.
            const canEdit = report.submitter_id === user?.id && role !== "ceo" && role !== "super_admin"

            return (
              <ReportCard
                key={report.id}
                report={report}
                projects={projects}
                tasks={tasks}
                canEdit={canEdit}
                onSaved={load}
              />
            )
          })}
        </div>
      )}
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
  icon: typeof FileText
  tone?: "blue" | "red" | "green"
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function ReportCard({
  report,
  projects,
  tasks,
  canEdit,
  onSaved,
}: {
  report: Report
  projects: Project[]
  tasks: Task[]
  canEdit: boolean
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busyAttachmentId, setBusyAttachmentId] = useState<number | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<ReportAttachment | null>(null)

  const handleDelete = async () => {
    if (!confirm("Delete this daily update?")) return
    try {
      await deleteReport(report.id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete report")
    }
  }

  const handleDownload = async (attachment: ReportAttachment) => {
    try {
      setBusyAttachmentId(attachment.id)
      await downloadReportAttachment(report.id, attachment)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download attachment")
    } finally {
      setBusyAttachmentId(null)
    }
  }

  const handleDeleteAttachment = async (attachment: ReportAttachment) => {
    if (!confirm(`Remove ${attachment.file_name}?`)) return
    try {
      setBusyAttachmentId(attachment.id)
      await deleteReportAttachment(report.id, attachment.id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove attachment")
    } finally {
      setBusyAttachmentId(null)
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass h-full border-none">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base text-slate-900">{formatDate(report.date)}</CardTitle>
              <CardDescription className="mt-1 text-slate-500">
                {report.submitter?.full_name ?? report.submitter?.email ?? "Unknown"} · {report.project?.name ?? "General"}
              </CardDescription>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <ReportDialog mode="edit" report={report} projects={projects} tasks={tasks} onSaved={onSaved} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  className="h-8 w-8 cursor-pointer text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 md:grid-cols-3">
            <PointerPanel label="Yesterday" items={report.pointers.yesterday} fallback={report.yesterday ?? "No details provided"} />
            <PointerPanel label="Today" items={report.pointers.today} fallback={report.today ?? "Not provided"} />
            <PointerPanel
              label="Blockers"
              items={report.pointers.blockers}
              fallback={report.blockers?.trim() ? report.blockers : "No blockers"}
              danger
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Executive pointers</p>
            {report.pointers.executive.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No extracted pointers yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {report.pointers.executive.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-none bg-emerald-100 text-emerald-700">{report.minutes_spent ?? 0} min</Badge>
            <Badge className="border-none bg-slate-100 text-slate-600">{report.tasks.length} linked tasks</Badge>
            <Badge className="border-none bg-indigo-100 text-indigo-700">{report.attachments.length} files</Badge>
          </div>

          {report.tasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Linked tasks</p>
              <div className="flex flex-wrap gap-2">
                {report.tasks.map((task) => (
                  <Badge key={task.id} className="border-none bg-slate-100 text-slate-600">
                    <CheckSquare className="mr-1 h-3 w-3" />
                    {task.title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {report.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Attachments</p>
              <div className="space-y-2">
                {report.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{attachment.file_name}</p>
                      <p className="text-xs text-slate-400">
                        {attachment.mime_type} · {formatBytes(attachment.size_bytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isPreviewable(attachment.mime_type, attachment.file_name) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewAttachment(attachment)}
                          className="h-8 w-8 cursor-pointer text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(attachment)}
                        className="h-8 w-8 cursor-pointer text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                        disabled={busyAttachmentId === attachment.id}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAttachment(attachment)}
                          className="h-8 w-8 cursor-pointer text-slate-400 hover:bg-red-50 hover:text-red-600"
                          disabled={busyAttachmentId === attachment.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <FilePreviewModal
        file={previewAttachment}
        loadUrl={(f) => getReportAttachmentUrl(report.id, f.id)}
        onClose={() => setPreviewAttachment(null)}
      />
    </motion.div>
  )
}

function PointerPanel({
  label,
  items,
  fallback,
  danger = false,
}: {
  label: string
  items: string[]
  fallback: string
  danger?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      {items.length === 0 ? (
        <p className={`mt-2 text-sm leading-6 ${danger ? "text-red-700" : "text-slate-700"}`}>{fallback}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 4).map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${danger ? "bg-red-500" : "bg-primary"}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportDialog({
  mode,
  report,
  projects,
  tasks,
  onSaved,
}: {
  mode: "create" | "edit"
  report?: Report
  projects: Project[]
  tasks: Task[]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(dateInput(report?.date))
  const [projectId, setProjectId] = useState(report?.project_id ? String(report.project_id) : "")
  const [yesterday, setYesterday] = useState(report?.yesterday ?? "")
  const [today, setToday] = useState(report?.today ?? "")
  const [blockers, setBlockers] = useState(report?.blockers ?? "")
  const [minutes, setMinutes] = useState(report?.minutes_spent != null ? String(report.minutes_spent) : "")
  const [taskIds, setTaskIds] = useState<number[]>(report?.tasks.map((task) => task.id) ?? [])
  const [attachments, setAttachments] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setDate(dateInput(report?.date))
      setProjectId(report?.project_id ? String(report.project_id) : "")
      setYesterday(report?.yesterday ?? "")
      setToday(report?.today ?? "")
      setBlockers(report?.blockers ?? "")
      setMinutes(report?.minutes_spent != null ? String(report.minutes_spent) : "")
      setTaskIds(report?.tasks.map((task) => task.id) ?? [])
      setAttachments([])
      setErr(null)
    }, 0)
    return () => clearTimeout(timer)
  }, [open, report])

  const availableTasks = useMemo(
    () => tasks.filter((task) => !projectId || task.project_id === Number(projectId)),
    [projectId, tasks],
  )

  const toggleTask = (taskId: number) => {
    setTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    )
  }

  const submit = async () => {
    if (!yesterday.trim() && !today.trim() && !blockers.trim()) {
      setErr("Add at least one update field")
      return
    }

    setBusy(true)
    setErr(null)

    const payload = {
      date,
      project_id: projectId ? Number(projectId) : null,
      yesterday: yesterday.trim() || null,
      today: today.trim() || null,
      blockers: blockers.trim() || null,
      minutes_spent: minutes ? Number(minutes) : null,
      task_ids: taskIds,
    }

    try {
      if (mode === "create") {
        await createReport(payload, attachments)
      } else if (report) {
        await updateReport(report.id, payload, attachments)
      }
      setOpen(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save report")
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
              <Plus className="h-4 w-4" />
              New update
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-slate-400">
              <Edit3 className="h-4 w-4" />
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-200 bg-white text-slate-900 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Submit daily update" : "Edit daily update"}</DialogTitle>
          <DialogDescription>
            Capture finished work, today&apos;s plan, blockers, time, tasks, and uploaded documents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-slate-200 bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
            >
              <option value="">General</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <TextBlock label="Yesterday" value={yesterday} onChange={setYesterday} placeholder="What did you finish?" />
          <TextBlock label="Today" value={today} onChange={setToday} placeholder="What are you doing next?" />
          <TextBlock label="Blockers" value={blockers} onChange={setBlockers} placeholder="Anything stuck, waiting, or risky?" />

          <div className="space-y-2">
            <Label>Minutes spent</Label>
            <Input
              type="number"
              min="0"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="border-slate-200 bg-slate-50 md:w-48"
            />
          </div>

          <div className="space-y-2">
            <Label>Linked tasks</Label>
            <div className="grid max-h-44 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-2">
              {availableTasks.length === 0 ? (
                <p className="px-2 py-3 text-sm text-slate-400">No visible tasks for this project.</p>
              ) : (
                availableTasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex cursor-pointer items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={taskIds.includes(task.id)}
                      onChange={() => toggleTask(task.id)}
                      className="mt-1"
                    />
                    <span>{task.title}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upload documents</Label>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500">
                  <Upload className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    type="file"
                    multiple
                    accept={ACCEPTED_FILES}
                    onChange={(e) => setAttachments(Array.from(e.target.files ?? []))}
                    className="border-slate-200 bg-white"
                  />
                  <p className="text-xs text-slate-400">
                    Add PDF, Word, spreadsheet, text, or presentation files. Files are stored in Postgres and can be downloaded later.
                  </p>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file) => (
                        <Badge key={`${file.name}-${file.size}`} className="border-none bg-slate-100 text-slate-600">
                          <Paperclip className="mr-1 h-3 w-3" />
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" className="cursor-pointer text-slate-500">Cancel</Button>} />
          <Button onClick={submit} disabled={busy} className="cursor-pointer bg-primary text-white hover:bg-primary/90">
            {busy ? "Saving..." : "Save update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TextBlock({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-24 border-slate-200 bg-slate-50"
      />
    </div>
  )
}
