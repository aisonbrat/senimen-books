import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Normalize env paste: quotes, Bearer, newlines/ZWSP; JWT must be one token (no spaces inside). */
export function normalizeSupabaseServiceRoleKey(raw: string): string {
  let s = raw
    .trim()
    .replace(/^[\uFEFF\u200B]+|[\uFEFF\u200B]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^(['"])([\s\S]*)\1$/m, '$2')
    .trim()
    .replace(/\s+/g, '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim().replace(/\s+/g, '')
  }
  return s
}

/** Base64URL middle segment → UTF-8 (Node). Normalizes to standard base64 + padding. */
function decodeJwtPayloadSegment(segment: string): string {
  const s = segment.replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(s + pad, 'base64').toString('utf8')
}

/** Decode `role` claim from Supabase JWT. Server-only. */
function jwtPayloadRole(secret: string): string | undefined {
  const normalized = normalizeSupabaseServiceRoleKey(secret)
  const parts = normalized.split('.')
  if (parts.length < 2 || !parts[0] || !parts[1]) return undefined
  try {
    const json = decodeJwtPayloadSegment(parts[1])
    const payload = JSON.parse(json) as { role?: string }
    return typeof payload.role === 'string' ? payload.role : undefined
  } catch {
    return undefined
  }
}

export type ServiceRoleInitResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string }

/**
 * Server-only Supabase client using `SUPABASE_SERVICE_ROLE_KEY`.
 * We decode the JWT and require `role === 'service_role'`.
 *
 * Never treat “missing role” as anon — misleading when the key is truncated or copy-paste breaks.
 */
export function createValidatedServiceRoleClient(): ServiceRoleInitResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const key = rawKey ? normalizeSupabaseServiceRoleKey(rawKey) : ''

  if (!url) {
    return { ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL .env файлында жоқ.' }
  }
  if (!key) {
    return {
      ok: false,
      error:
        'SUPABASE_SERVICE_ROLE_KEY жоқ. Supabase → Settings → API → «service_role» (JWT) кілмін .env.local-ға еңгізіңіз.',
    }
  }

  // Supabase may return either:
  // 1) legacy JWT service_role key (eyJ... with 3 segments), or
  // 2) new secret format `sb_secret_...` (non-JWT).
  // We only perform strict role checks for JWT-shaped keys.
  const keyLooksJwt = key.split('.').length >= 3
  const keyLooksSecret = key.startsWith('sb_secret_')

  if (keyLooksJwt) {
    const role = jwtPayloadRole(key)
    if (!role) {
      return {
        ok: false,
        error:
          'SERVICE_ROLE JWT оқылмай тұр (.env жолын тексеріңіз). Supabase → Settings → API → «service_role» өзінің көшірмесін қойыңыз: қос тырнақ/emdash жоқ, «Bearer » жоқ, үш нүктелі бір жол. Кілмді қайта сақтаған соң dev серверді қайта іске қосыңыз.',
      }
    }
    if (role === 'anon') {
      return {
        ok: false,
        error:
          'Қате: .env файлында anon кілмі тұр. Ол басқару әрекеттеріне жарамайды. Supabase → API → «service_role» кілмін салу керек.',
      }
    }
    if (role !== 'service_role') {
      return {
        ok: false,
        error: `JWT role: «${role}». Күтілген: «service_role». Кілмді қайта көшіріңіз.`,
      }
    }
  } else if (!keyLooksSecret) {
    return {
      ok: false,
      error:
        'SERVICE_ROLE кілмі танылмады. Supabase → Settings → API бөлімінен «service_role» кілмін көшіріңіз (JWT немесе sb_secret_ форматы).',
    }
  }

  return {
    ok: true,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

