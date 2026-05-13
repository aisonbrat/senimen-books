/**
 * Lightweight HTML <-> plain-text helpers for the AI enhance flow.
 * - `htmlToPlainTextWithParagraphs`: TipTap HTML → text with `\n\n` between paragraphs.
 *   We strip marks (B/I/U) before sending so Gemini focuses on prose, then user reapplies styles.
 * - `plainTextToParagraphHtml`: AI plain-text reply → safe `<p>…</p><p>…</p>` for `setContent`.
 */

const BLOCK_TAGS = new Set(['p', 'div', 'br', 'li'])

export function htmlToPlainTextWithParagraphs(html: string): string {
  if (!html) return ''
  // Replace block-closing tags with double newlines, <br> with single newline, then strip the rest.
  let s = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  // Normalise common HTML entities the editor can emit.
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  s = s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function plainTextToParagraphHtml(text: string): string {
  if (!text) return '<p></p>'
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    // Treat punctuation-only / dash-only lines as blank so they don't survive as ghost paragraphs.
    .map((b) => b.replace(/^\s+|\s+$/g, ''))
    .filter((b) => b.length > 0 && /[\p{L}\p{N}]/u.test(b))
  if (blocks.length === 0) return '<p></p>'
  return blocks
    .map((b) => `<p>${escapeHtml(b).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

/** Word count that copes with Cyrillic/Latin/Kazakh punctuation. */
export function countWords(s: string): number {
  if (!s) return 0
  const m = s.trim().match(/[\p{L}\p{N}]+(?:[''\-][\p{L}\p{N}]+)*/gu)
  return m ? m.length : 0
}

void BLOCK_TAGS
