'use client'

import Link from 'next/link'
import { clsx } from 'clsx'

type SiteHeaderProps = {
  badge?: string
  userLabel: string
  onLogout: () => void
  className?: string
  /** When set, shows a compact «Профиль» link next to the user label. */
  profileHref?: string
  /** Client bookshelf / main area — also wraps the logo when set. */
  homeHref?: string
  homeLabel?: string
}

export function SiteHeader({
  badge,
  userLabel,
  onLogout,
  className,
  profileHref,
  homeHref,
  homeLabel = 'Басты бет',
}: SiteHeaderProps) {
  const logo = <img src="/logo.svg" alt="Сенімен" className="h-8 w-auto shrink-0 object-contain" />

  return (
    <header
      className={clsx(
        'sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface)]',
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {homeHref ? (
            <Link href={homeHref} className="shrink-0 opacity-100 transition-opacity hover:opacity-90">
              {logo}
            </Link>
          ) : (
            logo
          )}
          {badge ? (
            <span className="hidden items-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-secondary)] sm:inline-flex">
              <span className="size-1 shrink-0 rounded-full bg-[color:var(--accent)]" aria-hidden />
              {badge}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <span className="hidden max-w-[220px] truncate text-[13px] font-medium text-[color:var(--text-secondary)] sm:inline">
            {userLabel}
          </span>
          {homeHref ? (
            <Link
              href={homeHref}
              className="text-[12px] font-semibold text-[color:var(--accent)] transition-colors duration-[var(--transition)] hover:underline"
            >
              {homeLabel}
            </Link>
          ) : null}
          {profileHref ? (
            <Link
              href={profileHref}
              className="text-[12px] font-semibold text-[color:var(--accent)] transition-colors duration-[var(--transition)] hover:underline"
            >
              Профиль
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            className="text-[12px] font-semibold text-[color:var(--text-muted)] transition-colors duration-[var(--transition)] hover:text-[color:var(--accent)]"
          >
            Шығу
          </button>
        </div>
      </div>
    </header>
  )
}
