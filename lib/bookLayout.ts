/** Physical A5 book layout — shared by Preview (scaled) and PDF export (mm). */

/** Cover + marketing: product line under the book title (preview + PDF). */
export const COVER_PRODUCT_TAGLINE_KK = 'Естелік • Альбом • Кітап • Тарих'

/** Cover title block — distance from physical page top (mm). Larger = block sits lower on page. */
export const COVER_CONTENT_BLOCK_TOP_MM = 74

export const COVER_TITLE_FONT_MM = 13.5
export const COVER_TAGLINE_FONT_MM = 5.15
export const COVER_AUTHOR_FONT_MM = 5.15

/**
 * Centered «senimen.books» on subtitle-style pages only (cover, chapter divider, faktiler text, phrase band).
 * Ruled body/TOC verso pages use `BOOK_PAGE_VERSE_BRAND_FONT_MM` (Cormorant, muted) on the same baseline as the page number.
 */
export const BOOK_BRAND_FOOTER_FONT_MM = 5.05

/**
 * Centered «senimen.books» on white pages: baseline above physical bottom (mm).
 * Larger = further from bottom edge = sits higher.
 */
export const BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM = 17

/**
 * Ruled verso (TOC, answers, …): «senimen.books» — Cormorant; same baseline row as page number (smaller than subtitle pages).
 */
export const BOOK_PAGE_VERSE_BRAND_FONT_MM = 4.65

export const BOOK_PAGE_W_MM = 148
export const BOOK_PAGE_H_MM = 210
export const BOOK_MARGIN_MM = 20

/**
 * Full-width footer rule above the footer labels (preview `bottom` + PDF `H − this`).
 * Closer to bottom; ~9mm clearance above the label baseline so it can never strike text glyphs.
 */
export const BOOK_FOOTER_RULE_FROM_BOTTOM_MM = 18

/**
 * Footer label baseline distance from physical bottom (mm). Preview labels mirror with bottom = this − 3.
 * Smaller value = labels sit closer to the page edge.
 */
export const BOOK_FOOTER_LABEL_FROM_BOTTOM_MM = 9

/**
 * Inset from physical page bottom for the body column (preview `bottom` + pagination budget).
 * Body must end above the footer rule with breathing room.
 */
export const BOOK_CONTENT_BOTTOM_MM = 28

/**
 * Extra mm subtracted only when counting lines per page: last-line descenders + jsPDF vs ideal box model.
 * Preview clip uses BOOK_CONTENT_BOTTOM_MM alone; pagination must be slightly pessimistic so PDF never runs long.
 */
export const BOOK_PAGINATION_INK_SLACK_MM = 5

/** TOC rows start (below «Мазмұны» title band), aligned with preview stacking */
export const TOC_ROWS_TOP_MM = 34
/** PDF contents page row step (original spacing). */
export const TOC_ROW_GAP_MM = 7.5
/** Extra vertical step for PDF TOC rows only (preview uses TOC_PREVIEW_ROW_GAP_MM). */
export const TOC_PDF_ROW_EXTRA_MM = 1.4
/** Preview-only TOC list tightening (does not affect PDF). */
export const TOC_PREVIEW_ROW_GAP_MM = 5.4

/** Question title band */
export const QUESTION_TITLE_TOP_MM = 18.9
export const QUESTION_TITLE_BLOCK_H_MM = 12

/** Answer column starts below question title */
export const QUESTION_ANSWER_TOP_MM = 38.4

/** Foreword / hat body start (below section heading) */
export const SECTION_BODY_TOP_MM = 37

/** Custom text-only pages start body here */
export const CUSTOM_TEXT_TOP_MM = 18.9

/** Фактілер facts column width (centered on page); pagination + PDF use this measure. */
export const FAKTILER_COLUMN_W_MM = 100
/** Body start below optional «Фактілер» band on facts text pages */
export const FAKTILER_BODY_TOP_MM = 40

export const BODY_LINE_HEIGHT_RATIO = 1.4

/** Whole-book body preset (px). DB column `answer_font_preset`. */
export const GLOBAL_FONT_PRESETS = ['14', '16', '18', '20', '22'] as const
export type AnswerFontPreset = (typeof GLOBAL_FONT_PRESETS)[number]

/** Foreword / hat / custom text blocks: one step finer grid (no 22). */
export const SECTION_FONT_PRESETS = ['14', '16', '18', '20'] as const
export type SectionFontPreset = (typeof SECTION_FONT_PRESETS)[number]

export type AnswerTextAlign = 'justify' | 'left'

/** Typography snapshot for measuring/pagination/PDF (mirrors editor store + DB order fields). */
export interface BookTypographyInput {
  fontPreset: AnswerFontPreset
  textAlign: AnswerTextAlign
}

/** Anchor: 18px equivalent ≈ 7.05mm body at print scale. */
const MEDIUM_BODY_MM = 7.05

function presetToPx(preset: AnswerFontPreset): number {
  const n = Number(preset)
  return Number.isFinite(n) ? n : 18
}

export function answerPresetToBodyMm(preset: AnswerFontPreset): number {
  const px = presetToPx(preset)
  return MEDIUM_BODY_MM * (px / 18)
}

/** Editor / UI: answer area CSS px by preset (+2px for readability on mobile and desktop). */
export function answerPresetToUiPx(preset: AnswerFontPreset): number {
  return Math.min(26, presetToPx(preset) + 2)
}

/** Maps DB / legacy values to global preset. */
export function normalizeGlobalFontPreset(v: unknown): AnswerFontPreset {
  const s = String(v ?? '').trim()
  if ((GLOBAL_FONT_PRESETS as readonly string[]).includes(s)) return s as AnswerFontPreset
  if (s === 'small' || s === 'medium' || s === 'large') {
    if (s === 'small') return '14'
    if (s === 'large') return '22'
    return '18'
  }
  return '18'
}

export function normalizeSectionFontPreset(v: unknown): AnswerFontPreset | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if ((SECTION_FONT_PRESETS as readonly string[]).includes(s)) return s as AnswerFontPreset
  if ((GLOBAL_FONT_PRESETS as readonly string[]).includes(s)) {
    const n = Number(s)
    return (n <= 20 ? s : '20') as AnswerFontPreset
  }
  if (s === 'small') return '14'
  if (s === 'medium') return '18'
  if (s === 'large') return '20'
  return null
}

/** When a section inherits global body size, cap at 20px (section grid has no 22). */
export function clampFontPresetToSectionMax(preset: AnswerFontPreset): AnswerFontPreset {
  const n = Number(preset)
  if (!Number.isFinite(n)) return preset
  return (n > 20 ? '20' : preset) as AnswerFontPreset
}

/** Nullable DB fields mean «inherit global answer_font_preset». */
export function mergeTypographyWithOrderSection(
  base: BookTypographyInput,
  order: unknown,
  section: 'algy' | 'hat'
): BookTypographyInput {
  const r = (order ?? {}) as Record<string, unknown>
  const raw = section === 'algy' ? r.algy_font_preset : r.hat_font_preset
  const parsed = normalizeSectionFontPreset(raw)
  const fontPreset: AnswerFontPreset = parsed ?? clampFontPresetToSectionMax(base.fontPreset)
  return { ...base, fontPreset }
}

export function mergeTypographyWithCustomPage(
  base: BookTypographyInput,
  cp: { text_font_preset?: string | null } | null | undefined
): BookTypographyInput {
  if (!cp) return base
  const parsed = normalizeSectionFontPreset(cp.text_font_preset)
  const fontPreset: AnswerFontPreset = parsed ?? clampFontPresetToSectionMax(base.fontPreset)
  return { ...base, fontPreset }
}

export type BookBodyLayout = 'question_answer' | 'custom_text' | 'section_body' | 'faktiler_body'

export function bodyRegionMm(layout: BookBodyLayout): { topMm: number; bottomMm: number } {
  if (layout === 'faktiler_body') {
    return { topMm: FAKTILER_BODY_TOP_MM, bottomMm: BOOK_CONTENT_BOTTOM_MM }
  }
  const bottomMm = BOOK_CONTENT_BOTTOM_MM
  switch (layout) {
    case 'question_answer':
      return { topMm: QUESTION_ANSWER_TOP_MM, bottomMm }
    case 'custom_text':
      return { topMm: CUSTOM_TEXT_TOP_MM, bottomMm }
    case 'section_body':
      return { topMm: SECTION_BODY_TOP_MM, bottomMm }
    default:
      return { topMm: QUESTION_ANSWER_TOP_MM, bottomMm }
  }
}
