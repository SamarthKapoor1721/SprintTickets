"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  ExternalLink,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  addReviewComment,
  getAISummary,
  getReview,
  listReviewComments,
  updateReview,
  type ReviewComment,
  type Review,
  type ReviewStatus,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const priorityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-600",
}
const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  needs_changes: "bg-orange-100 text-orange-700",
}

const LINKS: { key: keyof Review; label: string }[] = [
  { key: "website_url", label: "Staging URL" },
  { key: "figma_link", label: "Figma" },
  { key: "github_repo", label: "GitHub PR" },
  { key: "documentation_link", label: "Documentation" },
]

function initials(name?: string | null) {
  return (name ?? "?").slice(0, 1).toUpperCase()
}

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)

  const [review, setReview] = useState<Review | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const role = user?.role ?? "employee"
  const [newComment, setNewComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null)

  const canDecide = role === "ceo" || role === "manager" || role === "super_admin"

  const fetchSummary = async () => {
    setAiOpen(true)
    if (aiText) return
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

  const load = useCallback(() => {
    Promise.all([getReview(id), listReviewComments(id, { limit: 100 })])
      .then(([r, c]) => {
        setReview(r)
        setComments(c)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load review"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (status: ReviewStatus) => {
    setBusy(true)
    setError(null)
    try {
      setReview(await updateReview(id, { status }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status")
    } finally {
      setBusy(false)
    }
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    setBusy(true)
    try {
      const c = await addReviewComment(id, newComment)
      setComments((prev) => [...prev, c])
      setNewComment("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add comment")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading review…</div>
  if (error && !review)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  if (!review) return null

  const links = LINKS.filter(({ key }) => review[key])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <button
        onClick={() => router.back()}
        className="flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{review.title}</h1>
        <div className="flex items-center gap-2">
          <Badge className={`border-none capitalize ${priorityStyles[review.priority] ?? ""}`}>
            {review.priority}
          </Badge>
          <Badge className={`border-none ${statusStyles[review.status] ?? ""}`}>
            {review.status.replace("_", " ")}
          </Badge>
          {review.review_type && (
            <Badge className="border-none bg-slate-100 text-slate-600">{review.review_type}</Badge>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canDecide && (
        <>
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
              <button onClick={() => { setAiOpen(false); setAiText(null) }} className="rounded-lg p-1 text-violet-400 hover:bg-violet-100 hover:text-violet-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 py-4 text-[13px] text-violet-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                Analysing all reviews, reports, and tasks…
              </div>
            ) : aiError ? (
              <p className="text-sm text-red-600">{aiError}</p>
            ) : (
              <div className="space-y-0.5">
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
          </div>
        )}
        <Card className="glass border-none">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <span className="mr-2 text-sm font-medium text-slate-600">Decision:</span>
            <Button
              onClick={() => decide("approved")}
              disabled={busy}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
            >
              <CheckCircle className="h-4 w-4" /> Approve
            </Button>
            <Button
              onClick={() => decide("needs_changes")}
              disabled={busy}
              className="gap-2 bg-orange-500 text-white hover:bg-orange-600 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" /> Request changes
            </Button>
            <Button
              onClick={() => decide("rejected")}
              disabled={busy}
              className="gap-2 bg-red-600 text-white hover:bg-red-700 cursor-pointer"
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button
              onClick={fetchSummary}
              variant="outline"
              className="ml-auto gap-2 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> AI Summary
            </Button>
          </CardContent>
        </Card>
        </>
      )}

      <Card className="glass border-none">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-1 text-slate-400">Summary</p>
            <p className="text-slate-700">{review.summary ?? "No summary provided."}</p>
          </div>
          {review.objective && (
            <div>
              <p className="mb-1 text-slate-400">Objective</p>
              <p className="text-slate-700">{review.objective}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="mb-1 text-slate-400">Submitted by</p>
              <p className="text-slate-700">{review.submitter?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-slate-400">Reviewer</p>
              <p className="text-slate-700">{review.reviewer?.full_name ?? "Unassigned"}</p>
            </div>
          </div>
          {links.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-slate-400">Deliverables</p>
              <div className="flex flex-wrap gap-2">
                {links.map(({ key, label }) => (
                  <a
                    key={key}
                    href={String(review[key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                  >
                    {label} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <MessageSquare className="h-4 w-4 text-slate-400" /> Review notes ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
              <p className="text-sm text-slate-400">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-xs font-bold text-white">
                    {initials(c.author?.full_name)}
                  </div>
                  <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {c.author?.full_name ?? "Unknown"}
                      </p>
                      <span className="text-xs capitalize text-slate-400">{c.author?.role}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a note…"
              className="resize-none border-slate-200 bg-slate-50 text-slate-900"
            />
            <Button
              onClick={postComment}
              disabled={busy || !newComment.trim()}
              className="self-end bg-primary text-white hover:bg-primary/90 cursor-pointer"
            >
              Post note
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
