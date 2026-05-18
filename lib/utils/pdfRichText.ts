import { parseHTML } from 'linkedom'
import type jsPDF from 'jspdf'
import { BODY_LINE_HEIGHT_RATIO } from '@/lib/bookLayout'
import {
  BOOK_FLOW_LINE_ATTR,
  applyPdfPieceFont,
  linePiecesFromFlowDiv,
  type WordPiece,
} from '@/lib/utils/richAnswerLayout'

export type PdfRichTextAlign = 'justify' | 'left' | 'center'

function normSpaceW(pdf: jsPDF, fontMm: number, baseBold: boolean): number {
  pdf.setFont('Cormorant', baseBold ? 'bold' : 'normal')
  pdf.setFontSize(fontMm * 2.8346)
  return pdf.getTextWidth(' ')
}

function naturalLineWidth(pdf: jsPDF, pieces: WordPiece[], fontMm: number, baseBold: boolean): number {
  if (pieces.length === 0) return 0
  const sp = normSpaceW(pdf, fontMm, baseBold)
  let sum = 0
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]
    applyPdfPieceFont(pdf, fontMm, p, baseBold)
    sum += pdf.getTextWidth(p.t)
    if (i < pieces.length - 1) sum += sp
  }
  return sum
}

function drawUnderlineSegment(pdf: jsPDF, x0: number, x1: number, baselineY: number, fontMm: number): void {
  const uy = baselineY + Math.max(0.35, fontMm * 0.12)
  pdf.setDrawColor(26, 26, 26)
  pdf.setLineWidth(0.12)
  pdf.line(x0, uy, x1, uy)
}

type Op =
  | { kind: 'line'; el: Element }
  | { kind: 'paraGap' }
  | { kind: 'stanza' }
  | { kind: 'blank' }

/**
 * Draw pagination chunk HTML (`data-book-line`, `.book-para-gap`, `.book-blank-para`) from rich pagination.
 * Returns next Y (mm) below the painted block.
 */
export function drawSerializedRichHtml(
  pdf: jsPDF,
  html: string,
  x: number,
  yStart: number,
  maxW: number,
  fontMm: number,
  align: PdfRichTextAlign,
  baseBold: boolean
): number {
  const trimmed = html?.trim()
  if (!trimmed) return yStart

  const lineHmm = fontMm * BODY_LINE_HEIGHT_RATIO
  const paraGapMm = fontMm * 0.38
  const stanzaGapMm = fontMm * 1.12
  let y = yStart

  const { document } = parseHTML(`<div id="root">${trimmed}</div>`)
  const root = document.getElementById('root')
  if (!root) return yStart

  const ops: Op[] = []
  for (const node of root.children) {
    const el = node as Element
    if (el.getAttribute(BOOK_FLOW_LINE_ATTR) === '1') ops.push({ kind: 'line', el })
    else if (el.classList?.contains('book-para-gap')) ops.push({ kind: 'paraGap' })
    else if (el.classList?.contains('book-stanza-gap')) ops.push({ kind: 'stanza' })
    else if (el.classList?.contains('book-blank-para')) ops.push({ kind: 'blank' })
  }

  const lineOps = ops.filter((o): o is Extract<Op, { kind: 'line' }> => o.kind === 'line')
  const linePieceLists = lineOps.map((lo) => linePiecesFromFlowDiv(lo.el))

  /** Marks the last non-empty line of each paragraph closed by `paraGap`; open paragraphs at chunk end get none. */
  const isParagraphClosingLine = new Array(lineOps.length).fill(false)

  let paraAccum: number[] = []
  const flushParagraph = (closed: boolean) => {
    const nonemptyIdxs: number[] = []
    for (const li of paraAccum) {
      if (linePieceLists[li].length) nonemptyIdxs.push(li)
    }
    const n = nonemptyIdxs.length
    for (const li of paraAccum) {
      if (closed && n > 0 && li === nonemptyIdxs[n - 1]) isParagraphClosingLine[li] = true
    }
    paraAccum = []
  }

  let lineAccumulator = 0
  for (const op of ops) {
    if (op.kind === 'line') {
      paraAccum.push(lineAccumulator++)
    } else if (op.kind === 'paraGap') {
      flushParagraph(true)
    }
  }
  flushParagraph(false)

  let lineOpIdx = 0
  pdf.setTextColor(26, 26, 26)

  for (const op of ops) {
    if (op.kind === 'blank') {
      y += lineHmm * 0.35
      continue
    }
    if (op.kind === 'paraGap') {
      y += paraGapMm
      continue
    }
    if (op.kind === 'stanza') {
      y += stanzaGapMm
      continue
    }

    const pieces = linePiecesFromFlowDiv(op.el)
    if (pieces.length === 0) {
      y += lineHmm * 0.35
      lineOpIdx++
      continue
    }

    const lineY = y + fontMm * 0.75
    const elClass = (op.el as Element).getAttribute('class') ?? ''
    const tailFromHtml = elClass.includes('book-flow-line--para-tail')
    const paraClosing = isParagraphClosingLine[lineOpIdx] || tailFromHtml
    /** Middle lines justify; only the paragraph’s last line stays flush-left (`text-align-last: left`). */
    const mayJustify = align === 'justify' && !paraClosing && pieces.length > 1

    const drawPiecesLeft = (startX: number) => {
      let cx = startX
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i]
        applyPdfPieceFont(pdf, fontMm, p, baseBold)
        pdf.text(p.t, cx, lineY)
        const tw = pdf.getTextWidth(p.t)
        if (p.underline) drawUnderlineSegment(pdf, cx, cx + tw, lineY, fontMm)
        cx += tw
        if (i < pieces.length - 1) cx += normSpaceW(pdf, fontMm, baseBold)
      }
    }

    if (!mayJustify) {
      if (align === 'center') {
        const natural = naturalLineWidth(pdf, pieces, fontMm, baseBold)
        const startX = x + Math.max(0, (maxW - natural) / 2)
        drawPiecesLeft(startX)
      } else {
        drawPiecesLeft(x)
      }
    } else {
      const natural = naturalLineWidth(pdf, pieces, fontMm, baseBold)
      const extra = Math.max(0, maxW - natural)
      const gaps = pieces.length - 1
      const addPerGap = gaps > 0 ? extra / gaps : 0
      let cx = x
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i]
        applyPdfPieceFont(pdf, fontMm, p, baseBold)
        pdf.text(p.t, cx, lineY)
        const tw = pdf.getTextWidth(p.t)
        if (p.underline) drawUnderlineSegment(pdf, cx, cx + tw, lineY, fontMm)
        cx += tw
        if (i < pieces.length - 1) cx += normSpaceW(pdf, fontMm, baseBold) + addPerGap
      }
    }

    y += lineHmm
    lineOpIdx++
  }

  return y
}
