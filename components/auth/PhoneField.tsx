'use client'

import type { KeyboardEvent } from 'react'
import { useRef } from 'react'
import { clsx } from 'clsx'
import {
  clampPhoneFieldDigitBuffer,
  extractNationalSubscriberDigits,
  formatInnerPhoneInputDisplay,
} from '@/lib/utils/phone'

const labelCls =
  'text-[11px] font-semibold text-[color:var(--text-muted)] uppercase tracking-[0.06em]'

interface PhoneFieldProps {
  id: string
  label: string
  /**
   * Digit-only buffer from the inner field (+7 is a static label — no phantom digit).
   */
  rawDigitSeq: string
  onRawDigitSeqChange: (digits: string) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

function digitCountBeforeCursor(display: string, cursor: number): number {
  return display.slice(0, Math.max(0, cursor)).replace(/\D/g, '').length
}

function removeSubscriberDigitAt(raw: string, digitIndex: number): string {
  if (String(raw ?? '').replace(/\D/g, '') === '8') return ''
  const sub = extractNationalSubscriberDigits(raw)
  if (digitIndex < 0 || digitIndex >= sub.length) return raw
  const nextSub = sub.slice(0, digitIndex) + sub.slice(digitIndex + 1)
  return clampPhoneFieldDigitBuffer(nextSub)
}

/** Shared with admin/manager inline +7 fields (same backspace rules as `PhoneField`). */
export function innerPhoneDigitsKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  rawDigitSeq: string,
  onRawDigitSeqChange: (next: string) => void,
  opts?: { disabled?: boolean; composing?: () => boolean }
): void {
  if (opts?.disabled || opts?.composing?.()) return
  if (e.key !== 'Backspace' && e.key !== 'Delete') return
  const el = e.currentTarget
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  if (start !== end) return
  const innerDisplay = formatInnerPhoneInputDisplay(rawDigitSeq)
  if (e.key === 'Backspace') {
    if (start === 0) {
      e.preventDefault()
      onRawDigitSeqChange(removeSubscriberDigitAt(rawDigitSeq, 0))
      return
    }
    const prev = innerDisplay[start - 1]
    if (prev === ' ') {
      e.preventDefault()
      const di = digitCountBeforeCursor(innerDisplay, start)
      onRawDigitSeqChange(removeSubscriberDigitAt(rawDigitSeq, di - 1))
    }
  }
}

/**
 * Mobile-safe phone field: static «+7», spaced national digits (707 000 00 00).
 * Caps at 10 subscriber digits; Backspace cannot get stuck on mask punctuation.
 */
export function PhoneField({
  id,
  label,
  rawDigitSeq,
  onRawDigitSeqChange,
  error,
  disabled,
  placeholder = '707 000 00 00',
}: PhoneFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)

  const innerDisplay = formatInnerPhoneInputDisplay(rawDigitSeq)

  const syncFromElement = (el: HTMLInputElement) => {
    if (composingRef.current || disabled) return
    const next = clampPhoneFieldDigitBuffer(el.value)
    if (next !== rawDigitSeq) onRawDigitSeqChange(next)
  }

  const wrapError = Boolean(error)
  const wrapFocus = clsx(
    'flex min-h-[48px] w-full items-center overflow-hidden rounded-[var(--radius-md)] border bg-[color:var(--surface)] shadow-[var(--shadow-xs)]',
    'transition-[border-color,box-shadow] duration-[var(--transition)]',
    'focus-within:border-[color:var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-ring),var(--shadow-xs)]',
    disabled && 'cursor-not-allowed bg-[color:var(--surface-subtle)] opacity-45',
    wrapError
      ? 'border-red-400 focus-within:border-red-500 focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
      : 'border-[color:var(--border)]'
  )

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className={wrapFocus}>
        <span
          className="flex shrink-0 select-none items-center pl-4 text-[16px] font-medium tabular-nums text-[color:var(--text-primary)]"
          aria-hidden
        >
          +7
        </span>
        <input
          ref={inputRef}
          id={id}
          name="tel"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={13}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          aria-label={`${label}, ұялы кодтан кейінгі 10 сан`}
          disabled={disabled}
          placeholder={placeholder}
          value={innerDisplay}
          onChange={(e) => syncFromElement(e.currentTarget)}
          onBlur={(e) => syncFromElement(e.currentTarget)}
          onPaste={() => {
            requestAnimationFrame(() => {
              const el = inputRef.current
              if (el && !composingRef.current) syncFromElement(el)
            })
          }}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false
            syncFromElement(e.currentTarget)
          }}
          onKeyDown={(e) =>
            innerPhoneDigitsKeyDown(e, rawDigitSeq, onRawDigitSeqChange, {
              disabled,
              composing: () => composingRef.current,
            })
          }
          className={clsx(
            'min-h-[48px] min-w-0 flex-1 bg-transparent py-3 pl-1 pr-4 text-[16px] font-medium leading-normal outline-none [-webkit-appearance:none]',
            'touch-manipulation placeholder:text-[color:var(--text-muted)]',
            'text-[color:var(--text-primary)]',
            'disabled:cursor-not-allowed'
          )}
        />
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] font-medium leading-snug text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
