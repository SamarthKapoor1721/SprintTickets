"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import {
  getConversation,
  getMe,
  listContacts,
  sendMessage,
  type Contact,
  type Message,
  type User,
} from "@/lib/api"

const roleStyles: Record<string, string> = {
  ceo: "bg-blue-100 text-blue-700",
  manager: "bg-violet-100 text-violet-700",
  employee: "bg-slate-100 text-slate-600",
}

function initials(u: User) {
  return (u.full_name ?? u.email).slice(0, 1).toUpperCase()
}

function timeLabel(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function MessagesPage() {
  const [me, setMe] = useState<User | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [active, setActive] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const refreshContacts = useCallback(() => {
    listContacts().then(setContacts).catch(() => {})
  }, [])

  useEffect(() => {
    getMe().then(setMe).catch(() => {})
    listContacts()
      .then((c) => {
        setContacts(c)
        if (c.length) setActive(c[0].user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Load + poll the active conversation.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const load = () =>
      getConversation(active.id)
        .then((m) => {
          if (!cancelled) setMessages(m)
        })
        .catch(() => {})
    load()
    refreshContacts()
    const t = setInterval(() => {
      load()
      refreshContacts()
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [active, refreshContacts])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async () => {
    if (!active || !draft.trim()) return
    setSending(true)
    const content = draft
    setDraft("")
    try {
      const m = await sendMessage(active.id, content)
      setMessages((prev) => [...prev, m])
      refreshContacts()
    } catch {
      setDraft(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Messages</h1>
        <p className="text-slate-500">Private direct messages with your team and leadership.</p>
      </div>

      <div className="glass grid h-[calc(100vh-13rem)] grid-cols-1 overflow-hidden rounded-2xl border-none md:grid-cols-[300px_1fr]">
        {/* Contacts */}
        <div className="flex flex-col border-r border-slate-100">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-500">
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-400">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No one to chat with yet.</div>
            ) : (
              contacts.map((c) => {
                const isActive = active?.id === c.user.id
                return (
                  <button
                    key={c.user.id}
                    onClick={() => setActive(c.user)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                      isActive ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-xs font-bold text-white">
                      {initials(c.user)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {c.user.full_name ?? c.user.email}
                        </span>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
                            {c.unread}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400">
                        {c.last_message ?? "No messages yet"}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex flex-col bg-slate-50/60">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-xs font-bold text-white">
                  {initials(active)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{active.full_name ?? active.email}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${roleStyles[active.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {active.role}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400">
                    No messages yet. Say hello 👋
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = me?.id === m.sender_id
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-sm bg-primary text-white"
                              : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                            {timeLabel(m.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder={`Message ${active.full_name ?? active.email}…`}
                  aria-label="Message"
                  className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
