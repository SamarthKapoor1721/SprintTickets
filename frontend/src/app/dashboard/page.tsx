"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronRight, RefreshCw, Sparkles, X } from "lucide-react"
import { getAISummary, getActivity, listReviews, listProjects, type Review, type Project, type ActivityItem } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

// ── Style helpers ────────────────────────────────────────────────
const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pending:       { label: "Pending",   color: "#b45309", bg: "#fef6e7" },
  approved:      { label: "Approved",  color: "#15803d", bg: "#ecfdf3" },
  needs_changes: { label: "Changes",   color: "#7c3aed", bg: "#f5f3ff" },
  rejected:      { label: "Rejected",  color: "#dc2626", bg: "#fef2f2" },
}

const PALETTE = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#ea580c", "#0891b2"]
function avatarColor(id: number) { return PALETTE[id % PALETTE.length] }

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function ticketId(id: number) { return `R-${String(id).padStart(3, "0")}` }

function activityDot(item: { type: string; status: string | null }): string {
  if (item.type === "review_decision" || item.type === "review_submitted") {
    if (item.status === "approved") return "#16a34a"
    if (item.status === "rejected") return "#dc2626"
    if (item.status === "needs_changes") return "#7c3aed"
    return "#2563eb"
  }
  switch (item.type) {
    case "report_submitted": return "#0d9488"
    case "review_comment": return "#0891b2"
    case "task_created": return "#6366f1"
    case "task_updated": return "#d97706"
    default: return "#94a3b8"
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function greetingWord() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function formatRole(role?: string) {
  if (!role) return ""
  if (role === "super_admin") return "Admin"
  if (role === "ceo") return "CEO"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function formatUser(user?: { full_name?: string | null; email?: string; role?: string } | null, fallback = "Someone") {
  if (!user) return fallback
  const name = user.full_name || user.email || fallback
  const r = formatRole(user.role)
  return r ? `${name} (${r})` : name
}

// ── Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const role = user?.role ?? "employee"

  const [reviews, setReviews] = useState<Review[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [feed, setFeed] = useState<ActivityItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  const canSummarize = role === "ceo" || role === "super_admin" || role === "manager"
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null)
  const [aiDismissed, setAiDismissed] = useState(false)

  const fetchSummary = async (force = false) => {
    if (aiText && !force) return
    setAiLoading(true)
    setAiError(null)
    setAiDismissed(false)
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

  useEffect(() => {
    Promise.all([listReviews(), listProjects()])
      .then(([r, p]) => { setReviews(r); setProjects(p) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Privileged roles get the consolidated cross-resource activity feed
  // (reviews, reports, tasks, comments). Employees fall back to review events.
  useEffect(() => {
    if (!canSummarize) return
    getActivity().then(setFeed).catch(() => setFeed(null))
  }, [canSummarize])

  const firstName = (user?.full_name ?? user?.email ?? "there").split(/[\s@]/)[0]

  const greetSub = {
    super_admin: "Company-wide review activity, all in one place.",
    ceo:         "Company-wide review activity, all in one place.",
    manager:     "Reviews across the teams you lead.",
    employee:    "Your submissions and what needs your input.",
  }[role] ?? "Here's what needs your attention today."

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  const pending          = reviews.filter(r => r.status === "pending")
  const urgent           = pending.filter(r => r.priority === "high" || r.priority === "critical")
  const approvedThisWeek = reviews.filter(r => r.status === "approved" && r.updated_at && new Date(r.updated_at).getTime() > weekAgo)

  const avgReviewLabel = useMemo(() => {
    const resolved = reviews.filter(r => (r.status === "approved" || r.status === "rejected") && r.created_at && r.updated_at)
    if (!resolved.length) return "—"
    const avg = resolved.reduce((sum, r) => sum + (new Date(r.updated_at!).getTime() - new Date(r.created_at!).getTime()), 0) / resolved.length
    const hrs = avg / 3_600_000
    return hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d`
  }, [reviews])

  const metrics = [
    {
      label: "Pending reviews", value: String(pending.length),
      icon: "◷", iconBg: "#fef6e7", iconColor: "#b45309",
      delta: pending.length > 0 ? `${pending.length} need attention` : "All clear",
      deltaColor: pending.length > 0 ? "#b45309" : "#15803d",
    },
    {
      label: "Urgent", value: String(urgent.length),
      icon: "!", iconBg: "#fef2f2", iconColor: "#dc2626",
      delta: urgent.length > 0 ? "High priority items" : "None right now",
      deltaColor: urgent.length > 0 ? "#dc2626" : "#15803d",
    },
    {
      label: "Approved this week", value: String(approvedThisWeek.length),
      icon: "✓", iconBg: "#ecfdf3", iconColor: "#15803d",
      delta: approvedThisWeek.length > 0 ? `+${approvedThisWeek.length} this week` : "No approvals yet",
      deltaColor: "#15803d",
    },
    {
      label: "Avg. review time", value: avgReviewLabel,
      icon: "⚡", iconBg: "#eff4ff", iconColor: "#2563eb",
      delta: avgReviewLabel === "—" ? "No resolved reviews" : "Based on resolved",
      deltaColor: "#2563eb",
    },
  ]

  // Queue: employee sees own submissions, others see pending queue
  const queue = role === "employee"
    ? reviews.filter(r => r.submitter_id === user?.id).slice(0, 5)
    : pending.slice(0, 5)

  const queueTitle = role === "employee" ? "Your submissions" : "Awaiting your review"

  // Teams mini: top 4 projects with open review count
  const teamMini = projects.slice(0, 4).map((p, idx) => {
    const color = PALETTE[idx % PALETTE.length]
    const abbr = p.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?"
    const openCount = reviews.filter(r => r.project_id === p.id && r.status === "pending").length
    return { ...p, color, abbr, openCount }
  })

  // Activity feed from review events
  const activity = useMemo(() => {
    const sorted = [...reviews].sort((a, b) =>
      new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    )
    return sorted.slice(0, 5).map(r => {
      const reviewerStr = r.reviewers?.length ? r.reviewers.map(rev => formatUser(rev, "Reviewer")).join(", ") : "Reviewer"
      if (r.status === "approved")
        return { dot: "#16a34a", who: reviewerStr, text: `approved "${r.title}"`, time: timeAgo(r.updated_at) }
      if (r.status === "needs_changes")
        return { dot: "#7c3aed", who: reviewerStr, text: `requested changes on "${r.title}"`, time: timeAgo(r.updated_at) }
      if (r.status === "rejected")
        return { dot: "#dc2626", who: reviewerStr, text: `rejected "${r.title}"`, time: timeAgo(r.updated_at) }
      return { dot: "#2563eb", who: formatUser(r.submitter, "Someone"), text: `submitted "${r.title}" for review`, time: timeAgo(r.created_at) }
    })
  }, [reviews])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading dashboard…
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

      {/* Greeting */}
      <div className="mb-[18px] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
            {greetingWord()}, {firstName}
          </h1>
          <p className="mt-0.5 text-[14px] text-slate-400">{greetSub}</p>
        </div>
        {canSummarize && (!aiText || aiDismissed) && !aiLoading && (
          <button
            onClick={() => { setAiDismissed(false); fetchSummary(true) }}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[10px] border border-violet-200 bg-violet-50 px-3 py-2 text-[12.5px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Summary
          </button>
        )}
      </div>

      {/* AI Summary panel */}
      {canSummarize && !aiDismissed && (aiText || aiLoading || aiError) && (
        <div className="mb-[18px] rounded-[14px] border border-violet-200 bg-violet-50 px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-[13.5px] font-semibold text-violet-900">AI Executive Summary</span>
              {aiGeneratedAt && (
                <span className="text-[11px] text-violet-400">
                  · Generated at {new Date(aiGeneratedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {aiText && (
                <button
                  onClick={() => fetchSummary(true)}
                  title="Regenerate"
                  className="flex h-7 w-7 items-center justify-center rounded-[7px] text-violet-400 transition-colors hover:bg-violet-100 hover:text-violet-700 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setAiDismissed(true)}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-violet-400 transition-colors hover:bg-violet-100 hover:text-violet-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {aiLoading ? (
            <div className="flex items-center gap-2 py-2 text-[13px] text-violet-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              Analysing reviews, reports, and tasks…
            </div>
          ) : aiError ? (
            <p className="text-[13px] text-red-600">{aiError}</p>
          ) : (
            <div className="space-y-0.5">
              {aiText?.split("\n").map((line, i) => {
                const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                if (/^#{1,3} /.test(line))
                  return <p key={i} className="mt-2 text-[13px] font-semibold text-violet-900" dangerouslySetInnerHTML={{ __html: html.replace(/^#{1,3} /, "") }} />
                if (/^[-*] /.test(line))
                  return <p key={i} className="ml-3 text-[12.5px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: `• ${html.slice(2)}` }} />
                if (!line.trim()) return <div key={i} className="h-1" />
                return <p key={i} className="text-[12.5px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />
              })}
            </div>
          )}
        </div>
      )}

      {/* 4 Metric cards */}
      <div className="mb-[18px] grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="rounded-[14px] border border-[#eef2f7] bg-white px-[18px] py-[17px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-500">{m.label}</span>
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] text-[15px]"
                style={{ background: m.iconBg, color: m.iconColor }}
              >
                {m.icon}
              </div>
            </div>
            <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
              {m.value}
            </div>
            <div className="mt-1 text-[12px] font-medium" style={{ color: m.deltaColor }}>
              {m.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Queue + Right column */}
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.7fr_1fr]">

        {/* Review queue */}
        <div className="overflow-hidden rounded-[14px] border border-[#eef2f7] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] px-[18px] py-4">
            <span className="text-[14.5px] font-semibold text-slate-900">{queueTitle}</span>
            <Link
              href="/dashboard/reviews/pending"
              className="text-[12.5px] font-semibold text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {queue.length === 0 ? (
            <div className="px-[18px] py-6 text-[13px] text-slate-400">No reviews right now.</div>
          ) : (
            queue.map((r) => {
              const st = STATUS_INFO[r.status] ?? STATUS_INFO.pending
              return (
                <div
                  key={r.id}
                  onClick={() => router.push(`/dashboard/reviews/${r.id}`)}
                  className="flex cursor-pointer items-center gap-[14px] border-b border-[#f5f8fb] px-[18px] py-[14px] transition-colors last:border-0 hover:bg-[#fafbfd]"
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] text-[13px] font-semibold text-white"
                    style={{ background: avatarColor(r.submitter_id ?? r.id) }}
                  >
                    {initials(r.submitter?.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] font-medium text-slate-400">{ticketId(r.id)}</span>
                      {(r.priority === "high" || r.priority === "critical") && (
                        <span className="rounded-[5px] bg-[#fef2f2] px-1.5 py-px text-[10.5px] font-semibold text-red-600">
                          Urgent
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[14px] font-medium text-slate-800">{r.title}</div>
                    <div className="mt-0.5 text-[12px] text-slate-400">
                      {r.submitter?.full_name ?? "Unknown"} · {timeAgo(r.created_at)}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-[10px] py-1 text-[11.5px] font-semibold"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.label}
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" strokeWidth={2} />
                </div>
              )
            })
          )}
        </div>

        {/* Right column: teams + activity */}
        <div className="flex flex-col gap-[18px]">

          {/* Teams mini */}
          <div className="overflow-hidden rounded-[14px] border border-[#eef2f7] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] px-[18px] py-[15px]">
              <span className="text-[14px] font-semibold text-slate-900">Your teams</span>
              <Link href="/dashboard/projects" className="text-[12.5px] font-semibold text-primary hover:underline">
                All teams
              </Link>
            </div>
            {teamMini.length === 0 ? (
              <div className="px-[18px] py-4 text-[13px] text-slate-400">No teams yet.</div>
            ) : (
              teamMini.map((t) => (
                <Link
                  key={t.id}
                  href="/dashboard/projects"
                  className="flex items-center gap-[11px] border-b border-[#f5f8fb] px-[18px] py-3 transition-colors last:border-0 hover:bg-[#fafbfd]"
                >
                  <div
                    className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] text-[12px] font-bold"
                    style={{ background: t.color + "1a", color: t.color }}
                  >
                    {t.abbr}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-slate-800">{t.name}</div>
                    <div className="text-[11.5px] text-slate-400">{t.members.length} members</div>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-[#fef6e7] px-2 py-0.5 text-[11.5px] font-semibold text-amber-700">
                    {t.openCount} open
                  </span>
                </Link>
              ))
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-[14px] border border-[#eef2f7] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-[14px] flex items-center justify-between">
              <span className="text-[14px] font-semibold text-slate-900">Recent activity</span>
              {feed && feed.length > 0 && (
                <span className="text-[11px] font-medium text-slate-400">Across the company</span>
              )}
            </div>

            {feed ? (
              feed.length === 0 ? (
                <p className="text-[13px] text-slate-400">No recent activity.</p>
              ) : (
                <div>
                  {feed.slice(0, 8).map((a, i) => (
                    <Link
                      key={a.id}
                      href={a.link}
                      className="-mx-2 flex gap-[11px] rounded-[8px] px-2 pb-[14px] pt-1 transition-colors last:pb-1 hover:bg-[#fafbfd]"
                    >
                      <div className="flex flex-shrink-0 flex-col items-center">
                        <div className="mt-[5px] h-2 w-2 rounded-full" style={{ background: activityDot(a) }} />
                        {i < Math.min(feed.length, 8) - 1 && (
                          <div className="mt-1 w-px flex-1 bg-[#eef2f7]" />
                        )}
                      </div>
                      <div className="min-w-0 pb-0.5">
                        <div className="text-[13px] leading-[1.45] text-slate-500">
                          <span className="font-semibold text-slate-800">{a.actor}</span>{" "}
                          <span>{a.action}</span>
                          {a.title && a.type !== "report_submitted" && (
                            <span className="text-slate-600"> · {a.title}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-slate-400">{timeAgo(a.timestamp)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            ) : activity.length === 0 ? (
              <p className="text-[13px] text-slate-400">No recent activity.</p>
            ) : (
              <div>
                {activity.map((a, i) => (
                  <div key={i} className="flex gap-[11px] pb-[14px] last:pb-0">
                    <div className="flex flex-shrink-0 flex-col items-center">
                      <div className="mt-[5px] h-2 w-2 rounded-full" style={{ background: a.dot }} />
                      {i < activity.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-[#eef2f7]" />
                      )}
                    </div>
                    <div className="min-w-0 pb-0.5">
                      <div className="text-[13px] leading-[1.45] text-slate-500">
                        <span className="font-semibold text-slate-800">{a.who}</span>{" "}
                        <span className="line-clamp-2">{a.text}</span>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-slate-400">{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
