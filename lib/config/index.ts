/**
 * Single source of truth for runtime configuration.
 *
 * All `process.env` reads live here so the rest of the codebase imports
 * named constants instead of stringly-typed env keys. Do NOT add server-only
 * secrets here — keep this file safe for the browser bundle. Server-only
 * config (service role key, Gemini API key) reads `process.env` directly
 * inside server code paths.
 *
 * Validation philosophy
 * ─────────────────────
 * Module-load `throw` on a public env is dangerous: a transient mis-config or
 * a stale dev bundle takes the entire route down. We therefore READ public
 * vars softly (warn in dev, default to '') and let the consumer (e.g. the
 * Supabase client) fail at the point of use. Server-only callers that
 * absolutely require a value must use `requirePublicEnv()` inside their own
 * server-side execution path.
 */

function readPublicEnv(key: string): string {
  if (typeof process === 'undefined') return ''
  const v = process.env[key]
  return typeof v === 'string' ? v : ''
}

/**
 * Hard require — throws if the env is missing. Safe to use *inside server
 * code paths* (Route Handlers, Server Actions, `app/api/*`). Do NOT call at
 * module top-level on the client bundle: that would crash any route that
 * imports this file when an env happens to be temporarily empty.
 */
export function requirePublicEnv(key: string): string {
  const v = readPublicEnv(key)
  if (!v) {
    throw new Error(`Missing required public env: ${key}`)
  }
  return v
}

/**
 * Supabase browser client: Next.js only inlines `NEXT_PUBLIC_*` when you read
 * `process.env.NEXT_PUBLIC_…` as a literal property. Dynamic access like
 * `process.env[key]` stays empty in the client bundle — see Next docs on env.
 */
export const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/** Legacy anon JWT or new `sb_publishable_…` key from Dashboard → API. */
export const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (process.env.NODE_ENV !== 'production') {
  if (!SUPABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] NEXT_PUBLIC_SUPABASE_URL is empty. Supabase calls will fail until this env is set in `.env.local` and the dev server is restarted.'
    )
  }
  if (!SUPABASE_ANON_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] NEXT_PUBLIC_SUPABASE_ANON_KEY is empty. Supabase calls will fail until this env is set in `.env.local` and the dev server is restarted.'
    )
  }
}

/** Storage bucket name used for both photo uploads and PDF assets. */
export const STORAGE_BUCKET_BOOK_PHOTOS = 'book-photos'

/**
 * When `true`, `book-photos` objects are readable via the public object URL
 * (`/object/public/book-photos/…`) without `createSignedUrl`. Set in `.env.local`
 * to match a public bucket; omit or `false` for private buckets (RLS + signed URLs).
 */
export function bookPhotosBucketIsPublic(): boolean {
  return process.env.NEXT_PUBLIC_BOOK_PHOTOS_BUCKET_PUBLIC === 'true'
}

/** Public CDN URL for an object inside the book photos bucket (object key only, no bucket prefix). */
export function publicBookPhotoUrl(path: string): string {
  const key = String(path || '').replace(/^\/+/, '')
  const base = SUPABASE_URL.replace(/\/+$/, '')
  if (!base) {
    return `/storage/v1/object/public/${STORAGE_BUCKET_BOOK_PHOTOS}/${key}`
  }
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET_BOOK_PHOTOS}/${key}`
}

/**
 * Brand color (used by JS-generated styles where `var(--accent)` is not
 * available). Mirrors `--accent` in `app/globals.css`.
 */
export const BRAND_ACCENT = '#731616'
export const BRAND_ACCENT_HOVER = '#5c1212'

/** AI enhancement limits. Surfaced here so admin tooling and the API agree. */
export const AI_ENHANCE_MAX_INPUT_CHARS = 6000
/** Hard cap on raw HTTP body bytes before we even try to parse JSON. */
export const AI_ENHANCE_MAX_BODY_BYTES = 32 * 1024

/** Client • trial (`orders.trial_mode`): max successful ЖИ taps per блок (lifetime). Grammar/polish/literary share one pool. */
export const AI_CLIENT_TRIAL_SUCCESSES_PER_BLOCK = 5

/** Client • full book (`trial_mode` off): sliding window length. */
export const AI_CLIENT_PAID_WINDOW_MINUTES = 30

/** Client • full book: max successes per блок within the sliding window. */
export const AI_CLIENT_PAID_SUCCESSES_PER_BLOCK_WINDOW = 10
