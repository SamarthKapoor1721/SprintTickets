"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  listReports,
  listProjects,
  createReport,
  type Report,
  type Project
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([listReports(), listProjects()])
      .then(([r, p]) => {
        setReports(r)
        setProjects(p)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reports"))
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
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Daily Reports</h1>
          <p className="text-slate-500">Track daily progress and updates from your team.</p>
        </div>
        <ReportDialog onSaved={load} projects={projects} />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="text-sm text-slate-500">No reports found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="glass flex h-full flex-col border-none transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base text-slate-900">
                      {new Date(r.date).toLocaleDateString()}
                    </CardTitle>
                    <div className="text-xs font-medium text-slate-500">
                      {r.submitter?.full_name ?? r.submitter?.email ?? "Unknown"}
                    </div>
                  </div>
                  <CardDescription className="text-slate-500">
                    {r.project?.name ?? "General Update"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {r.content}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportDialog({ 
  projects, 
  onSaved 
}: { 
  projects: Project[], 
  onSaved: () => void 
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [projectId, setProjectId] = useState<string>("")
  
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!content.trim() || !date) {
      setErr("Content and date are required")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await createReport({
        content,
        date: new Date(date).toISOString(),
        project_id: projectId ? Number(projectId) : undefined
      })
      setOpen(false)
      setContent("")
      setProjectId("")
      setDate(new Date().toISOString().split('T')[0])
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create report")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2 bg-primary text-white hover:bg-primary/90 cursor-pointer">
            <Plus className="h-4 w-4" /> New Report
          </Button>
        }
      />
      <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Daily Report</DialogTitle>
          <DialogDescription>
            Share your progress, blockers, and plans for tomorrow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-slate-700">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-slate-200 bg-slate-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Project (Optional)</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
            >
              <option value="">General (No specific project)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="- Completed X&#10;- Blocked by Y&#10;- Planning to do Z"
              className="min-h-[150px] border-slate-200 bg-slate-50"
            />
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
            {busy ? "Submitting…" : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
