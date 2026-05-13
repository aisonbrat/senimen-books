import {
  BOOK_PAGE_H_MM,
  BOOK_CONTENT_BOTTOM_MM,
  BOOK_PAGINATION_INK_SLACK_MM,
  FAKTILER_BODY_TOP_MM,
  QUESTION_ANSWER_TOP_MM,
  QUESTION_TITLE_TOP_MM,
  SECTION_BODY_TOP_MM,
  FAKTILER_COLUMN_W_MM,
  type BookBodyLayout,
  type BookTypographyInput,
  bodyRegionMm,
} from '@/lib/bookLayout'
import { normalizeAnswerToHtml } from '@/lib/utils/answerHtml'
import { paginateAnswerHtml } from '@/lib/utils/richAnswerLayout'

export type { BookTypographyInput } from '@/lib/bookLayout'

/**
 * Vertical metrics mirror PDF export; HTML-aware pagination preserves bold/italic/underline runs.
 */
export function paginateBookBody(
  text: string,
  typography: BookTypographyInput,
  layout: BookBodyLayout,
  poemStanzaLines?: number | null
): string[] {
  const trimmed = (text || '').trim()
  if (!trimmed) return ['']

  const html = normalizeAnswerToHtml(text)
  const bottomBlock = BOOK_CONTENT_BOTTOM_MM + BOOK_PAGINATION_INK_SLACK_MM

  if (layout === 'section_body') {
    return paginateAnswerHtml(
      html,
      typography,
      (idx) =>
        idx === 0
          ? BOOK_PAGE_H_MM - SECTION_BODY_TOP_MM - bottomBlock
          : BOOK_PAGE_H_MM - QUESTION_TITLE_TOP_MM - bottomBlock,
      false,
      null
    )
  }

  if (layout === 'faktiler_body') {
    return paginateAnswerHtml(
      html,
      typography,
      (idx) =>
        idx === 0
          ? BOOK_PAGE_H_MM - FAKTILER_BODY_TOP_MM - bottomBlock
          : BOOK_PAGE_H_MM - QUESTION_TITLE_TOP_MM - bottomBlock,
      false,
      null,
      { contentWidthMm: FAKTILER_COLUMN_W_MM }
    )
  }

  const { topMm, bottomMm } = bodyRegionMm(layout)
  const rawUsable = BOOK_PAGE_H_MM - topMm - bottomMm - BOOK_PAGINATION_INK_SLACK_MM
  return paginateAnswerHtml(html, typography, () => rawUsable, false, poemStanzaLines ?? null)
}

/**
 * Question answers: first slice reserves the question band; continuation uses title-band top height budget.
 */
export function paginateQuestionAnswer(text: string, typography: BookTypographyInput): string[] {
  const trimmed = (text || '').trim()
  if (!trimmed) return ['']

  const html = normalizeAnswerToHtml(text)
  const bottomBlock = BOOK_CONTENT_BOTTOM_MM + BOOK_PAGINATION_INK_SLACK_MM
  return paginateAnswerHtml(
    html,
    typography,
    (idx) =>
      idx === 0
        ? BOOK_PAGE_H_MM - QUESTION_ANSWER_TOP_MM - bottomBlock
        : BOOK_PAGE_H_MM - QUESTION_TITLE_TOP_MM - bottomBlock,
    false,
    null
  )
}
