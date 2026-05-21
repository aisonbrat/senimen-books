import jsPDF from 'jspdf'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PreviewPage } from '@/components/editor/BookPagePreview'
import { buildPreviewPages, normalizeBookTypographyFromOrder, type BookTypography } from '@/lib/utils/buildPreviewPages'
import type { Chapter, CustomPage } from '@/lib/types'
import { cormorantItalicTtfBase64, cormorantBoldItalicTtfBase64 } from '@/lib/fonts/cormorantItalicVfs'
import { cormorantRegular, cormorantBold } from '@/public/fonts/fonts.js'
import {
  BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM,
  BOOK_BRAND_FOOTER_FONT_MM,
  BOOK_FOOTER_LABEL_FROM_BOTTOM_MM,
  BOOK_FOOTER_RULE_FROM_BOTTOM_MM,
  BOOK_MARGIN_MM,
  BOOK_PAGE_VERSE_BRAND_FONT_MM,
  COVER_AUTHOR_FONT_MM,
  COVER_CONTENT_BLOCK_TOP_MM,
  COVER_PRODUCT_TAGLINE_KK,
  COVER_TAGLINE_FONT_MM,
  COVER_TITLE_FONT_MM,
  mmFontSizeToPdfPoints,
  normalizeCoverTitleFontPreset,
  resolveCoverTitleFontMm,
  type CoverTitleFontPreset,
  CUSTOM_TEXT_TOP_MM,
  QUESTION_ANSWER_TOP_MM,
  QUESTION_TITLE_TOP_MM,
  SECTION_BODY_TOP_MM,
  TOC_PDF_ROW_EXTRA_MM,
  TOC_ROW_GAP_MM,
  TOC_ROWS_TOP_MM,
  answerPresetToBodyMm,
  mergeTypographyWithCustomPage,
  mergeTypographyWithOrderSection,
} from '@/lib/bookLayout'
import { getPhotoCountFromTitleKk, resolveOverlayShadowOpacity } from '@/lib/utils/customPagePhotoMeta'
import { normalizeOverlayComposite } from '@/lib/utils/overlayParts'
import { normalizeQrSizeKey, QR_BACKGROUND_RADIUS_MM, QR_INTERIOR_PADDING_MM, QR_SIZE_MM } from '@/lib/utils/overlayQrRules'
import { drawSerializedRichHtml } from '@/lib/utils/pdfRichText'
import { buildPdfColophonBody } from '@/lib/utils/pdfColophon'
import { createClient } from '@/lib/supabase/client'
import {
  answerDisplaysAsPhotoContent,
  resolveBookPhotoImageUrl,
  splitPhotoAnswerToResolvedUrls,
  stripStorageImageTransformationParams,
} from '@/lib/utils/bookPhotoUrl'
import { candidateStorageObjectPaths, downloadBookPhotoBlob, fetchBookPhotoViaNextRoute, getDisplayableUrl } from '@/lib/storage/bookPhotos'
import { parseCssHexColor } from '@/lib/utils/colorHex'
import { normalizeFixedRectangleColor } from '@/lib/utils/fixedChapterRectPalette'
import {
  PHOTO_OVERLAY_CENTER_BAND_INSET_MM,
  PHOTO_OVERLAY_VERTICAL_INSET_MM,
} from '@/lib/utils/photoOverlayInsets'

const W = 148
const H = 210
const MARGIN = BOOK_MARGIN_MM

function withPdfOpacity(pdf: jsPDF, opacity: number, draw: () => void) {
  try {
    const GState = (pdf as unknown as { GState?: new (opts: { opacity: number }) => unknown }).GState
    if (!GState) throw new Error('no GState')
    pdf.setGState(new GState({ opacity }))
    draw()
    pdf.setGState(new GState({ opacity: 1 }))
  } catch {
    draw()
  }
}

function registerFonts(pdf: jsPDF) {
  pdf.addFileToVFS('Cormorant-Regular.ttf', cormorantRegular)
  pdf.addFont('Cormorant-Regular.ttf', 'Cormorant', 'normal')
  pdf.addFileToVFS('Cormorant-Bold.ttf', cormorantBold)
  pdf.addFont('Cormorant-Bold.ttf', 'Cormorant', 'bold')
  pdf.addFileToVFS('Cormorant-Italic.ttf', cormorantItalicTtfBase64)
  pdf.addFont('Cormorant-Italic.ttf', 'Cormorant', 'italic')
  pdf.addFileToVFS('Cormorant-BoldItalic.ttf', cormorantBoldItalicTtfBase64)
  pdf.addFont('Cormorant-BoldItalic.ttf', 'Cormorant', 'bolditalic')
}

async function fetchImageAsBase64(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(stripStorageImageTransformationParams(url))
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new window.Image()
        img.onload = () =>
          resolve({ dataUrl: reader.result as string, w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => resolve(null)
        img.src = reader.result as string
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Same as fetch for http(s) URLs, but also used after authenticated Storage `download()`. */
async function imageDataFromBlob(blob: Blob): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new window.Image()
      img.onload = () => resolve({ dataUrl, w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = dataUrl
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

/** Last-resort canvas backing-store limit (many engines cap ~16k); avoids tab OOM. No other downscale. */
const CANVAS_MAX_SIDE_PDF_PHOTO = 16384

export type PdfClientPhotoMode = 'png' | 'jpeg'

export const PDF_EXPORT_PNG_LABEL = 'Баспаханалық нұсқа (PNG Perfect - High Size)'
export const PDF_EXPORT_JPEG_LABEL = 'Жеңілдетілген нұсқа (JPEG 99 - Compressed)'

const JPEG_EXPORT_QUALITY = 0.99

let activeClientPhotoMode: PdfClientPhotoMode = 'png'

type CroppedPageImage = { dataUrl: string; format: 'PNG' | 'JPEG' }

/**
 * Center-crop to the book page aspect, then copy pixels at **native crop resolution** (1:1 with decoded bitmap).
 * - No `devicePixelRatio`: `canvas.width` / `canvas.height` are backing-store pixels, not CSS logical pixels.
 * - Smoothing off: no interpolation blur on copy or on rare uniform downscale for the hard cap only.
 * - `toDataURL('image/png')` — lossless; no quality parameter exists for PNG on canvas.
 */
async function cropToCanvas(
  dataUrl: string,
  imgW: number,
  imgH: number,
  targetWmm: number,
  targetHmm: number,
): Promise<CroppedPageImage> {
  const ratio = imgW / imgH
  const boxRatio = targetWmm / targetHmm
  let sx = 0,
    sy = 0,
    sw = imgW,
    sh = imgH
  if (ratio > boxRatio) {
    sw = imgH * boxRatio
    sx = (imgW - sw) / 2
  } else {
    sh = imgW / boxRatio
    sy = (imgH - sh) / 2
  }

  sx = Math.max(0, Math.floor(sx))
  sy = Math.max(0, Math.floor(sy))
  sw = Math.min(imgW - sx, Math.max(1, Math.ceil(sw)))
  sh = Math.min(imgH - sy, Math.max(1, Math.ceil(sh)))

  let cw = sw
  let ch = sh
  if (Math.max(cw, ch) > CANVAS_MAX_SIDE_PDF_PHOTO) {
    const f = CANVAS_MAX_SIDE_PDF_PHOTO / Math.max(cw, ch)
    cw = Math.max(1, Math.floor(cw * f))
    ch = Math.max(1, Math.floor(ch * f))
  }

  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('pdf photo decode'))
    img.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return activeClientPhotoMode === 'jpeg'
      ? { dataUrl, format: 'JPEG' }
      : { dataUrl, format: 'PNG' }
  }

  ctx.imageSmoothingEnabled = false
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  if (activeClientPhotoMode === 'jpeg') {
    return {
      dataUrl: canvas.toDataURL('image/jpeg', JPEG_EXPORT_QUALITY),
      format: 'JPEG',
    }
  }
  return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG' }
}

async function drawPhoto(
  pdf: jsPDF,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
  supabase: SupabaseClient | null = null
) {
  if (!url?.trim()) {
    pdf.setFillColor(238, 238, 238)
    pdf.rect(x, y, w, h, 'F')
    return
  }

  let result: { dataUrl: string; w: number; h: number } | null = null
  if (supabase) {
    // Prefer Storage `.download()` / same-origin proxy (original bytes). Avoid HTTP URL first — it may be
    // a transformation CDN URL or a path that decodes to a smaller pipeline than the raw object.
    const blob = await downloadBookPhotoBlob(supabase, url)
    if (blob) result = await imageDataFromBlob(blob)
    if (!result && typeof window !== 'undefined') {
      for (const objectPath of candidateStorageObjectPaths(url)) {
        const proxied = await fetchBookPhotoViaNextRoute(objectPath)
        if (proxied) {
          result = await imageDataFromBlob(proxied)
          break
        }
      }
    }
    if (!result) {
      const displayUrl = await getDisplayableUrl(supabase, url, { httpOnly: true })
      if (displayUrl) result = await fetchImageAsBase64(displayUrl)
    }
  }
  if (!result) {
    const pub = stripStorageImageTransformationParams(resolveBookPhotoImageUrl(url))
    if (pub) result = await fetchImageAsBase64(pub)
  }
  if (!result) {
    pdf.setFillColor(238, 238, 238)
    pdf.rect(x, y, w, h, 'F')
    return
  }
  try {
    const cropped = await cropToCanvas(result.dataUrl, result.w, result.h, w, h)
    pdf.addImage(cropped.dataUrl, cropped.format, x, y, w, h, undefined, 'SLOW')
  } catch {
    pdf.setFillColor(238, 238, 238)
    pdf.rect(x, y, w, h, 'F')
  }
}

let logoRasterCache: Promise<{ dataUrl: string; w: number; h: number } | null> | null = null

function loadLogoRaster(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (!logoRasterCache) {
    logoRasterCache = (async () => {
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        const res = await fetch(`${base}/logo.svg`)
        if (!res.ok) return null
        const svgText = await res.text()
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
        const objUrl = URL.createObjectURL(blob)
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('logo'))
          img.src = objUrl
        })
        const tw = img.naturalWidth || 600
        const th = img.naturalHeight || 160
        const canvas = document.createElement('canvas')
        canvas.width = Math.min(tw * 2, 2400)
        canvas.height = Math.min(th * 2, 800)
        const ctx = canvas.getContext('2d')!
        ctx.scale(canvas.width / tw, canvas.height / th)
        ctx.drawImage(img, 0, 0, tw, th)
        URL.revokeObjectURL(objUrl)
        return { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
      } catch {
        return null
      }
    })()
  }
  return logoRasterCache
}

async function drawLogoTopCenter(pdf: jsPDF, topMm: number, maxHmm: number) {
  const raster = await loadLogoRaster()
  if (!raster) return
  const aspect = raster.w / raster.h
  const h = maxHmm
  const w = h * aspect
  const x = (W - w) / 2
  pdf.addImage(raster.dataUrl, 'PNG', x, topMm, w, h, undefined, 'FAST')
}

/** Height consumed in mm */
function measureWrappedTextBlockHmm(pdf: jsPDF, text: string, maxW: number, fontSizeMm: number, lineHeightMm?: number): number {
  const lineH = lineHeightMm ?? fontSizeMm * 1.45
  pdf.setFont('Cormorant', 'normal')
  pdf.setFontSize(mmFontSizeToPdfPoints(fontSizeMm))
  const paragraphs = text.split('\n\n')
  let total = 0
  paragraphs.forEach((para, pIdx) => {
    const clean = para.replace(/\n/g, ' ').trim()
    if (!clean) {
      total += lineH
      return
    }
    const lines: string[] = pdf.splitTextToSize(clean, maxW)
    total += lines.length * lineH + (pIdx < paragraphs.length - 1 ? fontSizeMm * 0.8 : 0)
  })
  return total
}

function drawVectorText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSizeMm: number,
  options: {
    bold?: boolean
    color?: [number, number, number]
    align?: 'left' | 'center' | 'right'
    lineHeightMm?: number
  } = {}
): number {
  const { bold = false, color = [26, 26, 26], align = 'left', lineHeightMm } = options
  const lineH = lineHeightMm ?? fontSizeMm * 1.45
  pdf.setFont('Cormorant', bold ? 'bold' : 'normal')
  pdf.setFontSize(mmFontSizeToPdfPoints(fontSizeMm))
  pdf.setTextColor(color[0], color[1], color[2])

  const paragraphs = text.split('\n\n')
  let curY = y
  paragraphs.forEach((para, pIdx) => {
    const clean = para.replace(/\n/g, ' ').trim()
    if (!clean) {
      curY += lineH
      return
    }
    const lines: string[] = pdf.splitTextToSize(clean, maxW)
    lines.forEach((line: string, i: number) => {
      const lineY = curY + i * lineH + fontSizeMm * 0.75
      if (align === 'center') pdf.text(line, x + maxW / 2, lineY, { align: 'center' })
      else if (align === 'right') pdf.text(line, x + maxW, lineY, { align: 'right' })
      else pdf.text(line, x, lineY)
    })
    curY += lines.length * lineH + (pIdx < paragraphs.length - 1 ? fontSizeMm * 0.8 : 0)
  })
  return curY - y
}

/** Centered «senimen.books» — Cormorant, near-black on white pages (cover / chapter / faktiler text). */
function drawBrandFooterCenter(pdf: jsPDF, baselineFromBottomMm: number) {
  const fontMm = BOOK_BRAND_FOOTER_FONT_MM
  const baseline = H - baselineFromBottomMm
  const topY = baseline - fontMm * 0.75
  drawVectorText(pdf, 'senimen.books', MARGIN, topY, W - MARGIN * 2, fontMm, {
    color: [17, 17, 17],
    align: 'center',
    lineHeightMm: fontMm * 1.22,
  })
}

/** Same brand line inside a bottom color band (phrase / fixed chapter page). */
function drawBrandFooterInBand(pdf: jsPDF, bandTopMm: number, bandHmm: number) {
  const fontMm = BOOK_BRAND_FOOTER_FONT_MM
  const baseline = bandTopMm + bandHmm - BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM
  const topY = baseline - fontMm * 0.75
  drawVectorText(pdf, 'senimen.books', MARGIN, topY, W - MARGIN * 2, fontMm, {
    align: 'center',
    color: [235, 235, 235],
    lineHeightMm: fontMm * 1.22,
  })
}

/** Last PDF-only page: logo fixed like cover (top); «Соңы» + phrase vertically centred below. */
async function drawColophonPage(pdf: jsPDF, body: string) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  const logoTopMm = 20
  const logoHmm = 10
  await drawLogoTopCenter(pdf, logoTopMm, logoHmm)

  const titleMm = 11.5
  const titleLineHmm = 13
  const gapTitleBody = 8
  const bodyMm = 5.9
  const bodyLineHmm = bodyMm * 1.38
  const maxW = W - MARGIN * 2
  const single = body.replace(/\s+/g, ' ').trim()

  pdf.setFont('Cormorant', 'bold')
  pdf.setFontSize(titleMm * 2.8346)
  const titleLineCount = Math.max(1, pdf.splitTextToSize('Соңы', maxW).length)
  const titleBlockHmm = titleLineCount * titleLineHmm

  pdf.setFont('Cormorant', 'normal')
  pdf.setFontSize(bodyMm * 2.8346)
  const bodyLineCount = Math.max(1, pdf.splitTextToSize(single, maxW).length)
  const bodyBlockHmm = bodyLineCount * bodyLineHmm

  const textStackHmm = titleBlockHmm + gapTitleBody + bodyBlockHmm
  const regionTop = logoTopMm + logoHmm + 8
  const regionBottom = H - MARGIN
  const regionHeight = Math.max(0, regionBottom - regionTop)
  let y = regionTop + (regionHeight - textStackHmm) / 2
  if (y < regionTop) y = regionTop

  y += drawVectorText(pdf, 'Соңы', MARGIN, y, maxW, titleMm, {
    bold: true,
    color: [17, 17, 17],
    align: 'center',
    lineHeightMm: titleLineHmm,
  })
  y += gapTitleBody
  drawVectorText(pdf, single, MARGIN, y, maxW, bodyMm, {
    align: 'center',
    color: [26, 26, 26],
    lineHeightMm: bodyLineHmm,
  })
}

function drawPageFooter(pdf: jsPDF, pageNum: number, bookTitle: string, isLeft: boolean) {
  pdf.setDrawColor(26, 26, 26)
  pdf.setLineWidth(0.3 / 2.8346)
  pdf.line(MARGIN, H - BOOK_FOOTER_RULE_FROM_BOTTOM_MM, W - MARGIN, H - BOOK_FOOTER_RULE_FROM_BOTTOM_MM)

  /** Label baseline; drawVectorText takes the text-box top, so subtract glyph height once. */
  const footY = H - BOOK_FOOTER_LABEL_FROM_BOTTOM_MM
  if (isLeft) {
    drawVectorText(pdf, String(pageNum), MARGIN, footY - 5.64, 20, 5.64, { color: [26, 26, 26] })
    if (bookTitle)
      drawVectorText(pdf, bookTitle, W - MARGIN - 75, footY - 4.23, 75, 4.23, {
        color: [26, 26, 26],
        align: 'right',
      })
  } else {
    /** Same text baseline as page number (recto uses footY − 5.64 + 0.75×5.64). */
    const numMm = 5.64
    const pageNumTopY = footY - numMm
    const sharedBaseline = pageNumTopY + numMm * 0.75
    const brandMm = BOOK_PAGE_VERSE_BRAND_FONT_MM
    const brandTopY = sharedBaseline - brandMm * 0.75
    drawVectorText(pdf, 'senimen.books', MARGIN, brandTopY, 52, brandMm, {
      color: [150, 150, 150],
      lineHeightMm: brandMm * 1.2,
    })
    drawVectorText(pdf, String(pageNum), W - MARGIN - 22, pageNumTopY, 22, numMm, {
      color: [26, 26, 26],
      align: 'right',
    })
  }
}

async function drawCoverPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'cover' }>,
  titleMm: number,
) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  await drawLogoTopCenter(pdf, 20, 10)

  let y = COVER_CONTENT_BLOCK_TOP_MM
  const titleSizeMm =
    titleMm > 0
      ? titleMm
      : page.titleFontMm && page.titleFontMm > 0
        ? page.titleFontMm
        : COVER_TITLE_FONT_MM
  pdf.setFont('Cormorant', 'bold')
  pdf.setFontSize(mmFontSizeToPdfPoints(titleSizeMm))
  y += drawVectorText(pdf, page.bookTitle, MARGIN, y, W - MARGIN * 2, titleSizeMm, {
    bold: true,
    color: [17, 17, 17],
    align: 'center',
    lineHeightMm: titleSizeMm * 1.14,
  })
  y += 5
  y += drawVectorText(pdf, COVER_PRODUCT_TAGLINE_KK, MARGIN, y, W - MARGIN * 2, COVER_TAGLINE_FONT_MM, {
    bold: true,
    color: [17, 17, 17],
    align: 'center',
    lineHeightMm: COVER_TAGLINE_FONT_MM * 1.32,
  })
  y += 1.5
  if (page.authorName) {
    y += drawVectorText(pdf, `Кітап авторы – ${page.authorName}`, MARGIN, y, W - MARGIN * 2, COVER_AUTHOR_FONT_MM, {
      bold: false,
      color: [17, 17, 17],
      align: 'center',
      lineHeightMm: COVER_AUTHOR_FONT_MM * 1.32,
    })
  }

  drawBrandFooterCenter(pdf, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM)
}

async function drawFixedChapterPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'fixed_chapter' }>,
  supabase: SupabaseClient | null
) {
  const rectHex = normalizeFixedRectangleColor(page.rectColor)
  const [r, g, b] = parseCssHexColor(rectHex)

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  const photoHmm = H * 0.6
  const bandHmm = H * 0.4
  const rawPath = (page.photoPath || '').trim()
  if (rawPath) {
    await drawPhoto(pdf, rawPath, 0, 0, W, photoHmm, supabase)
  } else {
    pdf.setFillColor(232, 230, 227)
    pdf.rect(0, 0, W, photoHmm, 'F')
  }

  pdf.setFillColor(r, g, b)
  pdf.rect(0, photoHmm, W, bandHmm, 'F')

  const bandTop = photoHmm
  const phrase = (page.phrase || '').trim()
  const padX = 10
  const phrasePadTop = 6
  const phraseReserveBottom =
    BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM + BOOK_BRAND_FOOTER_FONT_MM * 1.35 + 3
  const phraseZoneTop = bandTop + phrasePadTop
  const phraseZoneBottom = bandTop + bandHmm - phraseReserveBottom
  const avail = Math.max(0, phraseZoneBottom - phraseZoneTop)

  const phraseFontMm = 7.15
  const lineHmm = 8.2
  if (phrase) {
    pdf.setFont('Cormorant', 'bold')
    pdf.setFontSize(phraseFontMm * 2.8346)
    pdf.setTextColor(255, 255, 255)
    const lines: string[] = pdf.splitTextToSize(phrase, W - padX * 2)
    const blockHmm = lines.length * lineHmm
    const startBaseline =
      phraseZoneTop + Math.max(0, (avail - blockHmm) / 2) + phraseFontMm * 0.72
    lines.forEach((line: string, i: number) => {
      pdf.text(line, W / 2, startBaseline + i * lineHmm, { align: 'center' })
    })
  }

  drawBrandFooterInBand(pdf, bandTop, bandHmm)
}

async function drawChapterBreakPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'chapter_break' }>
) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  await drawLogoTopCenter(pdf, 20, 10)

  const midY = H * 0.5 - 18
  const partMm = 6.45
  const titleMm = 11.25
  drawVectorText(pdf, `${page.chapterNum}-бөлім`, MARGIN, midY - 9, W - MARGIN * 2, partMm, {
    bold: true,
    color: [17, 17, 17],
    align: 'center',
    lineHeightMm: partMm * 1.12,
  })
  drawVectorText(pdf, page.title, MARGIN, midY + 9, W - MARGIN * 2, titleMm, {
    bold: false,
    color: [17, 17, 17],
    align: 'center',
    lineHeightMm: titleMm * 1.28,
  })

  drawBrandFooterCenter(pdf, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM)
}

function drawContentsPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'contents' }>,
  pageNum: number,
  isLeft: boolean
) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  drawVectorText(pdf, 'Мазмұны', MARGIN, 16, W - MARGIN * 2, 11, {
    bold: true,
    color: [26, 26, 26],
    lineHeightMm: 13,
  })

  const tocMm = 6
  let rowTop = TOC_ROWS_TOP_MM
  const usable = W - MARGIN * 2
  pdf.setFont('Cormorant', 'normal')

  for (const ch of page.chapters) {
    pdf.setFontSize(tocMm * 2.8346)
    pdf.setTextColor(26, 26, 26)
    const labelLines = pdf.splitTextToSize(ch.title, usable * 0.62)
    const label = labelLines[0] + (labelLines.length > 1 ? '…' : '')
    const numStr = String(ch.pageNum)
    const baseline = rowTop + tocMm * 0.72
    pdf.text(label, MARGIN, baseline)
    pdf.text(numStr, W - MARGIN, baseline, { align: 'right' })
    const lw = pdf.getTextWidth(label)
    const nw = pdf.getTextWidth(numStr)
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.15 / 2.8346)
    const xs = MARGIN + lw + 2
    const xe = W - MARGIN - nw - 2
    if (xe > xs) pdf.line(xs, baseline - 1.1, xe, baseline - 1.1)
    rowTop += TOC_ROW_GAP_MM + TOC_PDF_ROW_EXTRA_MM
  }

  if (page.faktilerPageNum != null) {
    pdf.setFontSize(tocMm * 2.8346)
    pdf.setTextColor(26, 26, 26)
    const fkStr = String(page.faktilerPageNum)
    const baselineFk = rowTop + tocMm * 0.72
    pdf.text('Фактілер', MARGIN, baselineFk)
    pdf.text(fkStr, W - MARGIN, baselineFk, { align: 'right' })
    const fw = pdf.getTextWidth('Фактілер')
    const fnw = pdf.getTextWidth(fkStr)
    const xsF = MARGIN + fw + 2
    const xeF = W - MARGIN - fnw - 2
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.15 / 2.8346)
    if (xeF > xsF) pdf.line(xsF, baselineFk - 1.1, xeF, baselineFk - 1.1)
    rowTop += TOC_ROW_GAP_MM + TOC_PDF_ROW_EXTRA_MM
  }

  pdf.setFontSize(tocMm * 2.8346)
  pdf.setTextColor(26, 26, 26)
  const hatStr = page.hatPageNum != null ? String(page.hatPageNum) : '…'
  const baselineHat = rowTop + tocMm * 0.72
  pdf.text('Хат', MARGIN, baselineHat)
  pdf.setTextColor(page.hatPageNum != null ? 26 : 170, page.hatPageNum != null ? 26 : 170, page.hatPageNum != null ? 26 : 170)
  pdf.text(hatStr, W - MARGIN, baselineHat, { align: 'right' })
  pdf.setTextColor(26, 26, 26)
  const hw = pdf.getTextWidth('Хат')
  const hnw = pdf.getTextWidth(hatStr)
  const xsH = MARGIN + hw + 2
  const xeH = W - MARGIN - hnw - 2
  pdf.setDrawColor(220, 220, 220)
  if (xeH > xsH) pdf.line(xsH, baselineHat - 1.1, xeH, baselineHat - 1.1)

  drawPageFooter(pdf, pageNum, '', isLeft)
}

function drawAlgySozPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'algy_soz' }>,
  pageNum: number,
  bookTitle: string,
  isLeft: boolean,
  typo: BookTypography
) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  const showTitle = page.showSectionTitle !== false
  if (showTitle) {
    drawVectorText(pdf, 'Алғы сөз', MARGIN, 16, W - MARGIN * 2, 11, {
      bold: true,
      color: [26, 26, 26],
      lineHeightMm: 13,
    })
  }

  const fontMm = answerPresetToBodyMm(typo.fontPreset)
  const bodyTop = showTitle ? SECTION_BODY_TOP_MM : QUESTION_TITLE_TOP_MM
  drawSerializedRichHtml(pdf, page.text || '', MARGIN, bodyTop, W - MARGIN * 2, fontMm, typo.textAlign, false)

  drawPageFooter(pdf, pageNum, bookTitle, isLeft)
}

function drawHatPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'hat' }>,
  pageNum: number,
  bookTitle: string,
  isLeft: boolean,
  typo: BookTypography
) {
  const content = page.text?.trim() ?? ''

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  const showTitle = page.showSectionTitle !== false
  if (showTitle) {
    drawVectorText(pdf, 'Хат', MARGIN, 16, W - MARGIN * 2, 11, {
      bold: true,
      color: [26, 26, 26],
      lineHeightMm: 13,
    })
  }

  const fontMm = answerPresetToBodyMm(typo.fontPreset)
  const bodyTop = showTitle ? SECTION_BODY_TOP_MM : QUESTION_TITLE_TOP_MM
  drawSerializedRichHtml(pdf, content, MARGIN, bodyTop, W - MARGIN * 2, fontMm, typo.textAlign, false)

  drawPageFooter(pdf, pageNum, bookTitle, isLeft)
}

async function drawPhotoCustomPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'custom' }>,
  typo: BookTypography,
  supabase: SupabaseClient | null
) {
  const customPage = page.data
  const answer = page.answer
  const photos = answer ? splitPhotoAnswerToResolvedUrls(answer) : []
  const isPhoto = answer && answerDisplaysAsPhotoContent(answer)
  const photoCount = getPhotoCountFromTitleKk(customPage?.title_kk) || photos.length || 1

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  if (!isPhoto) {
    const body = answer || ''
    const typoEff = mergeTypographyWithCustomPage(typo, customPage)
    const fontMm = answerPresetToBodyMm(typoEff.fontPreset)
    drawSerializedRichHtml(pdf, body, MARGIN, CUSTOM_TEXT_TOP_MM, W - MARGIN * 2, fontMm, typoEff.textAlign, false)
    return
  }

  if (photoCount === 1) await drawPhoto(pdf, photos[0] || answer, 0, 0, W, H, supabase)
  else if (photoCount === 2) {
    await drawPhoto(pdf, photos[0] || '', 0, 0, W, H / 2, supabase)
    await drawPhoto(pdf, photos[1] || '', 0, H / 2, W, H / 2, supabase)
  } else {
    await drawPhoto(pdf, photos[0] || '', 0, 0, W / 2, H / 2, supabase)
    await drawPhoto(pdf, photos[1] || '', W / 2, 0, W / 2, H / 2, supabase)
    await drawPhoto(pdf, photos[2] || '', 0, H / 2, W / 2, H / 2, supabase)
    await drawPhoto(pdf, photos[3] || '', W / 2, H / 2, W / 2, H / 2, supabase)
  }

  const overlayInBook = customPage?.overlay_in_book === true
  if (overlayInBook && customPage?.overlay_text) {
    const { vertical: pos, bg: bgType } = normalizeOverlayComposite(customPage.overlay_position)
    const op = (customPage.photo_dpi || 60) / 100
    const overlayH = H * 0.45
    const overlayY = pos === 'top' ? 0 : pos === 'bottom' ? H - overlayH : (H - overlayH) / 2

    if (bgType === 'solid') {
      pdf.setFillColor(0, 0, 0)
      withPdfOpacity(pdf, op, () => pdf.rect(0, 0, W, H, 'F'))
    } else if (bgType === 'gradient') {
      const gradHeightPx = Math.round(overlayH * 11.811)
      let gradDataUrl: string | null = null
      if (typeof document !== 'undefined') {
        const gradCanvas = document.createElement('canvas')
        gradCanvas.width = 10
        gradCanvas.height = gradHeightPx
        const gCtx = gradCanvas.getContext('2d')!
        let y0 = 0
        let y1 = gradCanvas.height
        if (pos === 'bottom') {
          y0 = gradCanvas.height
          y1 = 0
        } else if (pos === 'center') {
          y0 = 0
          y1 = gradCanvas.height
        }
        const grad = gCtx.createLinearGradient(0, y0, 0, y1)
        if (pos === 'center') {
          grad.addColorStop(0, 'rgba(0,0,0,0)')
          grad.addColorStop(0.5, `rgba(0,0,0,${op})`)
          grad.addColorStop(1, 'rgba(0,0,0,0)')
        } else {
          grad.addColorStop(0, `rgba(0,0,0,${op})`)
          grad.addColorStop(1, 'rgba(0,0,0,0)')
        }
        gCtx.fillStyle = grad
        gCtx.fillRect(0, 0, gradCanvas.width, gradCanvas.height)
        gradDataUrl = gradCanvas.toDataURL('image/png')
      }
      if (gradDataUrl) {
        pdf.addImage(gradDataUrl, 'PNG', 0, overlayY, W, overlayH, undefined, 'FAST')
      }
    }

    const fontSizeMm = parseInt(customPage.text_content || '18', 10) * 0.352778
    const textMaxW = W - MARGIN * 2
    const lineHeightMm = fontSizeMm * 1.3
    const textBlockHmm = measureWrappedTextBlockHmm(pdf, customPage.overlay_text, textMaxW, fontSizeMm, lineHeightMm)
    const vertInset =
      pos === 'top'
        ? PHOTO_OVERLAY_VERTICAL_INSET_MM
        : pos === 'bottom'
          ? PHOTO_OVERLAY_VERTICAL_INSET_MM
          : PHOTO_OVERLAY_CENTER_BAND_INSET_MM
    const textY =
      pos === 'top'
        ? overlayY + vertInset
        : pos === 'bottom'
          ? overlayY + overlayH - textBlockHmm - vertInset
          : overlayY + (overlayH - textBlockHmm) / 2
    const shadowStrength = resolveOverlayShadowOpacity(customPage)
    if (shadowStrength > 0) {
      const dim = Math.round(40 + shadowStrength * 0.15)
      drawVectorText(pdf, customPage.overlay_text, MARGIN + 0.35, textY + 0.35, textMaxW, fontSizeMm, {
        color: [dim, dim, dim],
        align: 'center',
        lineHeightMm,
      })
    }
    drawVectorText(pdf, customPage.overlay_text, MARGIN, textY, textMaxW, fontSizeMm, {
      color: [255, 255, 255],
      align: 'center',
      lineHeightMm,
    })
  }

  const qrInBook = customPage?.qr_in_book === true
  const qrLink = customPage?.qr_url?.trim()
  const qrOk = qrLink && /^https?:\/\//i.test(qrLink)
  if (qrInBook && qrOk) {
    try {
      const QR = (await import('qrcode')).default
      const qrDataUrl = await QR.toDataURL(qrLink, { margin: 3, width: 512 })
      const szKey = normalizeQrSizeKey(customPage?.qr_size)
      const qrMm = QR_SIZE_MM[szKey]
      const pad = QR_INTERIOR_PADDING_MM
      const inner = Math.max(6, qrMm - 2 * pad)
      const qPos = (customPage?.qr_vertical || 'bottom') as 'top' | 'center' | 'bottom'
      const inset = PHOTO_OVERLAY_VERTICAL_INSET_MM
      const qx = (W - qrMm) / 2
      let qy = inset
      if (qPos === 'center') qy = (H - qrMm) / 2
      if (qPos === 'bottom') qy = H - inset - qrMm
      const r = QR_BACKGROUND_RADIUS_MM
      const so = 0.35
      pdf.setFillColor(236, 236, 236)
      pdf.roundedRect(qx + so, qy + so, qrMm, qrMm, r, r, 'F')
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(qx, qy, qrMm, qrMm, r, r, 'F')
      pdf.addImage(qrDataUrl, 'PNG', qx + pad, qy + pad, inner, inner, undefined, 'FAST')
    } catch {
      /* skip broken QR */
    }
  }
}

async function drawFaktilerDividerPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'faktiler_divider' }>
) {
  await drawChapterBreakPage(pdf, {
    type: 'chapter_break',
    title: page.title,
    chapterNum: page.chapterNum,
    minFlatQuestionIndex: Number.MAX_SAFE_INTEGER,
  })
}

function drawFaktilerTextPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'faktiler_text' }>,
  _pageNum: number,
  _bookTitle: string,
  _isLeft: boolean,
  typo: BookTypography
) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')
  const isCont = !!page.faktilerTextContinuation
  const fontMm = answerPresetToBodyMm(typo.fontPreset)
  const colW = W - MARGIN * 2
  const bodyTop = isCont ? QUESTION_TITLE_TOP_MM : H * 0.4
  drawSerializedRichHtml(pdf, page.text || '', MARGIN, bodyTop, colW, fontMm, 'center', false)

  drawBrandFooterCenter(pdf, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM)
}

async function drawFaktilerPhotoPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'faktiler_photo' }>,
  _pageNum: number,
  _bookTitle: string,
  _isLeft: boolean,
  supabase: SupabaseClient | null
) {
  pdf.setFillColor(17, 17, 17)
  pdf.rect(0, 0, W, H, 'F')
  const raw = (page.photoUrl || '').trim()
  if (raw) await drawPhoto(pdf, raw, 0, 0, W, H, supabase)
}

async function drawQuestionAnswerPage(
  pdf: jsPDF,
  page: Extract<PreviewPage, { type: 'question' }>,
  pageNum: number,
  bookTitle: string,
  isLeft: boolean,
  typo: BookTypography,
  supabase: SupabaseClient | null = null
) {
  const question = page.data
  const answer = page.answer || ''
  const showHeader = page.showQuestionHeader !== false

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  if (answer && answerDisplaysAsPhotoContent(answer)) {
    const photos = splitPhotoAnswerToResolvedUrls(answer)
    const photoCount = photos.length || 1
    if (photoCount === 1) {
      await drawPhoto(pdf, photos[0] || answer, 0, 0, W, H, supabase)
    } else if (photoCount === 2) {
      await drawPhoto(pdf, photos[0] || '', 0, 0, W, H / 2, supabase)
      await drawPhoto(pdf, photos[1] || '', 0, H / 2, W, H / 2, supabase)
    } else {
      await drawPhoto(pdf, photos[0] || '', 0, 0, W / 2, H / 2, supabase)
      await drawPhoto(pdf, photos[1] || '', W / 2, 0, W / 2, H / 2, supabase)
      await drawPhoto(pdf, photos[2] || '', 0, H / 2, W / 2, H / 2, supabase)
      await drawPhoto(pdf, photos[3] || '', W / 2, H / 2, W / 2, H / 2, supabase)
    }
    return
  }

  if (question?.question_kk && showHeader) {
    drawVectorText(pdf, question.question_kk, MARGIN, QUESTION_TITLE_TOP_MM, W - MARGIN * 2, 4.23, {
      bold: true,
      color: [26, 26, 26],
      lineHeightMm: 4.23 * 1.2,
    })
  }

  if (answer) {
    const fontMm = answerPresetToBodyMm(typo.fontPreset)
    const answerTopMm = showHeader ? QUESTION_ANSWER_TOP_MM : QUESTION_TITLE_TOP_MM
    drawSerializedRichHtml(pdf, answer, MARGIN, answerTopMm, W - MARGIN * 2, fontMm, typo.textAlign, false)
  }

  drawPageFooter(pdf, pageNum, bookTitle, isLeft)
}

export type ExportOrderInput = {
  book_title: string
  author_name?: string
  recipient_name?: string
  category_id?: string | null
  /** Prefer for colophon date when set. */
  completed_at?: string | null
  submitted_at?: string | null
  updated_at?: string | null
  /** From `categories.pdf_colophon_template_kk`; PDF last page only when non-empty. */
  pdf_colophon_template_kk?: string | null
  algy_soz?: string
  hat_text?: string
  faktiler_text?: string | null
  faktiler_photo_path?: string | null
  faktiler_facts?: unknown
  answer_font_preset?: string
  answer_text_align?: string
  cover_title_font_preset?: string | null
  algy_font_preset?: string | null
  hat_font_preset?: string | null
  fixed_rectangle_color?: string | null
}

export async function exportBookToPDF(
  order: ExportOrderInput,
  chapters: Chapter[],
  answers: Record<string, string>,
  customPages: CustomPage[],
  onProgress?: (current: number, total: number) => void,
  typographyOverride?: BookTypography | null,
  chapterFixedPhotos?: Record<string, string>,
  chapterFixedPhraseOverrides?: Record<string, string>,
  editorSkippedChapterIds?: string[],
  coverTitleFontPreset?: import('@/lib/bookLayout').CoverTitleFontPreset,
  photoMode: PdfClientPhotoMode = 'png',
): Promise<void> {
  logoRasterCache = null
  activeClientPhotoMode = photoMode

  const supabase: SupabaseClient | null = typeof window !== 'undefined' ? createClient() : null

  const typo = typographyOverride ?? normalizeBookTypographyFromOrder(order)

  const coverTitleFontMm = resolveCoverTitleFontMm(order, coverTitleFontPreset)

  const coverPresetResolved = normalizeCoverTitleFontPreset(
    coverTitleFontPreset ??
      (order as { cover_title_font_preset?: string | null }).cover_title_font_preset,
  )

  const orderForPages = {
    ...(order as object),
    cover_title_font_preset: coverPresetResolved,
  } as ExportOrderInput

  const previewPages = buildPreviewPages({
    order: orderForPages,
    chapters,
    answers,
    customPages,
    algy_soz: order.algy_soz ?? '',
    hat_text: order.hat_text ?? '',
    typography: typo,
    chapterFixedPhotos,
    chapterFixedPhraseOverrides,
    editorSkippedChapterIds,
    coverTitleFontPreset: coverPresetResolved,
  })

  if (previewPages.length === 0) {
    throw new Error('Экспорт үшін беттер жоқ')
  }

  const colophonBody = buildPdfColophonBody(
    order.pdf_colophon_template_kk,
    order.author_name ?? '',
    order
  )

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [W, H],
    compress: false,
  })
  registerFonts(pdf)

  const bookTitle = order.book_title || ''

  const total = previewPages.length + (colophonBody ? 1 : 0)
  for (let i = 0; i < previewPages.length; i++) {
    onProgress?.(i + 1, total)
    if (i > 0) pdf.addPage([W, H], 'portrait')

    const page = previewPages[i]
    const pageNum = i + 1
    const isLeft = i % 2 === 0

    switch (page.type) {
      case 'cover':
        await drawCoverPage(pdf, page, coverTitleFontMm)
        break
      case 'contents':
        drawContentsPage(pdf, page, pageNum, isLeft)
        break
      case 'chapter_break':
        await drawChapterBreakPage(pdf, page)
        break
      case 'fixed_chapter':
        await drawFixedChapterPage(pdf, page, supabase)
        break
      case 'algy_soz':
        drawAlgySozPage(
          pdf,
          page,
          pageNum,
          bookTitle,
          isLeft,
          mergeTypographyWithOrderSection(typo, order, 'algy')
        )
        break
      case 'hat':
        drawHatPage(
          pdf,
          page,
          pageNum,
          bookTitle,
          isLeft,
          mergeTypographyWithOrderSection(typo, order, 'hat')
        )
        break
      case 'faktiler_divider':
        await drawFaktilerDividerPage(pdf, page)
        break
      case 'faktiler_text':
        drawFaktilerTextPage(pdf, page, pageNum, bookTitle, isLeft, typo)
        break
      case 'faktiler_photo':
        await drawFaktilerPhotoPage(pdf, page, pageNum, bookTitle, isLeft, supabase)
        break
      case 'question':
        await drawQuestionAnswerPage(pdf, page, pageNum, bookTitle, isLeft, typo, supabase)
        break
      case 'custom':
        await drawPhotoCustomPage(pdf, page, typo, supabase)
        const answer = page.answer || ''
        if (answer && answerDisplaysAsPhotoContent(answer)) break
        drawPageFooter(pdf, pageNum, bookTitle, isLeft)
        break
      default:
        break
    }
  }

  if (colophonBody) {
    onProgress?.(total, total)
    pdf.addPage([W, H], 'portrait')
    await drawColophonPage(pdf, colophonBody)
  }

  pdf.save(`${(order.book_title || 'book').replace(/\s+/g, '_')}.pdf`)
}
