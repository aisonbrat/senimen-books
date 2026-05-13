/**
 * Unified book-photos Storage access (public vs private bucket).
 *
 * JS client uses the text bucket name `book-photos` with `.from(STORAGE_BUCKET_BOOK_PHOTOS)`.
 * Postgres `storage.objects.bucket_id` is a UUID — policies use
 * `bucket_id in (select id from storage.buckets where name = 'book-photos')`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { bookPhotosBucketIsPublic, publicBookPhotoUrl, STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'
import {
  extractBookPhotosStorageObjectPath,
  resolveBookPhotoImageUrl,
} from '@/lib/utils/bookPhotoUrl'

export type NormalizedBookPhotoRef =
  | { kind: 'empty' }
  | { kind: 'supabase_signed_http'; url: string }
  | { kind: 'object_key'; key: string }
  | { kind: 'resolved_http'; url: string }
  | { kind: 'opaque'; raw: string }

function isSupabaseStorageSignedObjectUrl(raw: string): boolean {
  const s = raw.trim()
  return /\/object\/sign\//i.test(s) && /[?&]token=/.test(s)
}

/** Raw string and resolved URL — DB shapes differ (relative `/storage/…`, bare `orderId/…`). */
export function candidateStorageObjectPaths(raw: string): string[] {
  const s = raw.trim()
  if (!s) return []
  const seen = new Set<string>()
  const add = (p: string | null | undefined) => {
    if (!p) return
    if (!seen.has(p)) seen.add(p)
  }
  add(extractBookPhotosStorageObjectPath(s))
  add(extractBookPhotosStorageObjectPath(resolveBookPhotoImageUrl(s)))
  return [...seen]
}

export function normalizeBookPhotoRef(raw: string): NormalizedBookPhotoRef {
  const s = (raw || '').trim()
  if (!s) return { kind: 'empty' }
  if (isSupabaseStorageSignedObjectUrl(s)) {
    const url = /^https?:\/\//i.test(s) ? s : resolveBookPhotoImageUrl(s)
    return { kind: 'supabase_signed_http', url }
  }
  const paths = candidateStorageObjectPaths(s)
  if (paths.length > 0 && paths[0]) return { kind: 'object_key', key: paths[0] }
  const resolved = resolveBookPhotoImageUrl(s)
  if (/^https?:\/\//i.test(resolved)) return { kind: 'resolved_http', url: resolved }
  return { kind: 'opaque', raw: s }
}

export async function fetchBookPhotoViaNextRoute(objectPath: string, signal?: AbortSignal): Promise<Blob | null> {
  if (typeof window === 'undefined') return null
  try {
    const url = `/api/book-photo?path=${encodeURIComponent(objectPath)}`
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal })
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[bookPhotos] /api/book-photo', objectPath.slice(0, 80), '→', res.status)
      }
      return null
    }
    return await res.blob()
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[bookPhotos] /api/book-photo fetch error', e)
    }
    return null
  }
}

function logDevSignedUrlFailure(objectPath: string, error: { message?: string; statusCode?: string | number; name?: string }) {
  if (process.env.NODE_ENV === 'production') return
  // eslint-disable-next-line no-console
  console.warn('[bookPhotos] createSignedUrl failed', {
    bucket: STORAGE_BUCKET_BOOK_PHOTOS,
    objectPath,
    message: error.message,
    statusCode: error.statusCode,
    name: error.name,
  })
}

export type GetDisplayableUrlOptions = {
  signal?: AbortSignal
  /**
   * When true, never returns a `blob:` URL (HTTP URLs only). Use for contexts
   * that must pass the string to non-DOM consumers.
   */
  httpOnly?: boolean
}

/**
 * Returns a string suitable for `<img src>` or `fetch()`:
 * - **Public bucket** (`NEXT_PUBLIC_BOOK_PHOTOS_BUCKET_PUBLIC=true`): public object URL from storage key.
 * - **Private**: signed URL from the user session, then optional same-origin `/api/book-photo` → `blob:` (unless `httpOnly`).
 * - Already-signed Supabase URLs are normalized to absolute `https://…`.
 */
export async function getDisplayableUrl(
  supabase: SupabaseClient,
  ref: string,
  options?: GetDisplayableUrlOptions,
): Promise<string> {
  const s = (ref || '').trim()
  if (!s) return ''
  const signal = options?.signal

  if (isSupabaseStorageSignedObjectUrl(s)) {
    return /^https?:\/\//i.test(s) ? s : resolveBookPhotoImageUrl(s)
  }

  if (bookPhotosBucketIsPublic()) {
    for (const key of candidateStorageObjectPaths(s)) {
      if (key) return publicBookPhotoUrl(key)
    }
    const r = resolveBookPhotoImageUrl(s)
    return r && r.trim() ? r : ''
  }

  for (const objectPath of candidateStorageObjectPaths(s)) {
    if (signal?.aborted) return ''
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_BOOK_PHOTOS)
      .createSignedUrl(objectPath, 3600)
    if (!error && data?.signedUrl) return data.signedUrl
    if (error) logDevSignedUrlFailure(objectPath, error)
  }

  if (!options?.httpOnly && typeof window !== 'undefined') {
    for (const objectPath of candidateStorageObjectPaths(s)) {
      if (signal?.aborted) return ''
      const proxied = await fetchBookPhotoViaNextRoute(objectPath, signal)
      if (proxied && typeof URL !== 'undefined' && URL.createObjectURL) {
        return URL.createObjectURL(proxied)
      }
    }
  }

  // Do NOT fall back to the public object URL for private buckets — it would return
  // 403 and force callers to retry instead of going straight to the proxy/blob path.
  return ''
}

/** Authenticated download (same RLS as signed URL). */
export async function downloadBookPhotoBlob(supabase: SupabaseClient, raw: string): Promise<Blob | null> {
  for (const objectPath of candidateStorageObjectPaths(raw)) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET_BOOK_PHOTOS).download(objectPath)
    if (!error && data) return data
    if (error && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[bookPhotos] download failed', {
        bucket: STORAGE_BUCKET_BOOK_PHOTOS,
        objectPath,
        message: error.message,
        statusCode: (error as { statusCode?: string | number }).statusCode,
      })
    }
  }
  return null
}

/**
 * Signed GET URL only (private bucket), or public object URL when bucket is public.
 * Does not use `/api/book-photo` or `blob:` URLs — for callers that need a fetchable HTTP URL.
 */
export async function createSignedBookPhotoUrl(
  supabase: SupabaseClient,
  raw: string,
): Promise<string | null> {
  const s = (raw || '').trim()
  if (!s) return null

  if (bookPhotosBucketIsPublic()) {
    for (const key of candidateStorageObjectPaths(s)) {
      if (key) return publicBookPhotoUrl(key)
    }
    return null
  }

  for (const objectPath of candidateStorageObjectPaths(s)) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_BOOK_PHOTOS)
      .createSignedUrl(objectPath, 3600)
    if (!error && data?.signedUrl) return data.signedUrl
    if (error) logDevSignedUrlFailure(objectPath, error)
  }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[bookPhotos] createSignedBookPhotoUrl: all path candidates failed', {
      candidatePaths: candidateStorageObjectPaths(s),
      rawPreview: String(raw).slice(0, 200),
    })
  }
  return null
}

export type LoadedBookPhoto = {
  /** Empty string means nothing usable (avoid broken `<img src>`). */
  src: string
  cleanup: () => void
}

/**
 * For `<img>`: prefer HTTP(s) from `getDisplayableUrl`, then authenticated download → blob.
 * Blob URLs are intentionally not revoked on cleanup — Strict Mode double-mount.
 */
export async function loadBookPhotoForDisplay(
  supabase: SupabaseClient,
  raw: string,
): Promise<LoadedBookPhoto> {
  const s = (raw || '').trim()
  if (!s) return { src: '', cleanup: () => {} }

  if (isSupabaseStorageSignedObjectUrl(s)) {
    const url = /^https?:\/\//i.test(s) ? s : resolveBookPhotoImageUrl(s)
    return { src: url, cleanup: () => {} }
  }

  const httpFirst = await getDisplayableUrl(supabase, s, { httpOnly: true })
  if (httpFirst.trim()) return { src: httpFirst, cleanup: () => {} }

  for (const objectPath of candidateStorageObjectPaths(s)) {
    const proxied = await fetchBookPhotoViaNextRoute(objectPath)
    if (proxied && typeof URL !== 'undefined' && URL.createObjectURL) {
      return { src: URL.createObjectURL(proxied), cleanup: () => {} }
    }
  }

  const blobFirst = await downloadBookPhotoBlob(supabase, s)
  if (blobFirst && typeof URL !== 'undefined' && URL.createObjectURL) {
    return { src: URL.createObjectURL(blobFirst), cleanup: () => {} }
  }

  const withBlobProxy = await getDisplayableUrl(supabase, s, { httpOnly: false })
  if (withBlobProxy.trim()) return { src: withBlobProxy, cleanup: () => {} }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[bookPhotos] loadBookPhotoForDisplay: no usable URL', { rawPreview: s.slice(0, 200) })
  }

  return { src: '', cleanup: () => {} }
}

/** Same loading as `loadBookPhotoForDisplay` but for `<img onError>` retry. */
export async function loadBookPhotoBlobUrlOnly(supabase: SupabaseClient, raw: string): Promise<string | null> {
  for (const objectPath of candidateStorageObjectPaths(raw)) {
    const proxied = await fetchBookPhotoViaNextRoute(objectPath)
    if (proxied && typeof URL !== 'undefined' && URL.createObjectURL) {
      return URL.createObjectURL(proxied)
    }
  }
  const blob = await downloadBookPhotoBlob(supabase, raw)
  if (!blob || typeof URL === 'undefined' || !URL.createObjectURL) return null
  return URL.createObjectURL(blob)
}
