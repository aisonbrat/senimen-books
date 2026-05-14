/** Shared helpers for admin template JSON import (questions / chapters+questions). */

export const QUESTION_TYPES = new Set(['text', 'textarea', 'photo', 'photo_with_text'])

export function coerceHint(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

export type QuestionInsertRow = {
  chapter_id: string
  question_kk: string
  hint_kk: string | null
  question_type: string
  is_required: boolean
  sort_order: number
  max_chars?: number | null
}

/** Map one JSON question object to insert fields (without sort_order). */
export function normalizeQuestionFromJson(
  item: unknown,
  chapterId: string
): Omit<QuestionInsertRow, 'sort_order'> | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const qk = String(o.question_kk ?? o.question ?? '').trim()
  if (!qk) return null
  const qtRaw = o.question_type
  const question_type =
    typeof qtRaw === 'string' && QUESTION_TYPES.has(qtRaw) ? qtRaw : 'textarea'
  let max_chars: number | null = null
  if (o.max_chars != null) {
    const n = Number(o.max_chars)
    if (Number.isFinite(n) && n > 0) max_chars = Math.floor(n)
  }
  const row: Omit<QuestionInsertRow, 'sort_order'> = {
    chapter_id: chapterId,
    question_kk: qk,
    hint_kk: coerceHint(o.hint_kk ?? o.hint),
    question_type,
    is_required: Boolean(o.is_required),
    max_chars: max_chars ?? null,
  }
  return row
}
