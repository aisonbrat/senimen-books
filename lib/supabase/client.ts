import { createBrowserClient } from '@supabase/ssr'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config'
import { supabaseAuthCookieOptions } from '@/lib/supabase/supabaseCookies'

/**
 * Non-empty fallbacks so `@supabase/ssr` does not throw during RSC prerender of
 * Client Components when `NEXT_PUBLIC_SUPABASE_*` are missing in the build
 * environment. The browser must still have real env values (e.g. set in Vercel)
 * for any Supabase call to work at runtime.
 */
const SSR_PRERENDER_PLACEHOLDER_URL = 'https://invalid.supabase.co'
const SSR_PRERENDER_PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid-ssr-prerender-placeholder'

export function createClient() {
  const isHttps =
    typeof window !== 'undefined'
      ? window.location.protocol === 'https:'
      : process.env.NODE_ENV === 'production'

  const url = (SUPABASE_URL || '').trim()
  const key = (SUPABASE_ANON_KEY || '').trim()
  if (!url || !key) {
    if (typeof window === 'undefined') {
      return createBrowserClient(SSR_PRERENDER_PLACEHOLDER_URL, SSR_PRERENDER_PLACEHOLDER_ANON_KEY, {
        cookieOptions: supabaseAuthCookieOptions(isHttps),
      })
    }
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel → Project → Settings → Environment Variables), then redeploy.'
    )
  }

  return createBrowserClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions(isHttps),
  })
}
