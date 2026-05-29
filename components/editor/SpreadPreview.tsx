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
  // Spread 0 = cover alone (page 1). Spread s≥1 = pair [pages[2s-1], pages[2s]].
  const totalSpreads = Math.max(1, 1 + Math.ceil(Math.max(0, previewPages.length - 1) / 2))
  const isCoverSpread = spreadIndex === 0
  const coverPage = isCoverSpread ? (previewPages[0] ?? null) : null
  const leftPage = isCoverSpread ? null : (previewPages[spreadIndex * 2 - 1] ?? null)
  const rightPage = isCoverSpread ? null : (previewPages[spreadIndex * 2] ?? null)
  // Even page number → left (outer corner bottom-left); odd → right (bottom-right)
  const leftPageNum = isCoverSpread ? 0 : spreadIndex * 2
  const rightPageNum = isCoverSpread ? 0 : spreadIndex * 2 + 1

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

        {isCoverSpread ? (
          // Cover stands alone, centered
          <div className="overflow-hidden rounded-[2px] shadow-[var(--shadow-md)] ring-1 ring-[color:var(--border)]">
            <TrialPreviewBlurWrap
              page={coverPage}
              trialMode={trialMode}
              flatQuestions={flatQuestions}
              customPages={customPages}
            >
              <BookPagePreview page={coverPage} pageNum={1} bookTitle={bookTitle} isLeft={false} />
            </TrialPreviewBlurWrap>
          </div>
        ) : (
          // Paired spread: left (even page) + right (odd page)
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
        )}

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
              {isCoverSpread ? '1' : `${leftPageNum} – ${rightPageNum}`}
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
