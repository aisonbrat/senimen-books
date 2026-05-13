import { parseHTML } from 'linkedom'
import type jsPDF from 'jspdf'
import {
  BOOK_MARGIN_MM,
  BOOK_PAGE_W_MM,
  BODY_LINE_HEIGHT_RATIO,
  answerPresetToBodyMm,
  type BookTypographyInput,
} from '@/lib/bookLayout'
import { getMeasurePdf } from '@/lib/utils/jspdfMeasure'
import { escapeHtmlText } from '@/lib/utils/answerHtml'

export interface WordPiece {
  t: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export type FlowItem =
  | { kind: 'line'; pieces: WordPiece[] }
  | { kind: 'paraEnd' }
  | { kind: 'blankPara' }
  | { kind: 'stanzaGap' }

interface Marks {
  bold: boolean
  italic: boolean
  underline: boolean
}

export const BOOK_FLOW_LINE_ATTR = 'data-book-line'

function applyTagMarks(tag: string, m: Marks): Marks {
  const t = tag.toLowerCase()
  if (t === 'strong' || t === 'b') return { ...m, bold: true }
  if (t === 'em' || t === 'i') return { ...m, italic: true }
  if (t === 'u') return { ...m, underline: true }
  return m
}

function splitRowToWords(text: string, marks: Marks): WordPiece[] {
  const parts = text.split(/\s+/).filter(Boolean)
  return parts.map((t) => ({ t, ...marks }))
}

function walkInlineNode(node: Node, marks: Marks, row: WordPiece[]): void {
  if (node.nodeType === 3) {
    const tx = (node.textContent ?? '').trim()
    if (tx) row.push(...splitRowToWords(tx.replace(/\s+/g, ' '), marks))
    return
  }
  if (node.nodeType !== 1) return
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const next = applyTagMarks(tag, marks)
  el.childNodes.forEach((c) => walkInlineNode(c, next, row))
}

/** One `<p>` → rows separated by `<br>` */
function paragraphToRows(p: Element): WordPiece[][] {
  const rows: WordPiece[][] = []
  let row: WordPiece[] = []

  const flush = () => {
    if (row.length) rows.push(row)
    row = []
  }

  for (const child of p.childNodes) {
    if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'br') {
      flush()
      continue
    }
    walkInlineNode(child, { bold: false, italic: false, underline: false }, row)
  }
  flush()

  return rows.filter((r) => r.length > 0)
}

export function applyPdfPieceFont(pdf: jsPDF, fontMm: number, piece: WordPiece, baseBold: boolean): void {
  const wantBold = baseBold || piece.bold
  pdf.setFontSize(fontMm * 2.8346)
  if (piece.italic) {
    pdf.setFont('Cormorant', wantBold ? 'bolditalic' : 'italic')
  } else {
    pdf.setFont('Cormorant', wantBold ? 'bold' : 'normal')
  }
}

function pieceWidth(pdf: jsPDF, fontMm: number, piece: WordPiece, baseBold: boolean): number {
  applyPdfPieceFont(pdf, fontMm, piece, baseBold)
  return pdf.getTextWidth(piece.t)
}

function spaceWidth(pdf: jsPDF, fontMm: number, baseBold: boolean): number {
  pdf.setFont('Cormorant', baseBold ? 'bold' : 'normal')
  pdf.setFontSize(fontMm * 2.8346)
  return pdf.getTextWidth(' ')
}

function explodeOversizedPiece(pdf: jsPDF, piece: WordPiece, fontMm: number, baseBold: boolean, maxW: number): WordPiece[] {
  applyPdfPieceFont(pdf, fontMm, piece, baseBold)
  const parts = pdf.splitTextToSize(piece.t, maxW)
  if (parts.length <= 1) return [piece]
  return parts.map((p: string) => ({ ...piece, t: p }))
}

function wrapRowToLines(row: WordPiece[], maxW: number, fontMm: number, pdf: jsPDF, baseBold: boolean): WordPiece[][] {
  const exploded: WordPiece[] = []
  for (const pc of row) {
    const w = pieceWidth(pdf, fontMm, pc, baseBold)
    if (w <= maxW + 1e-3) exploded.push(pc)
    else exploded.push(...explodeOversizedPiece(pdf, pc, fontMm, baseBold, maxW))
  }

  const lines: WordPiece[][] = []
  let cur: WordPiece[] = []
  let curW = 0
  const sp = spaceWidth(pdf, fontMm, baseBold)

  for (const pc of exploded) {
    const w = pieceWidth(pdf, fontMm, pc, baseBold)
    const needSpace = cur.length > 0 ? sp : 0
    if (cur.length === 0 || curW + needSpace + w <= maxW + 1e-3) {
      cur.push(pc)
      curW += needSpace + w
      continue
    }
    lines.push(cur)
    cur = [pc]
    curW = w
  }
  if (cur.length) lines.push(cur)
  return lines.length ? lines : [[]]
}

/** Depth-first `<p>` blocks under a container (TipTap often nests `<p>` inside one wrapper div). */
function collectParagraphElements(container: Element): Element[] {
  const list: Element[] = []
  const walk = (node: Element) => {
    const tag = node.tagName.toLowerCase()
    if (tag === 'p') {
      list.push(node)
      return
    }
    for (const c of [...node.children]) walk(c as Element)
  }
  walk(container)
  return list
}

export function parseAnswerHtmlToFlow(html: string, maxWMm: number, fontMm: number, pdf: jsPDF, baseBold: boolean): FlowItem[] {
  const trimmed = html?.trim()
  if (!trimmed) return []

  const { document } = parseHTML(`<div id="root">${trimmed}</div>`)
  const root = document.getElementById('root')
  if (!root) return []

  const out: FlowItem[] = []

  const consumeBlock = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (tag !== 'p') return

    const rows = paragraphToRows(el)
    if (rows.length === 0) {
      out.push({ kind: 'blankPara' })
      return
    }
    for (const row of rows) {
      const lines = wrapRowToLines(row, maxWMm, fontMm, pdf, baseBold)
      for (const pieces of lines) {
        if (pieces.length) out.push({ kind: 'line', pieces })
      }
    }
    out.push({ kind: 'paraEnd' })
  }

  if (root.children.length === 0) {
    const t = root.textContent?.trim()
    if (t) {
      const p = document.createElement('p')
      p.textContent = t
      consumeBlock(p)
    }
  } else {
    const blocks: Element[] = []
    for (const child of [...root.children]) {
      const el = child as Element
      if (el.tagName.toLowerCase() === 'p') blocks.push(el)
      else blocks.push(...collectParagraphElements(el))
    }

    const seen = new Set<Element>()
    for (const el of blocks) {
      if (seen.has(el)) continue
      seen.add(el)
      consumeBlock(el)
    }

    if (out.length === 0) {
      for (const child of [...root.children]) {
        const el = child as Element
        if (el.tagName.toLowerCase() === 'p') continue
        const p = document.createElement('p')
        while (el.firstChild) p.appendChild(el.firstChild)
        if ((p.textContent ?? '').trim()) consumeBlock(p)
      }
    }
  }

  while (out.length && out[out.length - 1].kind === 'paraEnd') out.pop()
  return out
}

/** Insert extra gaps after every N paragraph ends (verse stanza breaks). */
export function injectPoemStanzaGaps(flow: FlowItem[], linesPerStanza: number): FlowItem[] {
  if (linesPerStanza < 4 || linesPerStanza > 8 || flow.length === 0) return flow
  const out: FlowItem[] = []
  let paraCount = 0
  for (const item of flow) {
    out.push(item)
    if (item.kind === 'paraEnd') {
      paraCount++
      if (paraCount % linesPerStanza === 0) out.push({ kind: 'stanzaGap' })
    }
  }
  while (out.length && out[out.length - 1].kind === 'stanzaGap') out.pop()
  return out
}

export function paginateFlowItems(
  flow: FlowItem[],
  lineHmm: number,
  paraGapMm: number,
  stanzaGapMm: number,
  blankAdvanceHmm: number,
  usableHmmForPage: (pageIdx: number) => number
): FlowItem[][] {
  if (flow.length === 0) return []

  let pageIdx = 0
  let usedHmm = 0
  const pages: FlowItem[][] = []
  let cur: FlowItem[] = []

  function usable(): number {
    return Math.max(lineHmm + 0.02, usableHmmForPage(pageIdx))
  }

  function flushPage() {
    pages.push(cur)
    cur = []
    usedHmm = 0
    pageIdx++
  }

  function ensure(mm: number) {
    if (usedHmm + mm <= usable() + 1e-6) return
    flushPage()
  }

  for (const item of flow) {
    if (item.kind === 'line') {
      ensure(lineHmm)
      usedHmm += lineHmm
      cur.push(item)
    } else if (item.kind === 'paraEnd') {
      ensure(paraGapMm)
      usedHmm += paraGapMm
      cur.push(item)
    } else if (item.kind === 'stanzaGap') {
      if (stanzaGapMm > 0) {
        ensure(stanzaGapMm)
        usedHmm += stanzaGapMm
        cur.push(item)
      }
    } else if (item.kind === 'blankPara') {
      ensure(blankAdvanceHmm)
      usedHmm += blankAdvanceHmm
      cur.push(item)
      ensure(paraGapMm)
      usedHmm += paraGapMm
    }
  }

  if (cur.length) pages.push(cur)
  return pages.length ? pages : [[]]
}

function mergePiecesForHtml(pieces: WordPiece[]): { text: string; bold: boolean; italic: boolean; underline: boolean }[] {
  const runs: { text: string; bold: boolean; italic: boolean; underline: boolean }[] = []
  for (const p of pieces) {
    const last = runs[runs.length - 1]
    if (
      last &&
      last.bold === !!p.bold &&
      last.italic === !!p.italic &&
      last.underline === !!p.underline
    ) {
      last.text += ' ' + p.t
    } else {
      runs.push({ text: p.t, bold: !!p.bold, italic: !!p.italic, underline: !!p.underline })
    }
  }
  return runs
}

export function serializeRichChunk(items: FlowItem[]): string {
  const parts: string[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind === 'line') {
      const runs = mergePiecesForHtml(it.pieces)
      const inner = runs
        .map((r) => {
          let chunk = escapeHtmlText(r.text)
          if (r.underline) chunk = `<u>${chunk}</u>`
          if (r.italic) chunk = `<em>${chunk}</em>`
          if (r.bold) chunk = `<strong>${chunk}</strong>`
          return chunk
        })
        .join(' ')
      const next = items[i + 1]
      const isParaTail = next?.kind === 'paraEnd' || next?.kind === 'stanzaGap'
      const cls = isParaTail ? 'book-flow-line book-flow-line--para-tail' : 'book-flow-line'
      // Mode-specific alignment is owned by `[data-book-align]` rules in globals.css.
      // Do NOT stamp inline `text-align-last` here — it would force one-line divs to stretch in left mode.
      parts.push(`<div class="${cls}" ${BOOK_FLOW_LINE_ATTR}="1">${inner}</div>`)
    } else if (it.kind === 'paraEnd') {
      parts.push('<div class="book-para-gap"></div>')
    } else if (it.kind === 'blankPara') {
      parts.push('<div class="book-blank-para"></div>')
    } else if (it.kind === 'stanzaGap') {
      parts.push('<div class="book-stanza-gap"></div>')
    }
  }
  return parts.join('')
}

function walkMarksIntoPieces(el: Element, m: Marks, acc: WordPiece[]): void {
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      const tx = (child.textContent ?? '').trim()
      if (tx) acc.push(...splitRowToWords(tx.replace(/\s+/g, ' '), m))
      continue
    }
    if (child.nodeType !== 1) continue
    const node = child as Element
    walkMarksIntoPieces(node, applyTagMarks(node.tagName.toLowerCase(), m), acc)
  }
}

export function linePiecesFromFlowDiv(el: Element): WordPiece[] {
  const acc: WordPiece[] = []
  walkMarksIntoPieces(el, { bold: false, italic: false, underline: false }, acc)
  return acc
}

export function parseSerializedChunkLines(html: string): WordPiece[][] {
  const trimmed = html?.trim()
  if (!trimmed) return []

  const { document } = parseHTML(`<div id="root">${trimmed}</div>`)
  const root = document.getElementById('root')
  if (!root) return []

  const lines: WordPiece[][] = []

  for (const node of root.children) {
    const el = node as Element
    if (el.getAttribute(BOOK_FLOW_LINE_ATTR) === '1') {
      const acc = linePiecesFromFlowDiv(el)
      if (acc.length) lines.push(acc)
    }
  }

  return lines
}

export function paginateAnswerHtml(
  html: string,
  typo: BookTypographyInput,
  usableHmmForPage: (pageIdx: number) => number,
  baseBold: boolean,
  poemStanzaLines?: number | null,
  opts?: { contentWidthMm?: number }
): string[] {
  const fontMm = answerPresetToBodyMm(typo.fontPreset)
  const lineHmm = fontMm * BODY_LINE_HEIGHT_RATIO
  const paraGapMm = fontMm * 0.38
  const stanzaGapMm =
    poemStanzaLines != null && poemStanzaLines >= 4 && poemStanzaLines <= 8 ? fontMm * 1.12 : 0
  const blankAdvanceHmm = lineHmm * 0.35
  const maxW = opts?.contentWidthMm ?? BOOK_PAGE_W_MM - BOOK_MARGIN_MM * 2
  const pdf = getMeasurePdf()

  let flow = parseAnswerHtmlToFlow(html, maxW, fontMm, pdf, baseBold)
  if (flow.length === 0) return ['']

  if (poemStanzaLines != null && poemStanzaLines >= 4 && poemStanzaLines <= 8) {
    flow = injectPoemStanzaGaps(flow, poemStanzaLines)
  }

  const pages = paginateFlowItems(flow, lineHmm, paraGapMm, stanzaGapMm, blankAdvanceHmm, usableHmmForPage)
  const out = pages.map((p) => serializeRichChunk(p))
  return out.some((s) => s.length) ? out : ['']
}
