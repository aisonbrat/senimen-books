import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type AppRole = 'client' | 'editor' | 'designer' | 'manager' | 'admin'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

export type AuthedProfile =
  | { ok: true; user: User; role: AppRole; supabase: ServerSupabase }
  | { ok: false; error: string }

/**
 * Loads the current Supabase session and `profiles.role` using the anon SSR client (RLS applies).
 */
export async function requireAuthenticatedProfile(): Promise<AuthedProfile> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return { ok: false, error: 'Кіру қажет' }
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr || !profile) {
    return { ok: false, error: 'Профиль табылмады' }
  }

  const role = (profile.role ?? 'client') as AppRole
  return { ok: true, user, role, supabase }
}

/** Caller must be exactly `admin`. */
export async function requireAdmin(): Promise<AuthedProfile> {
  const r = await requireAuthenticatedProfile()
  if (!r.ok) return r
  if (r.role !== 'admin') {
    return { ok: false, error: 'Тек әкімші осы әрекетті орындай алады.' }
  }
  return r
}

/** Caller must have one of the given roles (e.g. `['admin','manager']`). */
export async function requireStaff(allowed: readonly AppRole[]): Promise<AuthedProfile> {
  const r = await requireAuthenticatedProfile()
  if (!r.ok) return r
  if (!allowed.includes(r.role)) {
    return { ok: false, error: 'Бұл әрекетке құқығыңыз жоқ.' }
  }
  return r
}

/** Privileged admin-area mutations that may be delegated to managers in server code paths. */
export async function requireAdminOrManager(): Promise<AuthedProfile> {
  return requireStaff(['admin', 'manager'])
}
