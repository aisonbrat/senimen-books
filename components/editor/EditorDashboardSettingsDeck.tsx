'use client'

import { useState } from 'react'
import type { Order } from '@/lib/types'
import { EditorTypographyBar } from '@/components/editor/EditorTypographyBar'
import { FixedChapterBookSettingsPanel } from '@/components/editor/FixedChapterBookSettingsPanel'
import { ClientCoverPrintPanel } from '@/components/editor/ClientCoverPrintPanel'

interface Props {
  disabled: boolean
  trialMode: boolean
  showCoverPanel: boolean
  hasFixedChapterPhrases: boolean
  uploadFixedChapterPhoto: (chapterId: string, file: File) => void | Promise<void>
  uploadAdminCoverPrint: (file: File) => void | Promise<void>
  order: Order | null
  /** When true start with panel hidden (typically mobile / trial — less vertical clutter). */
  defaultCollapsed?: boolean
}

/**
 * Single collapsible strip for dashboard editor: typography + fixed spreads + optional print cover.
 */
export function EditorDashboardSettingsDeck({
  disabled,
  trialMode,
  showCoverPanel,
  hasFixedChapterPhrases,
  uploadFixedChapterPhoto,
  uploadAdminCoverPrint,
  order,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(defaultCollapsed !== true)

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-xs)]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-black/[0.02] disabled:opacity-60 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
      >
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
            Кітап көрінісінің баптаулары
          </span>
          <p className="mt-0.5 max-w-[55ch] text-[12px] font-medium leading-snug text-[color:var(--text-secondary)]">
            Мәтін өлшемі · тұрақты тарау беттері{showCoverPanel ? ' · баспа мұқабасы' : ''}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-[color:var(--accent)] sm:text-right">
          {open ? 'Жасыру' : 'Көрсету'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-[color:var(--border)] divide-y divide-[color:var(--border)] bg-[color:var(--surface-subtle)]">
          <div className="px-3 py-4 sm:px-4">
            <EditorTypographyBar disabled={disabled} embedded />
          </div>
          {hasFixedChapterPhrases ? (
            <div className="px-3 py-4 sm:px-4">
              <FixedChapterBookSettingsPanel
                uploadFixedChapterPhoto={uploadFixedChapterPhoto}
                disabled={disabled}
                trialMode={trialMode}
                embedded
              />
            </div>
          ) : null}
          {showCoverPanel ? (
            <div className="bg-[color:var(--surface)] px-3 py-4 sm:px-4">
              <ClientCoverPrintPanel
                order={order}
                disabled={disabled}
                uploadAdminCoverPrint={uploadAdminCoverPrint}
                embedded
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
