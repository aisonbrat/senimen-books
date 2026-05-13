import { clsx } from 'clsx'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
  elevated?: boolean
}

export function Card({ padding = 'md', elevated = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-[color:var(--surface)] rounded-[var(--radius-lg)] border border-[color:var(--border)]',
        'transition-[box-shadow,border-color] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
        elevated ? 'shadow-[var(--shadow-md)]' : 'shadow-[var(--shadow-xs)]',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        padding === 'lg' && 'p-8',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
