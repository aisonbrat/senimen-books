import jsPDF from 'jspdf'
import { cormorantItalicTtfBase64, cormorantBoldItalicTtfBase64 } from '@/lib/fonts/cormorantItalicVfs'
import { cormorantRegular, cormorantBold } from '@/public/fonts/fonts.js'

let measurePdf: jsPDF | null = null
let vfsFontsAttached = false

function registerFontsOnce(pdf: jsPDF) {
  if (vfsFontsAttached) return
  pdf.addFileToVFS('Cormorant-Regular.ttf', cormorantRegular)
  pdf.addFont('Cormorant-Regular.ttf', 'Cormorant', 'normal')
  pdf.addFileToVFS('Cormorant-Bold.ttf', cormorantBold)
  pdf.addFont('Cormorant-Bold.ttf', 'Cormorant', 'bold')
  pdf.addFileToVFS('Cormorant-Italic.ttf', cormorantItalicTtfBase64)
  pdf.addFont('Cormorant-Italic.ttf', 'Cormorant', 'italic')
  pdf.addFileToVFS('Cormorant-BoldItalic.ttf', cormorantBoldItalicTtfBase64)
  pdf.addFont('Cormorant-BoldItalic.ttf', 'Cormorant', 'bolditalic')
  vfsFontsAttached = true
}

/** Shared jsPDF instance for splitTextToSize — matches export typography. */
export function getMeasurePdf(): jsPDF {
  if (!measurePdf) {
    measurePdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [148, 210], compress: true })
    registerFontsOnce(measurePdf)
  }
  return measurePdf
}

/**
 * Word-wrap using measured glyph widths. jsPDF's `splitTextToSize` has been observed to emit long runs of
 * identical lines for repetitive text with embedded fonts, which breaks pagination (duplicate pages).
 */
export function splitParagraphToLinesMm(
  paragraph: string,
  maxWidthMm: number,
  fontSizeMm: number,
  fontWeight: 'normal' | 'bold' = 'normal'
): string[] {
  const pdf = getMeasurePdf()
  pdf.setFont('Cormorant', fontWeight === 'bold' ? 'bold' : 'normal')
  pdf.setFontSize(fontSizeMm * 2.8346)
  const clean = paragraph.replace(/\n/g, ' ').trim()
  if (!clean) return []

  const tol = 1e-3
  const words = clean.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''

  function flushLine() {
    if (currentLine) {
      lines.push(currentLine)
      currentLine = ''
    }
  }

  /** Break a token that is wider than `maxWidthMm` (fallback keeps legacy behaviour for that token only). */
  function appendOversizedToken(word: string) {
    flushLine()
    const w = pdf.getTextWidth(word)
    if (w <= maxWidthMm + tol) {
      currentLine = word
      return
    }
    const parts = pdf.splitTextToSize(word, maxWidthMm)
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (i < parts.length - 1) lines.push(p)
      else currentLine = p
    }
  }

  for (const word of words) {
    const trial = currentLine ? `${currentLine} ${word}` : word
    if (pdf.getTextWidth(trial) <= maxWidthMm + tol) {
      currentLine = trial
      continue
    }
    flushLine()
    appendOversizedToken(word)
  }
  flushLine()
  return lines
}
