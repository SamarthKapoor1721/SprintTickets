"use client"

/* Web Speech API — not in TypeScript's default DOM lib */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  MessageSquare,
  X,
  ExternalLink,
  FileText,
} from "lucide-react"
import {
  getConversation,
  getMe,
  listContacts,
  listProjects,
  sendMessage,
  type Contact,
  type Message,
  type Project,
  type User,
} from "@/lib/api"

// ── Types ────────────────────────────────────────────────────────
interface AttachmentItem {
  file: File
  url: string          // stable object URL, revoked on remove/unmount
}

// ── Helpers ──────────────────────────────────────────────────────
const roleColors: Record<string, string> = {
  ceo: "bg-blue-100 text-blue-700",
  manager: "bg-violet-100 text-violet-700",
  employee: "bg-slate-100 text-slate-600",
  super_admin: "bg-amber-100 text-amber-700",
}
const AVATAR_PALETTE = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#ea580c", "#0891b2"]
function avatarBg(id: number) { return AVATAR_PALETTE[id % AVATAR_PALETTE.length] }
function avatarInitials(u: User) { return (u.full_name ?? u.email).slice(0, 1).toUpperCase() }
function timeLabel(iso: string | null) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
function isImage(file: File) { return file.type.startsWith("image/") }
function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Render message content: plain text + clickable 📎 file lines
function MessageContent({
  content,
  mine,
  fileUrls,
}: {
  content: string
  mine: boolean
  fileUrls: string[]
}) {
  const lines = content.split("\n")
  let urlIdx = 0
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.startsWith("📎 ")) {
          const name = line.slice(3)
          const url = fileUrls[urlIdx++] ?? null
          return (
            <div key={i} className="flex items-center gap-1.5 mt-1">
              <FileText className="h-3.5 w-3.5 flex-shrink-0 opacity-75" strokeWidth={1.8} />
              {url ? (
                <button
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  className={`truncate text-[12.5px] underline underline-offset-2 cursor-pointer hover:opacity-75 flex items-center gap-1 ${
                    mine ? "text-blue-100" : "text-primary"
                  }`}
                >
                  {name}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
                </button>
              ) : (
                <span className="truncate text-[12.5px] opacity-60">{name}</span>
              )}
            </div>
          )
        }
        return line
          ? <p key={i} className="whitespace-pre-wrap break-words leading-relaxed">{line}</p>
          : <br key={i} />
      })}
    </div>
  )
}

// ── Voice hook ───────────────────────────────────────────────────
function useSpeechInput(onAppend: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionInstance | null>(null)

  const toggle = useCallback(() => {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      alert("Speech recognition isn't supported in this browser. Try Chrome or Edge.")
      return
    }
    const rec: SpeechRecognitionInstance = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = "en-US"
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? ""
      if (text) onAppend(text)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [listening, onAppend])

  return { listening, toggle }
}

// ── Page ─────────────────────────────────────────────────────────
export default function MessagesPage() {
  const [me, setMe] = useState<User | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [active, setActive] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageFileUrls, setMessageFileUrls] = useState<Record<number, string[]>>({})
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // messageId → array of object URLs for files sent in that message
  const fileCacheRef = useRef<Map<number, string[]>>(new Map())
  // URLs staged for the next send (before we have a message ID)
  const pendingUrlsRef = useRef<string[]>([])

  const { listening, toggle: toggleVoice } = useSpeechInput((text) =>
    setDraft((d) => (d ? `${d} ${text}` : text))
  )

  // Revoke all cached object URLs on unmount
  useEffect(() => {
    const fileCache = fileCacheRef
    const pendingUrls = pendingUrlsRef
    return () => {
      fileCache.current.forEach((urls) => urls.forEach((u) => URL.revokeObjectURL(u)))
      pendingUrls.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const refreshContacts = useCallback(() => {
    listContacts().then(setContacts).catch(() => {})
  }, [])

  useEffect(() => {
    getMe().then(setMe).catch(() => {})
    Promise.all([listContacts(), listProjects()])
      .then(([c, p]) => {
        setContacts(c)
        setProjects(p)
        if (p.length) setExpanded(new Set([p[0].id]))
        if (c.length) setActive(c[0].user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const load = () =>
      getConversation(active.id)
        .then((m) => { if (!cancelled) setMessages(m) })
        .catch(() => {})
    load()
    refreshContacts()
    const t = setInterval(() => { load(); refreshContacts() }, 4000)
    return () => { cancelled = true; clearInterval(t) }
  }, [active, refreshContacts])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const addFiles = (files: File[]) => {
    const items: AttachmentItem[] = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))
    setAttachments((prev) => [...prev, ...items])
  }

  const removeAttachment = (i: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[i].url)
      return prev.filter((_, j) => j !== i)
    })
  }

  const send = async () => {
    if (!active || (!draft.trim() && attachments.length === 0)) return
    setSending(true)

    // Stash object URLs so we can link them to the message ID after send
    pendingUrlsRef.current = attachments.map((a) => a.url)

    let content = draft.trim()
    if (attachments.length > 0) {
      const names = attachments.map((a) => `📎 ${a.file.name}`).join("\n")
      content = content ? `${content}\n${names}` : names
    }
    setDraft("")
    setAttachments([])   // items' urls are now in pendingUrlsRef — don't revoke yet

    try {
      const m = await sendMessage(active.id, content)
      // Link the object URLs to this message ID for in-session preview
      if (pendingUrlsRef.current.length > 0) {
        fileCacheRef.current.set(m.id, pendingUrlsRef.current)
        setMessageFileUrls((prev) => ({ ...prev, [m.id]: pendingUrlsRef.current }))
        pendingUrlsRef.current = []
      }
      setMessages((prev) => [...prev, m])
      refreshContacts()
    } catch {
      setDraft(content)
      // Revoke unneeded URLs on failure
      pendingUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      pendingUrlsRef.current = []
    } finally {
      setSending(false)
    }
  }

  const toggleProject = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

  const contactMap = new Map(contacts.map((c) => [c.user.id, c]))
  function membersInContacts(p: Project): Contact[] {
    return p.members.map((m) => contactMap.get(m.id)).filter(Boolean) as Contact[]
  }
  const inProjectIds = new Set(projects.flatMap((p) => p.members.map((m) => m.id)))
  const dmOnly = contacts.filter((c) => !inProjectIds.has(c.user.id))

  return (
    <div className="-m-[26px] flex overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>

      {/* ── Left: GitHub-style project nav ── */}
      <aside className="flex w-[252px] flex-shrink-0 flex-col border-r border-[#eef2f7] bg-white">
        <div className="border-b border-[#eef2f7] px-4 py-3.5">
          <span className="text-[13.5px] font-semibold text-slate-800">Messages</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <p className="px-4 py-3 text-[12px] text-slate-400">Loading…</p>
          ) : (
            <>
              {projects.length > 0 && (
                <div className="mb-2">
                  <p className="px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                    Projects
                  </p>
                  {projects.map((p) => {
                    const isOpen = expanded.has(p.id)
                    const members = membersInContacts(p)
                    return (
                      <div key={p.id}>
                        <button
                          onClick={() => toggleProject(p.id)}
                          className="flex w-full items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-left transition-colors hover:bg-[#f4f7fb] cursor-pointer"
                        >
                          {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={2} />
                            : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" strokeWidth={2} />
                          }
                          <FolderKanban className="h-3.5 w-3.5 flex-shrink-0 text-[#2563eb]" strokeWidth={1.8} />
                          <span className="truncate text-[13px] font-medium text-slate-700">{p.name}</span>
                        </button>
                        {isOpen && (
                          <div className="ml-3 border-l border-[#eef2f7] pl-3">
                            {members.length === 0 ? (
                              <p className="px-2 py-1.5 text-[11.5px] text-slate-400">No contacts in this team</p>
                            ) : (
                              members.map((c) => {
                                const isActive = active?.id === c.user.id
                                return (
                                  <button
                                    key={c.user.id}
                                    onClick={() => setActive(c.user)}
                                    className={`flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left transition-colors cursor-pointer ${
                                      isActive ? "bg-[#eef4ff] text-primary" : "text-slate-600 hover:bg-[#f4f7fb]"
                                    }`}
                                  >
                                    <div
                                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                      style={{ background: avatarBg(c.user.id) }}
                                    >
                                      {avatarInitials(c.user)}
                                    </div>
                                    <span className="min-w-0 flex-1 truncate text-[12.5px]">
                                      {c.user.full_name ?? c.user.email}
                                    </span>
                                    {c.unread > 0 && (
                                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                                        {c.unread}
                                      </span>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {(dmOnly.length > 0 || projects.length === 0) && (
                <div>
                  <p className="px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                    Direct Messages
                  </p>
                  {(projects.length === 0 ? contacts : dmOnly).map((c) => {
                    const isActive = active?.id === c.user.id
                    return (
                      <button
                        key={c.user.id}
                        onClick={() => setActive(c.user)}
                        className={`flex w-full items-center gap-2 rounded-[7px] px-3 py-1.5 text-left transition-colors cursor-pointer ${
                          isActive ? "bg-[#eef4ff] text-primary" : "text-slate-600 hover:bg-[#f4f7fb]"
                        }`}
                      >
                        <MessageSquare
                          className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-primary" : "text-slate-400"}`}
                          strokeWidth={1.8}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">
                          {c.user.full_name ?? c.user.email}
                        </span>
                        {c.unread > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                            {c.unread}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {contacts.length === 0 && !loading && (
                <p className="px-4 py-3 text-[12px] text-slate-400">No conversations yet.</p>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Right: thread ── */}
      <div className="flex flex-1 flex-col bg-[#f8fafc]">
        {!active ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-200" strokeWidth={1.4} />
              <p className="text-sm text-slate-400">Select a conversation to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[#eef2f7] bg-white px-5 py-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: avatarBg(active.id) }}
              >
                {avatarInitials(active)}
              </div>
              <div>
                <p className="text-[13.5px] font-semibold text-slate-900">
                  {active.full_name ?? active.email}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium capitalize ${roleColors[active.role] ?? "bg-slate-100 text-slate-600"}`}>
                  {active.role.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {messages.length === 0 ? (
                <p className="pt-8 text-center text-sm text-slate-400">No messages yet — say hello 👋</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const mine = me?.id === m.sender_id
                    const fileUrls = messageFileUrls[m.id] ?? []
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-sm bg-primary text-white"
                              : "rounded-bl-sm border border-[#eef2f7] bg-white text-slate-800"
                          }`}
                        >
                          <MessageContent content={m.content} mine={mine} fileUrls={fileUrls} />
                          <p className={`mt-1.5 text-[10px] ${mine ? "text-blue-200" : "text-slate-400"}`}>
                            {timeLabel(m.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Staged attachment chips with preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[#eef2f7] bg-white px-4 py-2.5">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 overflow-hidden rounded-[8px] border border-[#eef2f7] bg-[#f5f7fa]"
                  >
                    {/* Thumbnail for images, icon for others */}
                    {isImage(a.file) ? (
                      <img
                        src={a.url}
                        alt={a.file.name}
                        className="h-9 w-9 flex-shrink-0 rounded-l-[7px] object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-l-[7px] bg-[#eef2f7]">
                        <FileText className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                      </div>
                    )}
                    <div className="min-w-0 py-1 pr-1">
                      <p className="max-w-[100px] truncate text-[11.5px] font-medium text-slate-700">{a.file.name}</p>
                      <p className="text-[10px] text-slate-400">{fmtSize(a.file.size)}</p>
                    </div>
                    {/* Open preview */}
                    <button
                      onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
                      aria-label="Preview file"
                      title="Preview"
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-slate-400 transition-colors hover:bg-[#e8edf4] hover:text-primary cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    {/* Remove */}
                    <button
                      onClick={() => removeAttachment(i)}
                      aria-label="Remove attachment"
                      className="mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-2 border-t border-[#eef2f7] bg-white px-3 py-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []))
                  e.target.value = ""
                }}
              />

              {/* Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                title="Attach file"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-[#eef2f7] text-slate-500 transition-colors hover:bg-[#f4f7fb] hover:text-slate-700 cursor-pointer"
              >
                <Paperclip className="h-[15px] w-[15px]" strokeWidth={1.9} />
              </button>

              {/* Text input */}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
                }}
                placeholder={`Message ${active.full_name ?? active.email}…`}
                aria-label="Message"
                className="h-9 flex-1 rounded-[9px] border border-[#eef2f7] bg-[#f5f7fa] px-3.5 text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
              />

              {/* Voice */}
              <button
                onClick={toggleVoice}
                aria-label={listening ? "Stop recording" : "Voice input"}
                title={listening ? "Stop recording" : "Voice to text"}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border transition-colors cursor-pointer ${
                  listening
                    ? "animate-pulse border-red-200 bg-red-50 text-red-500"
                    : "border-[#eef2f7] text-slate-500 hover:bg-[#f4f7fb] hover:text-slate-700"
                }`}
              >
                {listening
                  ? <MicOff className="h-[15px] w-[15px]" strokeWidth={1.9} />
                  : <Mic className="h-[15px] w-[15px]" strokeWidth={1.9} />
                }
              </button>

              {/* Send */}
              <button
                onClick={send}
                disabled={sending || (!draft.trim() && attachments.length === 0)}
                aria-label="Send message"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-primary text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-[15px] w-[15px]" strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
