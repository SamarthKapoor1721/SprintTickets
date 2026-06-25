"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileUp, Link as LinkIcon, Send } from "lucide-react"
import { createReview, listProjects, type Project } from "@/lib/api"

const selectClass =
  "h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
const inputClass =
  "h-11 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"

export default function NewReviewPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  })

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
  }, [])

  const submit = async () => {
    if (!form.title.trim()) {
      setError("A review title is required.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createReview({
        title: form.title,
        summary: form.summary || undefined,
        review_type: form.review_type || undefined,
        priority: form.priority as "low" | "medium" | "high" | "critical",
        website_url: form.website_url || undefined,
        figma_link: form.figma_link || undefined,
        github_repo: form.github_repo || undefined,
        documentation_link: form.documentation_link || undefined,
        project_id: form.project_id ? Number(form.project_id) : null,
      })
      router.push("/dashboard/reviews/pending")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review")
      setSubmitting(false)
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
                <Label htmlFor="type" className="text-slate-700">Review Type</Label>
                <select id="type" value={form.review_type} onChange={(e) => set("review_type", e.target.value)} className={selectClass}>
                  <option value="">Select review type</option>
                  <option value="website">Website Review</option>
                  <option value="tech">Tech Architecture</option>
                  <option value="design">Design Approval</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pb-12">
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
            {submitting ? "Submitting…" : "Submit for CEO Review"}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
