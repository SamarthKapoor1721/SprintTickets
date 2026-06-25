// Minimal API client for the Executive Review Hub backend.
// Stores the JWT in localStorage and attaches it to every request.

// Port 8008 avoids the common 8000 collision (e.g. other Docker stacks).
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8008/api/v1"

const TOKEN_KEY = "erh_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(typeof detail === "string" ? detail : "Request failed")
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- Types ----
export type Role = "ceo" | "manager" | "employee"
export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_changes"
export type ReviewPriority = "low" | "medium" | "high" | "critical"

export interface User {
  id: number
  email: string
  full_name: string | null
  department: string | null
  role: Role
  is_active: boolean
}

export interface Project {
  id: number
  name: string
  description: string | null
  department: string | null
  status: string
  owner_id: number | null
  owner: User | null
  members: User[]
  created_at: string | null
  updated_at: string | null
}

export interface Review {
  id: number
  title: string
  summary: string | null
  objective: string | null
  status: ReviewStatus
  priority: ReviewPriority
  review_type: string | null
  website_url: string | null
  github_repo: string | null
  figma_link: string | null
  documentation_link: string | null
  project_id: number | null
  submitter_id: number | null
  reviewer_id: number | null
  submitter: User | null
  reviewer: User | null
  created_at: string | null
  updated_at: string | null
}

export interface Comment {
  id: number
  content: string
  review_request_id: number
  author_id: number | null
  author: User | null
  created_at: string | null
}

export interface ReviewCreate {
  title: string
  summary?: string
  objective?: string
  priority?: ReviewPriority
  review_type?: string
  website_url?: string
  github_repo?: string
  figma_link?: string
  documentation_link?: string
  project_id?: number | null
}

// ---- Auth ----
export async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    let detail = "Incorrect email or password"
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  const data = (await res.json()) as { access_token: string }
  setToken(data.access_token)
  return data.access_token
}

export const getMe = () => request<User>("/auth/me")

// ---- Users ----
export const listUsers = () => request<User[]>("/users")

// ---- Projects ----
export const listProjects = () => request<Project[]>("/projects")

export const getProject = (id: number) => request<Project>(`/projects/${id}`)

export interface ProjectCreate {
  name: string
  description?: string
  department?: string
  status?: string
}

export const createProject = (data: ProjectCreate) =>
  request<Project>("/projects", { method: "POST", body: JSON.stringify(data) })

export const deleteProject = (id: number) =>
  request<void>(`/projects/${id}`, { method: "DELETE" })

// ---- Project members ----
export const listMembers = (projectId: number) =>
  request<User[]>(`/projects/${projectId}/members`)

export const addMember = (projectId: number, userId: number) =>
  request<User[]>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  })

export const removeMember = (projectId: number, userId: number) =>
  request<User[]>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" })

// ---- Reviews ----
export const listReviews = (opts: { status?: ReviewStatus; projectId?: number } = {}) => {
  const params = new URLSearchParams()
  if (opts.status) params.set("status", opts.status)
  if (opts.projectId != null) params.set("project_id", String(opts.projectId))
  const qs = params.toString()
  return request<Review[]>(`/reviews${qs ? `?${qs}` : ""}`)
}

export const getReview = (id: number) => request<Review>(`/reviews/${id}`)

export const createReview = (data: ReviewCreate) =>
  request<Review>("/reviews", { method: "POST", body: JSON.stringify(data) })

export const updateReview = (id: number, patch: Partial<Review>) =>
  request<Review>(`/reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })

// ---- Comments ----
export const listComments = (reviewId: number) =>
  request<Comment[]>(`/reviews/${reviewId}/comments`)

export const addComment = (reviewId: number, content: string) =>
  request<Comment>(`/reviews/${reviewId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })

// ---- Direct messages ----
export interface Message {
  id: number
  content: string
  sender_id: number
  recipient_id: number
  is_read: boolean
  created_at: string | null
}

export interface Contact {
  user: User
  last_message: string | null
  last_at: string | null
  unread: number
}

export const listContacts = () => request<Contact[]>("/messages/contacts")

export const getConversation = (userId: number) =>
  request<Message[]>(`/messages/${userId}`)

export const sendMessage = (userId: number, content: string) =>
  request<Message>(`/messages/${userId}`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })
