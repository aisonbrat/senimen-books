import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

type TagTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'violet'

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone
  size?: 'sm' | 'md'
  /** Optional icon node rendered before the label. */
  leading?: ReactNode
}

/**
 * Tag / chip / pill — single source of truth for status indicators, role
 * badges, and small inline metadata. Tones are deliberately desaturated so
 * the UI never feels noisy.
 */
export function Tag({ tone = 'neutral', size = 'sm', leading, className, children, ...props }: TagProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-tight whitespace-nowrap',
        'ring-1 ring-inset',
        size === 'sm' && 'px-2 py-0.5 text-[11px]',
        size === 'md' && 'px-2.5 py-1 text-[12px]',
        tone === 'neutral' && 'bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)] ring-[color:var(--border)]',
        tone === 'accent' && 'bg-[color:var(--accent-surface)] text-[color:var(--accent)] ring-[color:var(--accent-ring)]',
        tone === 'success' && 'bg-emerald-50 text-emerald-900 ring-emerald-900/10',
        tone === 'warning' && 'bg-amber-50 text-amber-950 ring-amber-900/12',
        tone === 'info' && 'bg-sky-50 text-sky-900 ring-sky-900/10',
        tone === 'danger' && 'bg-red-50 text-red-900 ring-red-900/10',
        tone === 'violet' && 'bg-violet-50 text-violet-900 ring-violet-900/10',
        className
      )}
      {...props}
    >
      {leading ? <span className="-ml-0.5 inline-flex shrink-0">{leading}</span> : null}
      {children}
    </span>
  )
}
