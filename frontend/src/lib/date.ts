const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/

export function todayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function normalizeDateOnly(value: string | null | undefined) {
  if (!value) return ""

  const direct = value.match(DATE_ONLY_RE)?.[0]
  if (direct) return direct.slice(0, 10)

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  const normalized = normalizeDateOnly(value)
  if (!normalized) return ""

  return new Intl.DateTimeFormat([], {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${normalized}T00:00:00.000Z`))
}

export function isPastDateOnly(value: string | null | undefined, today = todayInputValue()) {
  const normalized = normalizeDateOnly(value)
  return Boolean(normalized && normalized < today)
}

export function isSuspiciousDateOnly(value: string | null | undefined) {
  const normalized = normalizeDateOnly(value)
  if (!normalized) return false

  const year = Number(normalized.slice(0, 4))
  return year < 2000 || year > 2100
}
