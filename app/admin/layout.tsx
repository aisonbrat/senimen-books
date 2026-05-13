'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Тапсырыстар', href: '/admin/orders', icon: '◈' },
  { label: 'Тегін кезең', href: '/admin/trial', icon: '◇' },
  { label: 'Пайдаланушылар', href: '/admin/users', icon: '◉' },
  { label: 'Үлгілер', href: '/admin/templates', icon: '▦' },
  { label: 'Профиль', href: '/admin/profile', icon: '○' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [navOpen, setNavOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login')
      else setUser(user)
    })
  }, [router, supabase])

  useEffect(() => { setNavOpen(false) }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function go(href: string) {
    router.push(href)
    setNavOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-[color:var(--bg-page)]">
      {/* Mobile overlay */}
      {navOpen && (
        <button
          type="button"
          aria-label="Мәзірді жабу"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Mobile top bar */}
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

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed bottom-0 left-0 top-0 z-50 flex w-[min(260px,88vw)] shrink-0 flex-col',
          'border-r border-[color:var(--border)] bg-[color:var(--surface)]',
          'transition-transform duration-200 ease-out',
          'md:z-10 md:w-[220px] md:translate-x-0',
          navOpen ? 'translate-x-0 shadow-[var(--shadow-xl)]' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-start justify-between gap-2 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:block md:pt-6">
          <div>
            <img src="/logo.svg" alt="Сенімен" className="h-[28px] w-auto object-contain" />
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-1">
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

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-3">
          {NAV.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/admin/orders' && pathname.startsWith(item.href))
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => go(item.href)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-[13px] font-medium',
                  'transition-colors duration-[var(--transition)]',
                  isActive
                    ? 'bg-[color:var(--accent-surface)] font-semibold text-[color:var(--accent)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-primary)]'
                )}
              >
                <span className={clsx('text-[14px] leading-none', isActive ? 'opacity-80' : 'opacity-40')} aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-[color:var(--border)] px-4 py-4">
          <div className="mb-2 truncate text-[11px] font-medium text-[color:var(--text-muted)]">{user?.email}</div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-[12px] font-semibold text-[color:var(--text-muted)] transition-colors duration-[var(--transition)] hover:text-[color:var(--accent)]"
          >
            Шығу →
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="min-h-screen flex-1 pt-14 md:pl-[220px] md:pt-0">{children}</div>
    </div>
  )
}
