import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import { requestIsHttps, supabaseAuthCookieOptions } from '@/lib/supabase/supabaseCookies'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/start') {
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  const response = NextResponse.next({ request })

  const isHttps = requestIsHttps(request.headers, request.nextUrl)
  const cookieDefaults = supabaseAuthCookieOptions(isHttps)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieDefaults,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, {
              ...options,
              ...cookieDefaults,
            })
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user) {
    const guestAllowed =
      path.startsWith('/auth') ||
      path.startsWith('/design-preview') ||
      path.startsWith('/privacy') ||
      path.startsWith('/landing') ||
      path.startsWith('/feedback') ||
      path === '/' ||
      path.startsWith('/api/public/')
    if (guestAllowed) return response

    const login = new URL('/auth/login', request.url)
    if (
      path.startsWith('/dashboard') ||
      path.startsWith('/editor-dashboard') ||
      path.startsWith('/manager-dashboard') ||
      path.startsWith('/admin')
    ) {
      const next = `${path}${request.nextUrl.search || ''}`
      if (next && next !== '/auth/login') login.searchParams.set('next', next)
      return NextResponse.redirect(login)
    }

    return NextResponse.redirect(new URL('/landing', request.url))
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role ?? 'client'
  if (profileErr && process.env.NODE_ENV === 'development') {
    console.warn('[proxy] profiles lookup:', profileErr.message)
  }

  if (path === '/') {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin/orders', request.url))
    if (role === 'editor') return NextResponse.redirect(new URL('/editor-dashboard', request.url))
    if (role === 'manager') return NextResponse.redirect(new URL('/manager-dashboard', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (path.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (path.startsWith('/editor-dashboard') && role !== 'editor' && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (path.startsWith('/manager-dashboard') && role !== 'manager' && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (path === '/dashboard' && role === 'editor') {
    return NextResponse.redirect(new URL('/editor-dashboard', request.url))
  }
  if (path === '/dashboard' && role === 'manager') {
    return NextResponse.redirect(new URL('/manager-dashboard', request.url))
  }

  if (path.startsWith('/auth')) {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin/orders', request.url))
    if (role === 'editor') return NextResponse.redirect(new URL('/editor-dashboard', request.url))
    if (role === 'manager') return NextResponse.redirect(new URL('/manager-dashboard', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|fonts|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
}
