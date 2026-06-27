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

async function requestMultipart<T>(path: string, body: FormData, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const payload = await res.json()
      detail = payload.detail ?? detail
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(typeof detail === "string" ? detail : "Request failed")
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- Types ----
export type Role = "super_admin" | "ceo" | "manager" | "employee"
export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_changes"
export type ReviewPriority = "low" | "medium" | "high" | "critical"
export type SprintStatus = "planned" | "active" | "completed"
export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done"
export type TaskPriority = "low" | "medium" | "high" | "critical"
export type TaskIssueType = "story" | "task" | "bug" | "epic"

export interface User {
  id: number
  employee_id: number
  email: string
  full_name: string | null
  department: string | null
  role: Role
  is_active: boolean
}

export interface UserDetailCounts {
  owned_projects: number
  member_projects: number
  submitted_reviews: number
  reviewed_reviews: number
  assigned_tasks: number
  created_tasks: number
  reports: number
}

export interface UserDetail extends User {
  onboarding_pending: boolean
  counts: UserDetailCounts
  owned_projects: Project[]
  member_projects: Project[]
  submitted_reviews: Review[]
  reviewed_reviews: Review[]
  assigned_tasks: Task[]
  created_tasks: Task[]
  reports: Report[]
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

export interface Sprint {
  id: number
  name: string
  goal: string | null
  status: SprintStatus
  start_date: string | null
  end_date: string | null
  project_id: number
  project: Project | null
  task_count: number
  created_at: string | null
  updated_at: string | null
}

export interface ReviewAttachment {
  id: number
  review_request_id: number
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string | null
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
  tech_details: any
  project_id: number | null
  submitter_id: number | null
  submitter: User | null
  reviewers: User[]
  attachments?: ReviewAttachment[]
  created_at: string | null
  updated_at: string | null
}

export interface ReviewComment {
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
  reviewer_ids?: number[]
}

// ---- Tasks ----
export interface Task {
  id: number
  title: string
  description: string | null
  issue_type: TaskIssueType
  status: TaskStatus
  priority: TaskPriority
  project_id: number
  project: Project | null
  sprint_id: number | null
  sprint: Sprint | null
  assignee_id: number | null
  creator_id: number
  assignee: User | null
  creator: User | null
  due_date: string | null
  estimate_minutes: number | null
  logged_minutes: number
  comments_count: number
  created_at: string | null
  updated_at: string | null
}

export interface TaskCreate {
  title: string
  description?: string | null
  issue_type?: TaskIssueType
  status?: TaskStatus
  priority?: TaskPriority
  project_id: number
  sprint_id?: number | null
  assignee_id?: number | null
  due_date?: string | null
  estimate_minutes?: number | null
  logged_minutes?: number
}

export interface TaskComment {
  id: number
  content: string
  task_id: number
  author_id: number | null
  author: User | null
  created_at: string | null
}

// ---- Reports ----
export interface Report {
  id: number
  content: string
  yesterday: string | null
  today: string | null
  blockers: string | null
  minutes_spent: number | null
  date: string
  submitter_id: number
  project_id: number | null
  submitter: User | null
  project: Project | null
  tasks: Task[]
  attachments: ReportAttachment[]
  pointers: ReportPointers
  created_at: string
  updated_at: string
}

export interface ReportAttachment {
  id: number
  file_name: string
  mime_type: string
  size_bytes: number
  download_url: string
  created_at: string | null
}

export interface ReportPointers {
  yesterday: string[]
  today: string[]
  blockers: string[]
  content: string[]
  tasks: string[]
  attachments: string[]
  executive: string[]
}

export interface ReportCreate {
  content?: string | null
  yesterday?: string | null
  today?: string | null
  blockers?: string | null
  minutes_spent?: number | null
  date: string
  project_id?: number | null
  task_ids?: number[]
}

export type ReportUpdate = Partial<ReportCreate>

export interface DashboardSummary {
  role: Role
  metrics: {
    projects: number
    total_tasks: number
    active_sprints: number
    overdue_tasks: number
    blocked_tasks: number
    reports_today: number
    missing_reports: number
  }
  tasks_by_status: Record<TaskStatus, number>
  active_sprints: Sprint[]
  overdue_tasks: Task[]
  blocked_tasks: Task[]
  recent_tasks: Task[]
  recent_reports: Report[]
  missing_reports: User[]
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

export async function register(data: { email: string; password: string; full_name?: string; department?: string }): Promise<string> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    let detail = "Registration failed"
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  const result = (await res.json()) as { access_token: string }
  setToken(result.access_token)
  return result.access_token
}

export const getMe = () => request<User>("/auth/me")

export async function onboard(token: string, password: string, full_name?: string, department?: string): Promise<string> {
  const body = new URLSearchParams({ token, password })
  if (full_name) body.append("full_name", full_name)
  if (department) body.append("department", department)
  
  const res = await request<{ access_token: string }>("/auth/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  setToken(res.access_token)
  return res.access_token
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  })
}

// ---- Users ----
export const listUsers = () => request<User[]>("/users")

export interface UserCreate {
  email: string
  full_name?: string
  department?: string
  role?: Role
}

export interface UserInvite extends User {
  onboardingToken: string
  onboardingUrl: string
  emailSent: boolean
  emailError: string | null
}

export interface UserUpdate {
  email?: string
  full_name?: string | null
  department?: string | null
  role?: Role
  is_active?: boolean
  resend_invite?: boolean
}

export interface UserUpdateResult extends User {
  onboardingUrl?: string | null
  emailSent?: boolean
  emailError?: string | null
}

export const createUser = (data: UserCreate) =>
  request<UserInvite>("/users", { method: "POST", body: JSON.stringify(data) })

export const getUser = (id: number) => request<UserDetail>(`/users/${id}`)

export const updateUser = (id: number, data: UserUpdate) =>
  request<UserUpdateResult>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const deleteUser = (id: number) =>
  request<void>(`/users/${id}`, { method: "DELETE" })

// ---- Projects ----
export const listProjects = () => request<Project[]>("/projects")

export const getProject = (id: number) => request<Project>(`/projects/${id}`)

export interface ProjectCreate {
  name: string
  description?: string
  department?: string
  status?: string
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
  department?: string | null
  status?: string
  owner_id?: number | null
}

export const createProject = (data: ProjectCreate) =>
  request<Project>("/projects", { method: "POST", body: JSON.stringify(data) })

export const updateProject = (id: number, data: ProjectUpdate) =>
  request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

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

export async function createReview(data: ReviewCreate | FormData): Promise<Review> {
  if (data instanceof FormData) {
    const res = await fetch(`${API_URL}/reviews`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: data,
    })
    if (!res.ok) throw new Error("Failed to create review")
    return res.json() as Promise<Review>
  }
  return request<Review>("/reviews", { method: "POST", body: JSON.stringify(data) })
}
export const updateReview = (id: number, patch: Partial<Review>) =>
  request<Review>(`/reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })

// ---- Review notes ----
export const listReviewComments = (reviewId: number, opts: { limit?: number } = {}) => {
  const params = new URLSearchParams()
  if (opts.limit != null) params.set("limit", String(opts.limit))
  const qs = params.toString()
  return request<ReviewComment[]>(`/reviews/${reviewId}/comments${qs ? `?${qs}` : ""}`)
}

export const addReviewComment = (reviewId: number, content: string) =>
  request<ReviewComment>(`/reviews/${reviewId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })

export const listComments = listReviewComments
export const addComment = addReviewComment

// ---- Direct messages ----
export interface DirectMessage {
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

export const getConversation = (userId: number, opts: { limit?: number } = {}) => {
  const params = new URLSearchParams()
  if (opts.limit != null) params.set("limit", String(opts.limit))
  const qs = params.toString()
  return request<DirectMessage[]>(`/messages/${userId}${qs ? `?${qs}` : ""}`)
}

export const sendMessage = (userId: number, content: string) =>
  request<DirectMessage>(`/messages/${userId}`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })

// ---- Tasks ----
export interface TaskFilters {
  projectId?: number
  sprintId?: number
  assigneeId?: number
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
}

export const listTasks = (filters: TaskFilters | number = {}) => {
  const params = new URLSearchParams()
  const opts = typeof filters === "number" ? { projectId: filters } : filters
  if (opts.projectId != null) params.set("project_id", String(opts.projectId))
  if (opts.sprintId != null) params.set("sprint_id", String(opts.sprintId))
  if (opts.assigneeId != null) params.set("assignee_id", String(opts.assigneeId))
  if (opts.status) params.set("status", opts.status)
  if (opts.priority) params.set("priority", opts.priority)
  if (opts.search) params.set("search", opts.search)
  const qs = params.toString()
  return request<Task[]>(`/tasks${qs ? `?${qs}` : ""}`)
}

export const getTask = (id: number) => request<Task>(`/tasks/${id}`)

export const createTask = (data: TaskCreate) =>
  request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) })

export const updateTask = (id: number, patch: Partial<TaskCreate>) =>
  request<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })

export const deleteTask = (id: number) =>
  request<void>(`/tasks/${id}`, { method: "DELETE" })

export const listTaskComments = (taskId: number) =>
  request<TaskComment[]>(`/tasks/${taskId}/comments`)

export const addTaskComment = (taskId: number, content: string) =>
  request<TaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })

// ---- Sprints ----
export interface SprintCreate {
  name: string
  goal?: string | null
  status?: SprintStatus
  start_date?: string | null
  end_date?: string | null
  project_id: number
}

export type SprintUpdate = Partial<SprintCreate>

export const listSprints = (opts: { projectId?: number; status?: SprintStatus } = {}) => {
  const params = new URLSearchParams()
  if (opts.projectId != null) params.set("project_id", String(opts.projectId))
  if (opts.status) params.set("status", opts.status)
  const qs = params.toString()
  return request<Sprint[]>(`/sprints${qs ? `?${qs}` : ""}`)
}

export const createSprint = (data: SprintCreate) =>
  request<Sprint>("/sprints", { method: "POST", body: JSON.stringify(data) })

export const updateSprint = (id: number, data: SprintUpdate) =>
  request<Sprint>(`/sprints/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

export const deleteSprint = (id: number) =>
  request<void>(`/sprints/${id}`, { method: "DELETE" })

// ---- Reports ----
export const listReports = (opts: { projectId?: number; submitterId?: number; dateFrom?: string; dateTo?: string } | number = {}) => {
  const params = new URLSearchParams()
  const filters = typeof opts === "number" ? { projectId: opts } : opts
  if (filters.projectId != null) params.set("project_id", String(filters.projectId))
  if (filters.submitterId != null) params.set("submitter_id", String(filters.submitterId))
  if (filters.dateFrom) params.set("date_from", filters.dateFrom)
  if (filters.dateTo) params.set("date_to", filters.dateTo)
  const qs = params.toString()
  return request<Report[]>(`/reports${qs ? `?${qs}` : ""}`)
}

export const createReport = (data: ReportCreate, attachments: File[] = []) => {
  if (attachments.length === 0) {
    return request<Report>("/reports", { method: "POST", body: JSON.stringify(data) })
  }

  const formData = new FormData()
  formData.append("payload", JSON.stringify(data))
  attachments.forEach((file) => formData.append("attachments", file))
  return requestMultipart<Report>("/reports", formData, { method: "POST" })
}

export const updateReport = (id: number, data: ReportUpdate, attachments: File[] = []) => {
  if (attachments.length === 0) {
    return request<Report>(`/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  const formData = new FormData()
  formData.append("payload", JSON.stringify(data))
  attachments.forEach((file) => formData.append("attachments", file))
  return requestMultipart<Report>(`/reports/${id}`, formData, { method: "PATCH" })
}

export const deleteReport = (id: number) =>
  request<void>(`/reports/${id}`, { method: "DELETE" })

export const deleteReportAttachment = (reportId: number, attachmentId: number) =>
  request<void>(`/reports/${reportId}/attachments/${attachmentId}`, {
    method: "DELETE",
  })

export async function downloadReportAttachment(reportId: number, attachment: ReportAttachment) {
  const token = getToken()
  const res = await fetch(`${API_URL}/reports/${reportId}/attachments/${attachment.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const payload = await res.json()
      detail = payload.detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : "Download failed")
  }

  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = attachment.file_name
  link.rel = "noreferrer"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// ---- Dashboard ----
export const getDashboardSummary = () => request<DashboardSummary>("/dashboard/summary")

// ---- AI Summarizer ----
export interface AISummary {
  summary: string
  generated_at: string
}
export const getAISummary = () => request<AISummary>("/summarize", { method: "POST" })
