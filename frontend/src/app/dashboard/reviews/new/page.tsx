"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ExternalLink, FileUp, Link as LinkIcon, Send, Upload, X } from "lucide-react"
import { createReview, listProjects, listUsers, type Project, type User } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

interface AttachmentItem {
  file: File
  url: string  // stable object URL
}

const selectClass =
  "h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
const inputClass =
  "h-11 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"

export default function NewReviewPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<AttachmentItem[]>([])
  const [undoTimer, setUndoTimer] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const attachInputRef = useRef<HTMLInputElement>(null)

  // CEO / admin are reviewers — redirect them away from the submission form
  useEffect(() => {
    if (!loading && user) {
      const role = user.role
      if (role === "ceo" || role === "super_admin") {
        router.replace("/dashboard/reviews/pending")
      }
    }
  }, [loading, user, router])

  // Revoke object URLs when component unmounts
  useEffect(() => {
    return () => attachedFiles.forEach((a) => URL.revokeObjectURL(a.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [form, setForm] = useState({
    project_id: "",
    review_type: "",
    title: "",
    summary: "",
    website_url: "",
    figma_link: "",
    github_repo: "",
    documentation_link: "",
    priority: "medium",
    reviewer_id: "",
  })

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]))
    listUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  const executeSubmit = async () => {
    setUndoTimer(null)
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("title", form.title)
      if (form.summary) formData.append("summary", form.summary)
      if (form.review_type) formData.append("review_type", form.review_type)
      if (form.priority) formData.append("priority", form.priority)
      if (form.website_url) formData.append("website_url", form.website_url)
      if (form.figma_link) formData.append("figma_link", form.figma_link)
      if (form.github_repo) formData.append("github_repo", form.github_repo)
      if (form.documentation_link) formData.append("documentation_link", form.documentation_link)
      if (form.project_id) formData.append("project_id", form.project_id)
      if (form.reviewer_id) formData.append("reviewer_id", form.reviewer_id)
      
      attachedFiles.forEach(a => {
        formData.append("attachments", a.file)
      })

      await createReview(formData)
      router.push("/dashboard/reviews/pending")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review")
      setSubmitting(false)
    }
  }

  const submit = () => {
    if (!form.title.trim()) {
      setError("A review title is required.")
      return
    }
    // Start undo timer
    let count = 5
    setCountdown(count)
    const interval = setInterval(() => {
      count--
      setCountdown(count)
    }, 1000)

    const timer = window.setTimeout(() => {
      clearInterval(interval)
      executeSubmit()
    }, 5000)
    
    setUndoTimer(timer)
  }

  const cancelSubmit = () => {
    if (undoTimer) {
      clearTimeout(undoTimer)
      setUndoTimer(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-3xl space-y-8 py-2"
    >
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create Review Request</h1>
        <p className="text-slate-500">Submit a new project milestone for executive approval.</p>
      </div>

      {(() => {
        const ceos = users.filter((u) => u.role === "ceo")
        const managers = users.filter((u) => u.role === "manager")
        return (
      <div className="grid gap-6">
        <Card className="glass border-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-900">Core Details</CardTitle>
            <CardDescription className="text-slate-500">Basic information about the submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project" className="text-slate-700">Project / Team</Label>
                <select id="project" value={form.project_id} onChange={(e) => set("project_id", e.target.value)} className={selectClass}>
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reviewer" className="text-slate-700">Send To (Reviewer)</Label>
                <select id="reviewer" value={form.reviewer_id} onChange={(e) => set("reviewer_id", e.target.value)} className={selectClass}>
                  <option value="">Any Manager or CEO</option>
                  {ceos.length > 0 && (
                    <optgroup label="CEOs">
                      {ceos.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                      ))}
                    </optgroup>
                  )}
                  {managers.length > 0 && (
                    <optgroup label="Managers">
                      {managers.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-slate-700">Review Type</Label>
                <select id="type" value={form.review_type} onChange={(e) => set("review_type", e.target.value)} className={selectClass}>
                  <option value="">Select review type</option>
                  <option value="website">Website Review</option>
                  <option value="tech">Tech Architecture</option>
                  <option value="design">Design Approval</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-700">Review Title</Label>
                <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} placeholder="e.g. Final Design Approval for Apollo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-slate-700">Priority</Label>
                <select id="priority" value={form.priority} onChange={(e) => set("priority", e.target.value)} className={selectClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary" className="text-slate-700">Executive Summary</Label>
              <Textarea
                id="summary"
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                placeholder="Provide a brief summary of what is being reviewed and why..."
                className="min-h-[120px] resize-none border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-900">Deliverables & Links</CardTitle>
            <CardDescription className="text-slate-500">Provide all necessary resources for the CEO.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="url" className="flex items-center gap-2 text-slate-700"><LinkIcon className="h-3 w-3" /> Staging URL</Label>
                <Input id="url" value={form.website_url} onChange={(e) => set("website_url", e.target.value)} className={inputClass} placeholder="https://staging.example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="figma" className="flex items-center gap-2 text-slate-700"><LinkIcon className="h-3 w-3" /> Figma Link</Label>
                <Input id="figma" value={form.figma_link} onChange={(e) => set("figma_link", e.target.value)} className={inputClass} placeholder="https://figma.com/file/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github" className="flex items-center gap-2 text-slate-700"><LinkIcon className="h-3 w-3" /> GitHub PR</Label>
                <Input id="github" value={form.github_repo} onChange={(e) => set("github_repo", e.target.value)} className={inputClass} placeholder="https://github.com/org/repo/pull/1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docs" className="flex items-center gap-2 text-slate-700"><FileUp className="h-3 w-3" /> Documentation</Label>
                <Input id="docs" value={form.documentation_link} onChange={(e) => set("documentation_link", e.target.value)} className={inputClass} placeholder="Notion, Confluence, etc." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card className="glass border-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-slate-900">Attachments</CardTitle>
            <CardDescription className="text-slate-500">
              Upload supporting documents, designs, or reference files for the reviewer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Drop zone */}
            <div
              onClick={() => attachInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const items = Array.from(e.dataTransfer.files).map((file) => ({
                  file,
                  url: URL.createObjectURL(file),
                }))
                setAttachedFiles((prev) => [...prev, ...items])
              }}
              className={`cursor-pointer rounded-[10px] border-2 border-dashed p-8 text-center transition-all select-none ${
                dragOver
                  ? "border-primary/50 bg-[#f0f5ff]"
                  : "border-[#e2e8f0] bg-[#f8fafc] hover:border-primary/30 hover:bg-[#f5f8ff]"
              }`}
            >
              <Upload className="mx-auto mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
              <p className="text-sm font-medium text-slate-500">Drop files here or click to browse</p>
              <p className="mt-1 text-xs text-slate-400">PDF, DOCX, PNG, JPG — any format accepted</p>
            </div>
            <input
              ref={attachInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const items = Array.from(e.target.files ?? []).map((file) => ({
                  file,
                  url: URL.createObjectURL(file),
                }))
                setAttachedFiles((prev) => [...prev, ...items])
                e.target.value = ""
              }}
            />

            {/* File list */}
            {attachedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachedFiles.map((a, i) => {
                  const isImg = a.file.type.startsWith("image/")
                  const sizeLabel = a.file.size < 1024 * 1024
                    ? `${(a.file.size / 1024).toFixed(1)} KB`
                    : `${(a.file.size / (1024 * 1024)).toFixed(1)} MB`
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 overflow-hidden rounded-[8px] border border-[#eef2f7] bg-white"
                    >
                      {/* Thumbnail (image) or icon */}
                      {isImg ? (
                        <img
                          src={a.url}
                          alt={a.file.name}
                          className="h-14 w-14 flex-shrink-0 object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center bg-[#f5f7fa]">
                          <FileUp className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 py-1">
                        <p className="truncate text-[13px] font-medium text-slate-700">{a.file.name}</p>
                        <p className="text-[11px] text-slate-400">{sizeLabel}</p>
                      </div>

                      {/* Preview / open */}
                      <button
                        type="button"
                        onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
                        aria-label="Preview file"
                        title="Open preview"
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] text-slate-400 transition-colors hover:bg-[#eef4ff] hover:text-primary cursor-pointer"
                      >
                        <ExternalLink className="h-4 w-4" strokeWidth={1.9} />
                      </button>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(a.url)
                          setAttachedFiles((prev) => prev.filter((_, j) => j !== i))
                        }}
                        aria-label="Remove file"
                        className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
                      >
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pb-12">
          {undoTimer ? (
            <div className="flex items-center gap-4 rounded-xl bg-slate-900 px-6 py-2.5 text-white shadow-lg animate-in slide-in-from-bottom-4">
              <span className="text-sm font-medium">Submitting in {countdown}s...</span>
              <Button
                variant="ghost"
                onClick={cancelSubmit}
                className="h-8 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                Undo
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => router.push("/dashboard")}
                className="h-11 px-6 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={submitting}
                className="flex h-11 items-center gap-2 rounded-xl bg-primary px-8 text-white shadow-sm shadow-primary/20 hover:bg-primary/90 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit Review"}
              </Button>
            </>
          )}
        </div>
      </div>
        )
      })()}
    </motion.div>
  )
}
