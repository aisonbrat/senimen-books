import type { FaktilerFactSlot } from '@/lib/types'
import { answerTextIsEffectivelyEmpty } from '@/lib/utils/answerHtml'

export function newFaktilerFactId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** True if this spread should appear in preview/PDF (any text or image). */
export function faktilerSlotHasContent(slot: { text: string; photo_path?: string | null }): boolean {
  return (
    !answerTextIsEffectivelyEmpty(slot.text ?? '') || !!(slot.photo_path && String(slot.photo_path).trim())
  )
}

export function faktilerFactsHaveAnyContent(facts: FaktilerFactSlot[]): boolean {
  return facts.some(faktilerSlotHasContent)
}

/**
 * Parse DB payload (jsonb or legacy columns). Does not add an empty editor row.
 */
export function parseFaktilerFactsPayload(
  raw: unknown,
  legacyText: string,
  legacyPhoto: string
): FaktilerFactSlot[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (raw != null && typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      if (Array.isArray(p)) arr = p
    } catch {
      /* ignore */
    }
  }
  const out: FaktilerFactSlot[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id : newFaktilerFactId()
    const rawText = o.text ?? o.text_html
    const text = typeof rawText === 'string' ? rawText : rawText != null ? String(rawText) : ''
    const rawPhoto = o.photo_path ?? o.image
    const photo_path =
      typeof rawPhoto === 'string' ? rawPhoto : rawPhoto != null ? String(rawPhoto) : ''
    out.push({ id, text, photo_path })
  }
  if (out.length === 0 && (legacyText.trim() || legacyPhoto.trim())) {
    out.push({ id: newFaktilerFactId(), text: legacyText || '', photo_path: legacyPhoto || '' })
  }
  return out
}

/** After fetch: ensure at least one editable row when the template includes Фактілер. */
/** Coerce store/API rows so React never receives non-string fields (e.g. legacy `{ text, image }`). */
export function sanitizeFaktilerFactSlots(slots: FaktilerFactSlot[]): FaktilerFactSlot[] {
  return slots.map((s) => ({
    id: typeof s.id === 'string' && s.id.trim() ? s.id : newFaktilerFactId(),
    text: typeof s.text === 'string' ? s.text : '',
    photo_path: typeof s.photo_path === 'string' ? s.photo_path : '',
  }))
}

export function ensureFaktilerEditorSlots(
  facts: FaktilerFactSlot[],
  hasFaktilerChapter: boolean
): FaktilerFactSlot[] {
  const normalized = sanitizeFaktilerFactSlots(facts)
  if (hasFaktilerChapter && normalized.length === 0) {
    return [{ id: newFaktilerFactId(), text: '', photo_path: '' }]
  }
  return normalized
}

export function faktilerFactsForDb(facts: FaktilerFactSlot[]): FaktilerFactSlot[] {
  return facts.map((s) => ({ id: s.id, text: s.text, photo_path: s.photo_path }))
}
