"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { listReviews, type Review, type ReviewStatus } from "@/lib/api"

const statusStyles: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#b45309", bg: "#fef6e7", label: "Pending" },
  approved: { color: "#16a34a", bg: "#ecfdf3", label: "Approved" },
  rejected: { color: "#dc2626", bg: "#fef2f2", label: "Rejected" },
  needs_changes: { color: "#b45309", bg: "#fffaf0", label: "Needs changes" },
}

const AVATAR_COLORS = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#ea580c", "#0891b2"]
function avatarColor(seed: number) {
  return AVATAR_COLORS[seed % AVATAR_COLORS.length]
}
function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "" + (parts[1]?.[0] ?? "")).toUpperCase().slice(0, 2) || "?"
}
function ticketId(id: number) {
  return `R-${String(id).padStart(3, "0")}`
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
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listReviews({ status })
      .then(setReviews)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reviews"))
      .finally(() => setLoading(false))
  }, [status])

  const cols = "grid-cols-[90px_1fr_minmax(150px,200px)_140px]"

  return (
    <motion.div initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-[18px] space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-[13px] text-slate-400">{description}</p>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#eef2f7] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className={`grid ${cols} gap-3.5 border-b border-[#f1f5f9] px-5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-slate-400`}>
          <div>Ticket</div>
          <div>Title</div>
          <div>Submitter</div>
          <div>Status</div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="p-6 text-sm text-slate-500">Fetching reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">No reviews here yet.</div>
        ) : (
          reviews.map((r) => {
            const st = statusStyles[r.status] ?? statusStyles.pending
            return (
              <div
                key={r.id}
                onClick={() => router.push(`/dashboard/reviews/${r.id}`)}
                className={`grid ${cols} cursor-pointer items-center gap-3.5 border-b border-[#f5f8fb] px-5 py-3.5 transition-colors last:border-b-0 hover:bg-[#fafbfd]`}
              >
                <div className="font-mono text-[12px] font-medium text-slate-500">{ticketId(r.id)}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium text-slate-800">{r.title}</span>
                    {(r.priority === "critical" || r.priority === "high") && (
                      <span className="flex-shrink-0 rounded-[5px] bg-[#fef2f2] px-1.5 py-px text-[10px] font-semibold text-red-600">
                        Urgent
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-slate-400">{timeAgo(r.created_at)}</div>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold text-white"
                    style={{ background: avatarColor(r.submitter_id ?? r.id) }}
                  >
                    {initials(r.submitter?.full_name)}
                  </div>
                  <span className="truncate text-[13px] text-slate-600">{r.submitter?.full_name ?? "Unknown"}</span>
                </div>
                <div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
