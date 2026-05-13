'use client'

import { clsx } from 'clsx'
import { useEditorStore } from '@/lib/store/editorStore'
import {
  TRIAL_LOCK_HEADLINE_KK,
  TRIAL_WHATSAPP_HREF,
} from '@/lib/constants/trialContact'
import { recordTrialWhatsappClick } from '@/app/dashboard/editor/actions'

/**
 * Covers locked trial content: blur backdrop + lock icon + manager line + WhatsApp CTA.
 */
export function TrialLockedOverlay({
  className,
  density = 'comfortable',
}: {
  className?: string
  /** `compact` fits small cards; `comfortable` for large blocks (hat, faktiler). */
  density?: 'comfortable' | 'compact'
}) {
  const orderId = useEditorStore((s) => s.order?.id ?? '')

  const pad = density === 'compact' ? 'px-2 py-2 gap-2' : 'px-4 gap-3'

  async function handleWhatsapp() {
    if (!orderId) return
    void recordTrialWhatsappClick(orderId)
  }

  return (
    <div
      className={clsx(
        'pointer-events-auto absolute inset-0 z-[25] flex flex-col items-center justify-center rounded-[inherit] bg-[color:var(--surface)]/65 px-3 backdrop-blur-md',
        pad,
        className
      )}
      role="region"
      aria-label="Тегін кезеңдегі құлыпталған бөлім"
    >
      <div
        className={clsx(
          'flex shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-subtle)] shadow-[var(--shadow-xs)] ring-2 ring-[color:var(--border)]',
          density === 'compact' ? 'size-9' : 'size-12'
        )}
      >
        <svg
          width={density === 'compact' ? 18 : 22}
          height={density === 'compact' ? 18 : 22}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="text-[color:var(--text-secondary)]"
        >
          <path d="M12 17a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
          <path
            d="M7 11V8a5 5 0 0110 0v3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <rect x="5" y="11" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      </div>
      <div className="max-w-[280px] text-center">
        <p
          className={clsx(
            'font-bold leading-snug text-[color:var(--text-primary)]',
            density === 'compact' ? 'text-[11px]' : 'text-[13px]'
          )}
        >
          {TRIAL_LOCK_HEADLINE_KK}
        </p>
      </div>
      <a
        href={TRIAL_WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => void handleWhatsapp()}
        className={clsx(
          'inline-flex max-w-[min(100%,260px)] items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--accent)] px-3 font-semibold text-white shadow-[var(--shadow-xs)] transition-[transform,opacity] hover:brightness-105 active:scale-[0.98]',
          density === 'compact' ? 'min-h-9 py-2 text-[11px] leading-tight' : 'min-h-10 py-2.5 text-[12px]'
        )}
      >
        WhatsApp арқылы жазу
      </a>
    </div>
  )
}
