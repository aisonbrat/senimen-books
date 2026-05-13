import { parseHTML } from 'linkedom'
import { answerDisplaysAsPhotoContent } from '@/lib/utils/bookPhotoUrl'

/**
 * linkedom `parseHTML('<div>…</div>')` sets that wrapper as `document.documentElement`; `document.body`
 * stays empty. Read/write fragment content via this helper so callers match browser DOMParser behaviour.
 */
function linkedomWrapperDiv(document: Document): Element | null {
  const docEl = document.documentElement as Element | null
  if (docEl?.tagName.toLowerCase() === 'div') return docEl
  const first = document.body?.firstElementChild
  return first ?? document.body ?? null
}

/** Photo answers: HTTPS / Supabase `/storage/…` / bare bucket paths, optionally `|`‑separated. */
export function isPhotoAnswerValue(answer: string): boolean {
  return answerDisplaysAsPhotoContent(answer)
}

export function looksLikeAnswerHtml(s: string): boolean {
  if (!s || typeof s !== 'string') return false
  return /<[a-z][\s\S]*>/i.test(s.trim())
}

/** TipTap / wrappers often add a single outer div; unwrap so block parsing sees real `<p>` roots. */
export function unwrapAnswerHtmlWrappers(html: string): string {
  let s = html.trim()
  for (let i = 0; i < 4; i++) {
    const m = s.match(/^<div\b[^>]*\bclass\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*)<\/div>\s*$/i)
    if (!m) break
    const cls = m[1]
    if (!/\b(ProseMirror|tiptap)\b/i.test(cls)) break
    s = m[2].trim()
  }
  return s
}

export function escapeHtmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Legacy plain answers → single paragraph HTML */
export function normalizeAnswerToHtml(answer: string): string {
  const s = answer ?? ''
  if (!s.trim()) return ''
  if (looksLikeAnswerHtml(s)) return unwrapAnswerHtmlWrappers(s)
  const lines = s.split(/\r?\n/)
  return lines.map((ln) => `<p>${escapeHtmlText(ln) || '<br />'}</p>`).join('')
}

/** Removes scripts/iframes before injecting preview HTML */
export function sanitizeAnswerHtmlFragment(html: string): string {
  const trimmed = html?.trim() ?? ''
  if (!trimmed) return ''
  try {
    const { document } = parseHTML(`<div>${trimmed}</div>`)
    document.querySelectorAll('script,style,iframe').forEach((el) => el.remove())
    const root = linkedomWrapperDiv(document)
    return root?.innerHTML ?? ''
  } catch {
    return escapeHtmlText(trimmed)
  }
}

/** TipTap often adds inline `text-align:left` on `<p>`; that blocks justified preview/PDF parity. */
export function stripInlineTextAlignFromHtml(html: string): string {
  const trimmed = html?.trim() ?? ''
  if (!trimmed) return ''
  try {
    const { document } = parseHTML(`<div>${trimmed}</div>`)
    const root = linkedomWrapperDiv(document)
    root?.querySelectorAll('[style]').forEach((el) => {
      const s = el.getAttribute('style') || ''
      let next = s.replace(/\btext-align\s*:\s*[^;]+;?/gi, '').replace(/;\s*;/g, ';').trim()
      next = next.replace(/^;+|;+$/g, '').trim()
      if (next) el.setAttribute('style', next)
      else el.removeAttribute('style')
    })
    root?.querySelectorAll('[class]').forEach((el) => {
      const cls = el.getAttribute('class') || ''
      const cleaned = cls
        .replace(/\b(text-left|text-right|text-center|text-justify|ql-align-\S+)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleaned) el.setAttribute('class', cleaned)
      else el.removeAttribute('class')
    })
    root?.querySelectorAll('[data-text-align]').forEach((el) => el.removeAttribute('data-text-align'))
    return root?.innerHTML ?? trimmed
  } catch {
    return trimmed
  }
}

export function answerTextIsEffectivelyEmpty(answer: string): boolean {
  const s = answer?.trim() ?? ''
  if (!s) return true
  if (isPhotoAnswerValue(s)) return false
  if (!looksLikeAnswerHtml(s)) return !s.trim()
  try {
    const { document } = parseHTML(`<div>${s}</div>`)
    const root = linkedomWrapperDiv(document)
    const t = root?.textContent?.replace(/\u00a0/g, ' ').trim() ?? ''
    return !t
  } catch {
    return !s.replace(/<[^>]+>/g, '').trim()
  }
}

/** Plain snippet for mobile collapsed answer preview (no HTML). */
export function answerPlainTextPreview(raw: string, maxLen = 280): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (isPhotoAnswerValue(s)) return 'Фото қосылған'
  let t = s
  if (looksLikeAnswerHtml(s)) {
    try {
      const { document } = parseHTML(`<div>${s}</div>`)
      const root = linkedomWrapperDiv(document)
      t = root?.textContent?.replace(/\u00a0/g, ' ') ?? ''
    } catch {
      t = s.replace(/<[^>]+>/g, ' ')
    }
  }
  t = t.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen).trimEnd()}…`
}
