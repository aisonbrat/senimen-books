'use client'

import { useMemo } from 'react'
import { useEditorStore } from '@/lib/store/editorStore'
import { usePreviewPages } from '@/lib/hooks/usePreviewPages'
import { BookPagePreview } from './BookPagePreview'
import { TrialPreviewBlurWrap } from '@/components/editor/TrialPreviewBlurWrap'
import { Button } from '@/components/ui/Button'
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons'

const SCALE = 1.6
const mm = (v: number) => Math.round(v * SCALE)

export function SpreadPreview() {
  const order = useEditorStore((s) => s.order)
  const chapters = useEditorStore((s) => s.chapters)
  const customPages = useEditorStore((s) => s.customPages)
  const spreadIndex = useEditorStore((s) => s.spreadIndex)
  const setSpreadIndex = useEditorStore((s) => s.setSpreadIndex)
  const previewPages = usePreviewPages()
  const flatQuestions = useMemo(
    () => chapters.filter((c) => c.part_kind !== 'faktiler').flatMap((c) => c.questions ?? []),
    [chapters]
  )
  const trialMode = (order as { trial_mode?: boolean } | null)?.trial_mode === true
  const totalSpreads = Math.max(1, Math.ceil(previewPages.length / 2))
  const leftPage = previewPages[spreadIndex * 2] ?? null
  const rightPage = previewPages[spreadIndex * 2 + 1] ?? null
  const leftPageNum = spreadIndex * 2 + 1
  const rightPageNum = leftPageNum + 1

  const spreadInnerW = mm(148) * 2 + 1
  const railPadX = 12
  const railW = spreadInnerW + railPadX * 2

  const bookTitle = String((order as Record<string, unknown> | null)?.book_title ?? '')

  return (
    <aside
      className="hidden shrink-0 flex-col items-stretch border-l border-[color:var(--border)] bg-[color:var(--surface-subtle)] lg:flex"
      style={{ width: railW, minWidth: railW }}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-3 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Алдын ала қарау
        </p>

        <div className="flex shadow-[var(--shadow-md)] ring-1 ring-[color:var(--border)]">
          <div className="overflow-hidden rounded-l-[2px] bg-white shadow-[inset_-3px_0_8px_rgba(15,23,42,0.06)]">
            <TrialPreviewBlurWrap
              page={leftPage}
              trialMode={trialMode}
              flatQuestions={flatQuestions}
              customPages={customPages}
            >
              <BookPagePreview page={leftPage} pageNum={leftPageNum} bookTitle={bookTitle} isLeft={true} />
            </TrialPreviewBlurWrap>
          </div>
          <div className="w-px shrink-0 bg-[color:var(--border)]" aria-hidden />
          <div className="overflow-hidden rounded-r-[2px] bg-white shadow-[inset_3px_0_8px_rgba(15,23,42,0.06)]">
            <TrialPreviewBlurWrap
              page={rightPage}
              trialMode={trialMode}
              flatQuestions={flatQuestions}
              customPages={customPages}
            >
              <BookPagePreview page={rightPage} pageNum={rightPageNum} bookTitle={bookTitle} isLeft={false} />
            </TrialPreviewBlurWrap>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pb-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-10 min-w-10 px-0"
            disabled={spreadIndex === 0}
            onClick={() => setSpreadIndex(Math.max(0, spreadIndex - 1))}
            aria-label="Алдыңғы беттер"
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[100px] text-center">
            <div className="text-[12px] font-semibold tabular-nums text-[color:var(--text-primary)]">
              {leftPageNum} – {rightPageNum}
            </div>
            <div className="mt-0.5 text-[10px] font-medium text-[color:var(--text-muted)]">
              / {previewPages.length} бет
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-10 min-w-10 px-0"
            disabled={spreadIndex >= totalSpreads - 1}
            onClick={() => setSpreadIndex(Math.min(totalSpreads - 1, spreadIndex + 1))}
            aria-label="Келесі беттер"
          >
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
