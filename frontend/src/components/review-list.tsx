"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { listReviews, type Review, type ReviewStatus } from "@/lib/api"

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

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

interface ReviewListProps {
  title: string
  description: string
  status: ReviewStatus
}

export default function ReviewList({ title, description, status }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listReviews({ status })
      .then(setReviews)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reviews"))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-slate-500">{description}</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass border-none">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-900">
              {loading ? "Loading…" : `${reviews.length} review${reviews.length === 1 ? "" : "s"}`}
            </CardTitle>
            <CardDescription className="text-slate-500">{description}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <div className="p-6 text-sm text-red-600">{error}</div>
            ) : loading ? (
              <div className="p-6 text-sm text-slate-500">Fetching reviews…</div>
            ) : reviews.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No reviews here yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reviews.map((r) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/reviews/${r.id}`}
                    className="flex items-center justify-between p-5 transition-colors hover:bg-slate-50 group cursor-pointer"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-medium text-slate-900">{r.title}</span>
                        <Badge className={`border-none capitalize ${priorityStyles[r.priority] ?? ""}`}>
                          {r.priority}
                        </Badge>
                        <Badge className={`border-none ${statusStyles[r.status] ?? ""}`}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <span className="text-sm text-slate-500">
                        {r.submitter?.full_name ? `${r.submitter.full_name} · ` : ""}
                        {r.summary ?? "No summary provided"}
                      </span>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-400">{timeAgo(r.created_at)}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
