import { answerTextIsEffectivelyEmpty } from '@/lib/utils/answerHtml'

export type OrderProgress = {
  answered: number
  total: number
  percent: number
}

export type AnswerProgressRow = {
  order_id: string
  question_id: string
  text_content?: string | null
  photo_path?: string | null
  is_skipped?: boolean | null
}

/** Matches editor “answered” logic: text, HTML, or photo path; skips `is_skipped`. */
export function isAnswerRowFilled(row: AnswerProgressRow): boolean {
  if (row.is_skipped) return false
  const photo = row.photo_path?.trim() ?? ''
  if (photo) return true
  const text = row.text_content?.trim() ?? ''
  if (!text) return false
  return !answerTextIsEffectivelyEmpty(text)
}

export function computeOrderProgress(answered: number, total: number): OrderProgress {
  const safeTotal = Math.max(0, total)
  const safeAnswered = Math.min(Math.max(0, answered), safeTotal)
  const percent = safeTotal > 0 ? Math.round((safeAnswered / safeTotal) * 100) : 0
  return { answered: safeAnswered, total: safeTotal, percent }
}

export function formatOrderProgressLabel(progress: OrderProgress): string {
  if (progress.total <= 0) return '—'
  return `${progress.answered} / ${progress.total} сұрақ`
}

export function formatOrderProgressPercent(progress: OrderProgress): string {
  if (progress.total <= 0) return '—'
  return `${progress.percent}%`
}
