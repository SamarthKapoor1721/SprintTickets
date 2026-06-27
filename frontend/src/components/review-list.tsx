"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowUpDown, Search } from "lucide-react"
import { listReviews, type Review, type ReviewStatus } from "@/lib/api"

const statusStyles: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#b45309", bg: "#fef6e7", label: "Pending" },
  approved: { color: "#16a34a", bg: "#ecfdf3", label: "Approved" },
  rejected: { color: "#dc2626", bg: "#fef2f2", label: "Rejected" },
  needs_changes: { color: "#b45309", bg: "#fffaf0", label: "Needs changes" },
}

const priorityStyles: Record<string, { color: string; bg: string; label: string; rank: number }> = {
  critical: { color: "#dc2626", bg: "#fef2f2", label: "Critical", rank: 4 },
  high: { color: "#ea580c", bg: "#fff7ed", label: "High", rank: 3 },
  medium: { color: "#2563eb", bg: "#eff6ff", label: "Medium", rank: 2 },
  low: { color: "#64748b", bg: "#f1f5f9", label: "Low", rank: 1 },
}

const AVATAR_COLORS = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#ea580c", "#0891b2"]
function avatarColor(seed: number) {
  return AVATAR_COLORS[seed % AVATAR_COLORS.length]
}
function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase().slice(0, 2) || "?"
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

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low"
type SortBy = "newest" | "oldest" | "priority"

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

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("priority")
  const [query, setQuery] = useState("")

  useEffect(() => {
    listReviews({ status })
      .then(setReviews)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load reviews"))
      .finally(() => setLoading(false))
  }, [status])

  const visible = useMemo(() => {
    let list = reviews
    if (priorityFilter !== "all") list = list.filter((r) => r.priority === priorityFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.submitter?.full_name ?? "").toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortBy === "priority") {
        const pa = priorityStyles[a.priority]?.rank ?? 0
        const pb = priorityStyles[b.priority]?.rank ?? 0
        if (pa !== pb) return pb - pa
      }
      const ta = new Date(a.created_at ?? 0).getTime()
      const tb = new Date(b.created_at ?? 0).getTime()
      return sortBy === "oldest" ? ta - tb : tb - ta
    })
    return sorted
  }, [reviews, priorityFilter, sortBy, query])

  // Counts per priority for the filter pills
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reviews.length, critical: 0, high: 0, medium: 0, low: 0 }
    for (const r of reviews) c[r.priority] = (c[r.priority] ?? 0) + 1
    return c
  }, [reviews])

  const gridCols = "sm:grid sm:grid-cols-[80px_1fr_104px_minmax(150px,200px)_130px]"

  const filterPills: { key: PriorityFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-[13px] text-slate-400">{description}</p>
      </div>

      {/* Toolbar: priority filter + search + sort */}
      <div className="mb-3.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterPills.map((p) => {
            const active = priorityFilter === p.key
            const ps = priorityStyles[p.key]
            return (
              <button
                key={p.key}
                onClick={() => setPriorityFilter(p.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? "border-transparent text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                style={active ? { background: ps ? ps.color : "#0f172a" } : undefined}
              >
                {p.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] font-bold ${
                    active ? "bg-white/25" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[p.key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or person…"
              className="h-9 w-full rounded-[10px] border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none focus:border-primary/40"
            />
          </div>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="h-9 rounded-[10px] border border-slate-200 bg-white pl-8 pr-3 text-[13px] font-medium text-slate-700 outline-none focus:border-primary/40"
            >
              <option value="priority">Priority</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#eef2f7] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {/* Header — desktop table only */}
        <div className={`hidden ${gridCols} gap-3.5 border-b border-[#f1f5f9] px-5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-slate-400`}>
          <div>Ticket</div>
          <div>Title</div>
          <div>Priority</div>
          <div>Submitter</div>
          <div>Status</div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="p-6 text-sm text-slate-500">Fetching reviews…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">
            {reviews.length === 0 ? "No reviews here yet." : "No reviews match your filters."}
          </div>
        ) : (
          visible.map((r) => {
            const st = statusStyles[r.status] ?? statusStyles.pending
            const pr = priorityStyles[r.priority] ?? priorityStyles.medium
            return (
              <div
                key={r.id}
                onClick={() => router.push(`/dashboard/reviews/${r.id}`)}
                className={`block ${gridCols} cursor-pointer border-b border-[#f5f8fb] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[#fafbfd] sm:items-center sm:gap-3.5 sm:px-5`}
              >
                {/* Mobile top line: ticket + status */}
                <div className="mb-1.5 flex items-center justify-between gap-2 sm:hidden">
                  <span className="font-mono text-[12px] font-medium text-slate-500">{ticketId(r.id)}</span>
                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Ticket — desktop only */}
                <div className="hidden font-mono text-[12px] font-medium text-slate-500 sm:block">{ticketId(r.id)}</div>

                {/* Title */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-slate-800">{r.title}</span>
                    {/* Priority badge inline on mobile */}
                    <span
                      className="flex-shrink-0 rounded-[5px] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide sm:hidden"
                      style={{ color: pr.color, background: pr.bg }}
                    >
                      {pr.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-slate-400">{timeAgo(r.created_at)}</div>
                </div>

                {/* Priority — desktop column */}
                <div className="hidden sm:block">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ color: pr.color, background: pr.bg }}
                  >
                    {pr.label}
                  </span>
                </div>

                {/* Submitter */}
                <div className="mt-2 flex min-w-0 items-center gap-2 sm:mt-0">
                  <div
                    className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] text-[12px] font-semibold text-white"
                    style={{ background: avatarColor(r.submitter_id ?? r.id) }}
                  >
                    {initials(r.submitter?.full_name)}
                  </div>
                  <span className="truncate text-[14px] font-medium text-slate-700">{r.submitter?.full_name ?? "Unknown"}</span>
                </div>

                {/* Status — desktop only */}
                <div className="hidden sm:block">
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
