/**
 * Closing imprint for exported PDF (category `pdf_colophon_template_kk`).
 * Placeholders: `{{author}}`, `{{date}}` (DD.MM.YYYY, local calendar).
 */

export function formatBookColophonDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function resolveFinishedIso(order: {
  completed_at?: string | null
  submitted_at?: string | null
  updated_at?: string | null
}): string {
  const raw = order.completed_at || order.submitted_at || order.updated_at
  if (raw && String(raw).trim()) return String(raw)
  return new Date().toISOString()
}

/**
 * Returns trimmed body text or `null` if template empty / whitespace only.
 */
export function buildPdfColophonBody(
  template: string | null | undefined,
  authorName: string,
  order: { completed_at?: string | null; submitted_at?: string | null; updated_at?: string | null }
): string | null {
  const t = (template ?? '').trim()
  if (!t) return null
  const author = (authorName ?? '').trim() || '—'
  const dateStr = formatBookColophonDate(resolveFinishedIso(order))
  return t
    .replace(/\{\{\s*author\s*\}\}/gi, author)
    .replace(/\{\{\s*date\s*\}\}/gi, dateStr)
}
