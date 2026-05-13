import type { CookieOptions } from '@supabase/ssr'

/**
 * Session cookies must be marked `Secure` on HTTPS origins. In dev, `NODE_ENV`
 * stays `development` while tunnels (ngrok, etc.) still use HTTPS — without
 * `Secure`, mobile Safari/WebKit often drops auth cookies after sign-in.
 */
export function requestIsHttps(headersList: Headers, urlFallback?: URL): boolean {
  if (urlFallback?.protocol === 'https:') return true
  const proto = headersList.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (proto === 'https') return true
  if (headersList.get('x-forwarded-ssl') === 'on') return true
  return false
}

export function supabaseAuthCookieOptions(isHttps: boolean): Pick<CookieOptions, 'path' | 'sameSite' | 'secure'> {
  return {
    path: '/',
    sameSite: 'lax',
    secure: isHttps || process.env.NODE_ENV === 'production',
  }
}
