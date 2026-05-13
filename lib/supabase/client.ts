import { createBrowserClient } from '@supabase/ssr'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config'
import { supabaseAuthCookieOptions } from '@/lib/supabase/supabaseCookies'

export function createClient() {
  const isHttps =
    typeof window !== 'undefined'
      ? window.location.protocol === 'https:'
      : process.env.NODE_ENV === 'production'

  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: supabaseAuthCookieOptions(isHttps),
  })
}
