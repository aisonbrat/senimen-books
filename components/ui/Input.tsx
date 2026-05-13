import { clsx } from 'clsx'
import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const labelCls =
  'text-[11px] font-semibold text-[color:var(--text-muted)] uppercase tracking-[0.06em]'

export function Input({ label, error, className, id, ...props }: InputProps) {
  const genId = useId()
  const inputId = id ?? genId.replace(/:/g, '')

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label htmlFor={inputId} className={labelCls}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={clsx(
          'w-full px-4 py-2.5 rounded-[var(--radius-md)] text-[14px] text-[color:var(--text-primary)] outline-none',
          'bg-[color:var(--surface)] border border-[color:var(--border)]',
          'shadow-[var(--shadow-xs)]',
          'transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          'placeholder:text-[color:var(--text-muted)]',
          'focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring),var(--shadow-xs)]',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-subtle)]',
          error && 'border-red-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
          className
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-err`} role="alert" className="text-[13px] font-medium leading-snug text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextArea({ label, error, className, ...props }: TextAreaProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className={labelCls}>{label}</label>}
      <textarea
        className={clsx(
          'w-full px-4 py-3 rounded-[var(--radius-md)] text-[14px] text-[color:var(--text-primary)] outline-none',
          'bg-[color:var(--surface)] border border-[color:var(--border)]',
          'shadow-[var(--shadow-xs)]',
          'transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          'resize-y leading-relaxed placeholder:text-[color:var(--text-muted)]',
          'focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring),var(--shadow-xs)]',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-subtle)]',
          error && 'border-red-400 focus:border-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
    </div>
  )
}
