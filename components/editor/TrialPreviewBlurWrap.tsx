'use client'

import type { ReactNode } from 'react'
import type { PreviewPage } from '@/components/editor/BookPagePreview'
import type { CustomPage, Question } from '@/lib/types'
import { isPreviewPageTrialLocked } from '@/lib/utils/trialPreviewLocked'
import { useEditorStore } from '@/lib/store/editorStore'
import { TRIAL_LOCK_HEADLINE_KK, TRIAL_WHATSAPP_HREF } from '@/lib/constants/trialContact'
import { recordTrialWhatsappClick } from '@/app/dashboard/editor/actions'

const SCALE = 1.6
const mm = (v: number) => Math.round(v * SCALE)

export function TrialPreviewBlurWrap({
  page,
  trialMode,
  flatQuestions,
  customPages,
  children,
}: {
  page: PreviewPage | null
  trialMode: boolean
  flatQuestions: Question[]
  customPages: CustomPage[]
  children: ReactNode
}) {
  const orderId = useEditorStore((s) => s.order?.id ?? '')
  const locked = isPreviewPageTrialLocked(page, trialMode, flatQuestions, customPages)
  if (!locked) return <>{children}</>

  async function handleWhatsapp() {
    if (!orderId) return
    void recordTrialWhatsappClick(orderId)
  }

  return (
    <div
      className="relative inline-block overflow-hidden align-top"
      style={{ width: mm(148), height: mm(210) }}
    >
      <div className="pointer-events-none h-full w-full blur-[5px]" aria-hidden>
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-white/45 px-1 backdrop-blur-[3px]">
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0 text-[color:var(--text-muted)]"
        >
          <path d="M12 17a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
          <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <rect x="5" y="11" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
        </svg>
        <span className="text-center text-[6.5px] font-semibold leading-[1.2] tracking-tight text-[color:var(--text-primary)]">
          {TRIAL_LOCK_HEADLINE_KK}
        </span>
        <a
          href={TRIAL_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void handleWhatsapp()}
          className="pointer-events-auto mt-0.5 rounded bg-[color:var(--accent)] px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-wide text-white"
        >
          WA
        </a>
      </div>
    </div>
  )
}
