import { z } from 'zod'

const INTERNAL_NEXT_PREFIXES = ['/dashboard', '/editor-dashboard', '/manager-dashboard', '/admin'] as const

/** After login, optional `?next=` from middleware — same-origin internal paths only (open-redirect safe). */
export function getSafeInternalNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (trimmed.includes('\0') || trimmed.length > 512) return null
  const pathOnly = trimmed.split('?')[0] || ''
  const ok = INTERNAL_NEXT_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))
  return ok ? trimmed : null
}

/** Validates `category` query from /auth/login|register URLs (open-redirect safe). */
export function normalizeTrialCategoryId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const p = z.string().uuid().safeParse(raw.trim())
  return p.success ? p.data : null
}

export function postAuthDashboardHref(categoryId: string | null | undefined): '/' | `/dashboard/new?category=${string}` {
  const id = normalizeTrialCategoryId(categoryId ?? null)
  if (!id) return '/'
  return `/dashboard/new?category=${encodeURIComponent(id)}`
}
