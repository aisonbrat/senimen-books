import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config'
import { requestIsHttps, supabaseAuthCookieOptions } from '@/lib/supabase/supabaseCookies'

export async function createClient() {
  const cookieStore = await cookies()
  const h = await headers()
  const isHttps = requestIsHttps(h)
  const cookieDefaults = supabaseAuthCookieOptions(isHttps)

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookieOptions: cookieDefaults,
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...cookieDefaults,
              })
            )
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[supabase/server] Failed to persist auth cookies:', e)
            }
          }
        },
      },
  })
}
