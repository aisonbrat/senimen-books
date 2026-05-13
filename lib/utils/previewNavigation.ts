import type { PreviewPage } from '@/components/editor/BookPagePreview'

export type PreviewJumpTarget =
  | { kind: 'algy' }
  | { kind: 'faktiler' }
  | { kind: 'hat' }
  | { kind: 'question'; questionId: string }
  | { kind: 'custom'; customPageId: string }

/** Index into flat `previewPages` (0-based). Returns -1 if not found. */
export function pageIndexForPreviewTarget(pages: PreviewPage[], target: PreviewJumpTarget): number {
  if (target.kind === 'algy') return pages.findIndex((p) => p.type === 'algy_soz')
  if (target.kind === 'faktiler')
    return pages.findIndex((p) => p.type === 'faktiler_divider' || p.type === 'faktiler_text')
  if (target.kind === 'hat') return pages.findIndex((p) => p.type === 'hat')
  if (target.kind === 'custom')
    return pages.findIndex((p) => p.type === 'custom' && p.data.id === target.customPageId)
  return pages.findIndex((p) => p.type === 'question' && p.data.id === target.questionId)
}

/** Spread index for desktop/mobile preview chrome (two pages per spread). */
export function spreadIndexForPreviewTarget(pages: PreviewPage[], target: PreviewJumpTarget): number {
  const idx = pageIndexForPreviewTarget(pages, target)
  if (idx < 0) return 0
  return Math.floor(idx / 2)
}
