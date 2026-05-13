import { SUPABASE_URL, publicBookPhotoUrl, STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'

/** Public object path segment after bucket name. */
const BUCKET_PUBLIC_PREFIX = `${STORAGE_BUCKET_BOOK_PHOTOS}/`

function looksLikeAnswerHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s.trim())
}

/** True if this segment is almost certainly a stored photo reference (not prose). */
export function segmentLooksLikePhotoSegment(t: string): boolean {
  const s = t.trim()
  if (!s) return false
  if (/^https?:\/\//i.test(s)) return true
  if (s.startsWith('/storage/v1/') || s.startsWith('storage/v1/')) return true
  if (s.includes(`/object/public/${STORAGE_BUCKET_BOOK_PHOTOS}/`)) return true
  if (new RegExp(`^${STORAGE_BUCKET_BOOK_PHOTOS}/`).test(s)) return true
  if (s.includes('supabase.co') && s.includes('/storage/')) return true
  const lower = s.toLowerCase()
  if (/\.(jpe?g|png|gif|webp|avif|heic|heif)(\?|$)/i.test(lower)) return true
  /** Custom uploads: `…/custom-{pageId}-{slot}-…` */
  if (/\/custom-[^/]+-\d+-/i.test(s)) return true
  /** Bare bucket keys: `orderId/...` — allow letters, digits, hyphen, underscore, dot, slash (ASCII-safe). */
  if (!s.includes('://') && !s.includes('<') && !/\s/.test(s) && s.includes('/')) {
    if (/^[a-zA-Z0-9._\-\/]+$/.test(s) && s.length >= 8) return true
  }
  return false
}

/**
 * Normalizes stored book photo references to an absolute URL the browser can load.
 * Does **not** strip `?…` (signed URLs must keep query).
 */
export function resolveBookPhotoImageUrl(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''

  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('//')) return `https:${s}`

  const base = (SUPABASE_URL || '').replace(/\/+$/, '')

  if (s.startsWith('/storage/v1/')) {
    return base ? `${base}${s}` : s
  }
  if (s.startsWith('storage/v1/')) {
    return base ? `${base}/${s}` : `/${s}`
  }

  const bucketInPath = s.includes(BUCKET_PUBLIC_PREFIX)
  if (bucketInPath && !s.includes('://')) {
    const idx = s.indexOf(BUCKET_PUBLIC_PREFIX)
    const objectPath = s.slice(idx + BUCKET_PUBLIC_PREFIX.length).replace(/^\/+/, '')
    return publicBookPhotoUrl(objectPath)
  }

  if (!s.includes('://') && !s.startsWith('/') && segmentLooksLikePhotoSegment(s) && !looksLikeAnswerHtml(s)) {
    return publicBookPhotoUrl(s.replace(/^\/+/, ''))
  }

  return s
}

/**
 * Storage object key inside the `book-photos` bucket (no bucket prefix).
 * Returns `null` for non-book-photos references or URLs that already carry a signed `token` (use as-is).
 */
export function extractBookPhotosStorageObjectPath(raw: string): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  if (/[?&]token=/.test(s)) return null

  const esc = STORAGE_BUCKET_BOOK_PHOTOS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fromUrl = s.match(new RegExp(`/object/(?:public|sign)/${esc}/([^?]+)`, 'i'))
  if (fromUrl?.[1]) {
    try {
      return decodeURIComponent(fromUrl[1])
    } catch {
      return fromUrl[1]
    }
  }

  /** Supabase image transformation URLs use `/render/image/public/{bucket}/…` */
  const renderMatch = s.match(new RegExp(`/render/image/public/${esc}/([^?]+)`, 'i'))
  if (renderMatch?.[1]) {
    try {
      return decodeURIComponent(renderMatch[1])
    } catch {
      return renderMatch[1]
    }
  }

  if (s.startsWith(`${STORAGE_BUCKET_BOOK_PHOTOS}/`)) {
    return s.slice(STORAGE_BUCKET_BOOK_PHOTOS.length + 1)
  }

  if (!/^https?:\/\//i.test(s) && !s.includes('<') && !/\s/.test(s)) {
    const cleaned = s.replace(/^\/+/, '')
    if (cleaned.includes('/') && /^[a-zA-Z0-9._\-\/]+$/.test(cleaned)) {
      return cleaned
    }
  }

  /** Last resort: first `book-photos/` segment in any Supabase storage URL */
  const needle = `${STORAGE_BUCKET_BOOK_PHOTOS}/`
  const idx = s.toLowerCase().indexOf(needle.toLowerCase())
  if (idx >= 0) {
    let rest = s.slice(idx + needle.length).split('?')[0]
    try {
      rest = decodeURIComponent(rest)
    } catch {
      /* keep */
    }
    rest = rest.replace(/^\/+/, '')
    if (/^[a-zA-Z0-9][a-zA-Z0-9._\-\/]*$/.test(rest)) return rest
  }

  return null
}

/** Pipe-separated photo slots as stored (before resolving to absolute URLs). Prefer for Storage paths. */
export function splitPhotoAnswerRawSegments(answer: string): string[] {
  const s = (answer || '').trim()
  if (!s) return []
  return s.split('|').map((p) => p.trim()).filter(Boolean)
}

/** `custom_pages.photo_path` and similar pipe-separated storage refs (trim each segment). */
export function splitStoredPhotoPipeList(s: string | null | undefined): string[] {
  const v = (s ?? '').trim()
  if (!v) return []
  return v.split('|').map((x) => x.trim()).filter(Boolean)
}

export function splitPhotoAnswerToResolvedUrls(answer: string): string[] {
  const s = (answer || '').trim()
  if (!s) return []
  return s
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(resolveBookPhotoImageUrl)
}

/** Non-empty URLs after resolution (for `<img src>`). */
export function resolvedPhotoUrlsFromAnswer(answer: string | null | undefined): string[] {
  return splitPhotoAnswerToResolvedUrls(answer ?? '').filter(Boolean)
}

/** True when `answer` is photo slot(s), not rich HTML / plain prose. */
export function isPhotoAnswerString(answer: string | null | undefined): boolean {
  const s = (answer ?? '').trim()
  if (!s) return false
  if (looksLikeAnswerHtml(s)) return false
  if (s.includes('|')) {
    const parts = s.split('|').map((p) => p.trim()).filter(Boolean)
    return parts.length > 0 && parts.every(segmentLooksLikePhotoSegment)
  }
  return segmentLooksLikePhotoSegment(s)
}

/** Preview / editor: treat as photo if classification passes OR we can resolve at least one photo URL. */
export function answerDisplaysAsPhotoContent(answer: string | null | undefined): boolean {
  const s = (answer ?? '').trim()
  if (!s || looksLikeAnswerHtml(s)) return false
  if (isPhotoAnswerString(s)) return true
  const parts = s.split('|').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return false
  if (!parts.every(segmentLooksLikePhotoSegment)) return false
  return resolvedPhotoUrlsFromAnswer(s).length > 0
}
