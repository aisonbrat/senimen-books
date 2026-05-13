import type { PreviewPage } from '@/components/editor/BookPagePreview'
import type { CustomPage, Question } from '@/lib/types'
import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'
import { getQuestionSlotBounds } from '@/lib/utils/buildPreviewPages'

/** Preview rail / mobile preview: blur pages not included in the trial window. */
export function isPreviewPageTrialLocked(
  page: PreviewPage | null,
  trialMode: boolean,
  flatQuestions: Question[],
  customPages: CustomPage[]
): boolean {
  if (!trialMode || !page) return false

  const flatLen = flatQuestions.length

  if (page.type === 'question') {
    const idx = flatQuestions.findIndex((q) => q.id === page.data.id)
    return idx < 0 ? false : idx >= TRIAL_FREE_QUESTION_COUNT
  }

  if (page.type === 'custom') {
    const cp = page.data as CustomPage
    const so = cp.sort_order
    for (let i = 0; i < flatLen; i++) {
      const { low, high } = getQuestionSlotBounds(i, flatLen)
      if (so >= low && so < high) return i >= TRIAL_FREE_QUESTION_COUNT
    }
    return false
  }

  if (page.type === 'chapter_break') {
    return page.minFlatQuestionIndex >= TRIAL_FREE_QUESTION_COUNT
  }

  if (page.type === 'fixed_chapter') {
    return page.minFlatQuestionIndex >= TRIAL_FREE_QUESTION_COUNT
  }

  if (
    page.type === 'hat' ||
    page.type === 'faktiler_divider' ||
    page.type === 'faktiler_text' ||
    page.type === 'faktiler_photo'
  ) {
    return true
  }

  return false
}
