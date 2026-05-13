import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** ARIA label is required — icon-only buttons must be screen-reader labelled. */
  'aria-label': string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'subtle' | 'danger'
  children: ReactNode
}

/**
 * Icon-only button — square hit-area, single visual style across the app,
 * always accessible (`aria-label` required by the type signature). Use in
 * toolbars, chips with dismiss actions, navigation rails. Never inline a
 * raw `<button><Icon /></button>` again.
 */
export function IconButton({
  size = 'md',
  variant = 'ghost',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] outline-none',
        'transition-[color,background-color,box-shadow,transform] duration-[var(--transition)]',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]',
        'active:scale-[0.96]',
        size === 'sm' && 'size-7',
        size === 'md' && 'size-9',
        size === 'lg' && 'size-11',
        variant === 'ghost' && [
          'bg-transparent text-[color:var(--text-muted)]',
          'hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-primary)]',
        ],
        variant === 'subtle' && [
          'bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)]',
          'hover:bg-[color:var(--accent-surface)] hover:text-[color:var(--accent)]',
        ],
        variant === 'danger' && [
          'bg-transparent text-[color:var(--text-muted)]',
          'hover:bg-red-50 hover:text-red-700',
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
