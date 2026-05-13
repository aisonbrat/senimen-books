import { clsx } from 'clsx'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] outline-none cursor-pointer',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]',

        size === 'sm' && 'px-3.5 py-2 text-[13px] gap-1.5 min-h-[36px]',
        size === 'md' && 'px-[18px] py-2.5 text-[14px] gap-2 min-h-[40px]',
        size === 'lg' && 'px-6 py-3 text-[15px] gap-2 min-h-[44px]',

        variant === 'primary' && [
          'bg-[color:var(--accent)] text-white border border-transparent',
          'shadow-[var(--shadow-sm)]',
          'hover:bg-[color:var(--accent-hover)] hover:shadow-[var(--shadow-md)]',
          'active:scale-[0.99]',
        ],
        variant === 'secondary' && [
          'bg-[color:var(--surface)] text-[color:var(--text-primary)]',
          'border border-[color:var(--border)] shadow-[var(--shadow-xs)]',
          'hover:bg-[color:var(--surface-subtle)] hover:border-[color:var(--border-strong)]',
          'active:scale-[0.99]',
        ],
        variant === 'ghost' && [
          'bg-transparent text-[color:var(--text-secondary)] border border-transparent shadow-none',
          'hover:text-[color:var(--text-primary)] hover:bg-[color:var(--accent-surface)]',
        ],
        variant === 'danger' && [
          'bg-transparent text-red-600 border border-transparent shadow-none',
          'hover:bg-red-50 hover:text-red-700',
        ],

        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
