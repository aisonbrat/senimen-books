'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Тапсырыстар', href: '/admin/orders', icon: '◈' },
  { label: 'Тегін кезең', href: '/admin/trial', icon: '◇' },
  { label: 'Пайдаланушылар', href: '/admin/users', icon: '◉' },
  { label: 'Үлгілер', href: '/admin/templates', icon: '▦' },
  { label: 'Пікірлер', href: '/admin/reviews', icon: '◎' },
  { label: 'Профиль', href: '/admin/profile', icon: '○' },
]

const NAV_COLLAPSE_LS_KEY = 'senimen-admin-nav-collapsed'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [desktopPeek, setDesktopPeek] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabaseRef = useRef<SupabaseClient | null>(null)

  const navWide = !desktopCollapsed || desktopPeek
  const navW = navWide ? 220 : 72

  const getSupabase = useCallback((): SupabaseClient | null => {
    if (typeof window === 'undefined') return null
    if (!supabaseRef.current) {
      try {
        supabaseRef.current = createClient()
      } catch {
        return null
      }
    }
    return supabaseRef.current
  }, [])

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(NAV_COLLAPSE_LS_KEY) === '1') {
        setDesktopCollapsed(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) router.push('/auth/login')
      else setUser(u)
    })
  }, [router, getSupabase])

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  const setCollapsedPersist = useCallback((next: boolean) => {
    setDesktopCollapsed(next)
    setDesktopPeek(false)
    try {
      localStorage.setItem(NAV_COLLAPSE_LS_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const handleAsidePointerEnter = () => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width:768px)').matches && desktopCollapsed) {
      setDesktopPeek(true)
    }
  }

  const handleAsidePointerLeave = () => {
    setDesktopPeek(false)
  }

  async function handleLogout() {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function go(href: string) {
    router.push(href)
    setNavOpen(false)
  }

  return (
    <div
      className="flex min-h-screen bg-[color:var(--bg-page)]"
      style={{ ['--admin-nav-w' as string]: `${navW}px` }}
    >
      {navOpen && (
        <button
          type="button"
          aria-label="Мәзірді жабу"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 md:hidden">
        <img src="/logo.svg" alt="Сенімен" className="h-[24px] w-auto object-contain" />
        <button
          type="button"
          className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-[12px] font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--border)]"
          onClick={() => setNavOpen(true)}
          aria-expanded={navOpen}
        >
          Мәзір
        </button>
      </header>

      <aside
        onMouseEnter={handleAsidePointerEnter}
        onMouseLeave={handleAsidePointerLeave}
        className={clsx(
          'fixed bottom-0 left-0 top-0 z-50 flex shrink-0 flex-col',
          'border-r border-[color:var(--border)] bg-[color:var(--surface)]',
          'transition-[transform,width] duration-200 ease-out',
          'w-[min(260px,88vw)] md:z-10 md:w-[var(--admin-nav-w)]',
          navOpen ? 'translate-x-0 shadow-[var(--shadow-xl)]' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div
          className={clsx(
            'flex items-start justify-between gap-2 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:block md:pt-6',
            !navWide && 'md:px-3'
          )}
        >
          <div className={clsx(!navWide && 'md:flex md:flex-col md:items-center')}>
            <img src="/logo.svg" alt="Сенімен" className={clsx('h-[28px] w-auto object-contain', !navWide && 'md:mx-auto')} />
            <div
              className={clsx(
                'mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-1',
                !navWide && 'md:hidden'
              )}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-[var(--radius-sm)] border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-subtle)] md:hidden"
            onClick={() => setNavOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="mx-4 h-px bg-[color:var(--border)]" />

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          {NAV.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/admin/orders' && pathname.startsWith(item.href))
            return (
              <button
                key={item.href}
                type="button"
                title={item.label}
                onClick={() => go(item.href)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-[13px] font-medium',
                  'transition-colors duration-[var(--transition)]',
                  !navWide && 'md:justify-center md:gap-0 md:px-2',
                  isActive
                    ? 'bg-[color:var(--accent-surface)] font-semibold text-[color:var(--accent)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <span className={clsx('text-[14px] leading-none', isActive ? 'opacity-80' : 'opacity-40')} aria-hidden>
                  {item.icon}
                </span>
                <span className={clsx('truncate', !navWide && 'md:hidden')}>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-[color:var(--border)] px-4 py-4">
          <button
            type="button"
            className="mb-3 hidden w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] py-2 text-[11px] font-bold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--border)] md:flex"
            onClick={() => setCollapsedPersist(!desktopCollapsed)}
            aria-pressed={desktopCollapsed}
            title={desktopCollapsed ? 'Мәзірді ашу (немесе тінтуірді үстінде ұстаңыз)' : 'Мәзірді жиырау'}
          >
            <span aria-hidden className="text-[13px]">
              {desktopCollapsed ? '⟩' : '⟨'}
            </span>
            <span className={clsx(!navWide && 'md:hidden')}>{desktopCollapsed ? 'Кеңейту' : 'Жиырау'}</span>
          </button>
          <div className={clsx('mb-2 truncate text-[11px] font-medium text-[color:var(--text-muted)]', !navWide && 'md:hidden')}>
            {user?.email}
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-[12px] font-semibold text-[color:var(--text-muted)] transition-colors duration-[var(--transition)] hover:text-[color:var(--accent)]"
          >
            Шығу →
          </button>
        </div>
      </aside>

      <div className="min-h-screen flex-1 pt-14 transition-[padding] duration-200 ease-out md:pl-[var(--admin-nav-w)] md:pt-0">
        {children}
      </div>
    </div>
  )
}
