import type { PreviewPage } from '@/components/editor/BookPagePreview'
import type { Answers, Chapter, CustomPage, FaktilerFactSlot, Question } from '@/lib/types'
import { faktilerSlotHasContent, parseFaktilerFactsPayload } from '@/lib/utils/faktilerFacts'
import {
  mergeTypographyWithCustomPage,
  mergeTypographyWithOrderSection,
  normalizeGlobalFontPreset,
  type AnswerFontPreset,
  type AnswerTextAlign,
  type BookTypographyInput,
} from '@/lib/bookLayout'
import { paginateBookBody, paginateQuestionAnswer } from '@/lib/utils/paginateBookAnswer'
import { answerTextIsEffectivelyEmpty } from '@/lib/utils/answerHtml'
import { answerDisplaysAsPhotoContent } from '@/lib/utils/bookPhotoUrl'
import { normalizeFixedRectangleColor } from '@/lib/utils/fixedChapterRectPalette'

/** DB orders carry fields beyond the typed `Order` interface; keep `unknown` for compatibility. */
export type PreviewOrderInput = unknown | null

export type BookTypography = BookTypographyInput

export function normalizeBookTypographyFromOrder(order: PreviewOrderInput): BookTypography {
  const r = (order ?? {}) as Record<string, unknown>
  const fontPreset = normalizeGlobalFontPreset(r.answer_font_preset)
  const rawAlign = String(r.answer_text_align ?? 'left').trim().toLowerCase()
  const textAlign: AnswerTextAlign = rawAlign === 'left' ? 'left' : 'justify'
  return { fontPreset, textAlign }
}

export interface BuildPreviewPagesParams {
  order: PreviewOrderInput
  chapters: Chapter[]
  answers: Answers
  customPages: CustomPage[]
  algy_soz: string
  hat_text: string
  /** Editor live state; when omitted, parsed from `order.faktiler_facts` and legacy columns. */
  faktiler_facts?: FaktilerFactSlot[]
  /** When omitted, read from `order.answer_font_preset` / `answer_text_align` or defaults. */
  typography?: BookTypography
  /** Per-chapter user photo for fixed pages (`chapter_id` → storage/public URL). */
  chapterFixedPhotos?: Record<string, string>
}

/** Slot `[low, high)` for custom pages inserted after question `questionFlatIndex` (matches preview/editor bands). */
export function getQuestionSlotBounds(questionFlatIndex: number, flatLength: number) {
  const nextFlatIdx = questionFlatIndex + 1 < flatLength ? questionFlatIndex + 1 : 9999
  return {
    low: questionFlatIndex * 100 + 50,
    high: nextFlatIdx * 100 + 50,
  }
}

/**
 * Next monotonic `sort_order` inside the slot for `questionFlatIndex`.
 */
export function nextCustomPageSortOrder(
  customPages: CustomPage[],
  questionFlatIndex: number,
  flatLength: number
): number {
  const { low, high } = getQuestionSlotBounds(questionFlatIndex, flatLength)
  const inSlot = customPages.filter((cp) => cp.sort_order >= low && cp.sort_order < high)
  let max = low - 1
  for (const cp of inSlot) max = Math.max(max, cp.sort_order)
  const candidate = max + 1
  if (candidate >= high) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[custom_pages] sort_order slot nearly full; clamping', { questionFlatIndex, low, high })
    }
    return Math.max(low, high - 1)
  }
  return candidate
}

/** Custom pages attached after this question (by `sort_order` band). Sorted ascending so UI matches preview/PDF. */
export function getCustomPagesInQuestionSlot(
  questionId: string,
  flatQuestions: Question[],
  indexById: Map<string, number>,
  customPages: CustomPage[]
): CustomPage[] {
  const qIdx = indexById.get(questionId)
  if (qIdx === undefined) return []
  const { low, high } = getQuestionSlotBounds(qIdx, flatQuestions.length)
  return customPages
    .filter((cp) => cp.sort_order >= low && cp.sort_order < high)
    .sort((a, b) => a.sort_order - b.sort_order)
}

function filledCustomPagesInQuestionSlot(
  questionId: string,
  flatQuestions: Question[],
  indexById: Map<string, number>,
  customPages: CustomPage[]
): CustomPage[] {
  return getCustomPagesInQuestionSlot(questionId, flatQuestions, indexById, customPages).filter(
    (cp) => !!(cp.photo_path || cp.text_content)
  )
}

function isPhotoAnswer(answer: string): boolean {
  return answerDisplaysAsPhotoContent(answer)
}

function poemStanzaForPagination(cp: { page_type: string; poem_stanza_lines?: number | null }): number | undefined {
  if (cp.page_type !== 'custom_poem') return undefined
  const n = typeof cp.poem_stanza_lines === 'number' ? cp.poem_stanza_lines : Number(cp.poem_stanza_lines)
  if (!Number.isFinite(n)) return 4
  return Math.min(8, Math.max(4, Math.round(n)))
}

function expandPagesForTypography(
  spine: PreviewPage[],
  typo: BookTypography,
  order: PreviewOrderInput
): PreviewPage[] {
  const out: PreviewPage[] = []

  for (const p of spine) {
    if (p.type === 'contents') {
      out.push(p)
      continue
    }

    if (p.type === 'question') {
      const ans = p.answer || ''
      if (isPhotoAnswer(ans)) {
        out.push(p)
        continue
      }
      const chunks = paginateQuestionAnswer(ans, typo)
      chunks.forEach((chunk, i) =>
        out.push({
          type: 'question',
          data: p.data,
          answer: chunk,
          showQuestionHeader: i === 0,
        })
      )
      continue
    }

    if (p.type === 'algy_soz') {
      const t = mergeTypographyWithOrderSection(typo, order, 'algy')
      const chunks = paginateBookBody(p.text || '', t, 'section_body')
      chunks.forEach((chunk, i) =>
        out.push({
          type: 'algy_soz',
          text: chunk,
          showSectionTitle: i === 0,
        })
      )
      continue
    }

    if (p.type === 'hat') {
      const raw = p.text?.trim() ?? ''
      if (!raw) continue
      const t = mergeTypographyWithOrderSection(typo, order, 'hat')
      const chunks = paginateBookBody(raw, t, 'section_body')
      chunks.forEach((chunk, i) =>
        out.push({
          type: 'hat',
          text: chunk,
          showSectionTitle: i === 0,
        })
      )
      continue
    }

    if (p.type === 'faktiler_text') {
      const raw = (p.text || '').trim()
      if (!raw) {
        out.push({
          type: 'faktiler_text',
          text: '',
          faktilerTextContinuation: !!p.faktilerTextContinuation,
        })
        continue
      }
      const chunks = paginateBookBody(raw, typo, 'faktiler_body')
      chunks.forEach((chunk, i) =>
        out.push({
          type: 'faktiler_text',
          text: chunk,
          faktilerTextContinuation: i > 0 || !!p.faktilerTextContinuation,
        })
      )
      continue
    }

    if (p.type === 'fixed_chapter') {
      out.push(p)
      continue
    }

    if (p.type === 'custom') {
      const ans = p.answer || ''
      if (!isPhotoAnswer(ans) && !answerTextIsEffectivelyEmpty(ans)) {
        const t = mergeTypographyWithCustomPage(typo, p.data)
        const chunks = paginateBookBody(ans, t, 'custom_text', poemStanzaForPagination(p.data))
        chunks.forEach((chunk, i) =>
          out.push({
            type: 'custom',
            data: p.data,
            answer: chunk,
            customTextContinuation: i > 0,
          })
        )
      } else {
        out.push(p)
      }
      continue
    }

    out.push(p)
  }

  return out
}

/** TOC points at the first body page after the chapter divider (question/custom), not the divider itself. */
function tocPageNumAfterChapterBreak(expanded: PreviewPage[], chapterBreakIdx: number): number {
  for (let i = chapterBreakIdx + 1; i < expanded.length; i++) {
    const p = expanded[i]
    if (p.type === 'chapter_break') break
    if (p.type === 'question' || p.type === 'custom' || p.type === 'faktiler_text' || p.type === 'fixed_chapter')
      return i + 1
  }
  return chapterBreakIdx + 2
}

function patchContentsPageNums(expanded: PreviewPage[], contentsIdx: number) {
  if (contentsIdx < 0 || contentsIdx >= expanded.length) return
  if (expanded[contentsIdx]?.type !== 'contents') return

  const chaptersMeta: Array<{ title: string; pageNum: number; chapterNum: number }> = []
  expanded.forEach((page, i) => {
    if (page.type === 'chapter_break') {
      chaptersMeta.push({
        title: page.title,
        pageNum: tocPageNumAfterChapterBreak(expanded, i),
        chapterNum: page.chapterNum,
      })
    }
  })

  const faktilerDividerIdx = expanded.findIndex((pg) => pg.type === 'faktiler_divider')
  const faktilerPageNum = faktilerDividerIdx >= 0 ? faktilerDividerIdx + 1 : undefined

  const hatIdx = expanded.findIndex((pg) => pg.type === 'hat')
  const hatPageNum = hatIdx >= 0 ? hatIdx + 1 : undefined

  expanded[contentsIdx] = {
    type: 'contents',
    chapters: chaptersMeta,
    faktilerPageNum,
    hatPageNum,
  }
}

/**
 * Builds the ordered list of book preview pages (cover, chapters, Q&A, custom inserts, hat).
 * Question bodies may span multiple pages; TOC entries reflect post-pagination indices.
 */
export function buildPreviewPages({
  order,
  chapters,
  answers,
  customPages,
  algy_soz,
  hat_text,
  faktiler_facts: faktilerFactsArg,
  typography: typographyArg,
  chapterFixedPhotos: chapterFixedPhotosArg,
}: BuildPreviewPagesParams): PreviewPage[] {
  if (order == null) return []

  const typo =
    typographyArg ?? normalizeBookTypographyFromOrder(order)

  const o = order as Record<string, unknown>
  const chapterFixedPhotos = chapterFixedPhotosArg ?? {}
  const fixedRectColor = normalizeFixedRectangleColor(String(o.fixed_rectangle_color ?? ''))
  const mergedFaktilerFacts =
    faktilerFactsArg ??
    parseFaktilerFactsPayload(o.faktiler_facts, String(o.faktiler_text ?? ''), String(o.faktiler_photo_path ?? ''))

  const spine: PreviewPage[] = []

  spine.push({
    type: 'cover',
    bookTitle: String(o.book_title ?? ''),
    authorName: String(o.author_name ?? ''),
  })

  if (algy_soz?.trim()) {
    spine.push({ type: 'algy_soz', text: algy_soz, showSectionTitle: true })
  }

  spine.push({ type: 'contents', chapters: [], hatPageNum: undefined })

  const chaptersSorted = [...chapters].sort((a, b) => a.sort_order - b.sort_order)
  const flatQuestions = chaptersSorted
    .filter((c) => c.part_kind !== 'faktiler')
    .flatMap((c) => c.questions ?? [])
  const questionIndexById = new Map<string, number>()
  flatQuestions.forEach((q, i) => questionIndexById.set(q.id, i))

  const faktilerChapter = chaptersSorted.find((c) => c.part_kind === 'faktiler')
  const hasFaktilerChapter = !!faktilerChapter

  let chapterNum = 0
  for (const chapter of chaptersSorted) {
    if (chapter.part_kind === 'faktiler') continue

    const chapterQuestions = chapter.questions ?? []
    const answeredInChapter = chapterQuestions.filter((q) => !answerTextIsEffectivelyEmpty(answers[q.id] ?? ''))
    const chapterHasCustom = chapterQuestions.some(
      (q) =>
        filledCustomPagesInQuestionSlot(q.id, flatQuestions, questionIndexById, customPages).length > 0
    )
    const fixedPhrase = (chapter.fixed_phrase_kk || '').trim()
    const chapterHasFixedSlot = !!(chapter.fixed_phrase_id && fixedPhrase)
    if (answeredInChapter.length === 0 && !chapterHasCustom && !chapterHasFixedSlot) continue

    chapterNum++
    const chapterFlatIndices = chapterQuestions
      .map((q) => questionIndexById.get(q.id))
      .filter((n): n is number => n !== undefined)
    const minFlatQuestionIndex =
      chapterFlatIndices.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...chapterFlatIndices)

    spine.push({
      type: 'chapter_break',
      title: chapter.title_kk,
      chapterNum,
      minFlatQuestionIndex,
    })

    if (chapterHasFixedSlot) {
      spine.push({
        type: 'fixed_chapter',
        chapterId: chapter.id,
        phrase: fixedPhrase,
        photoPath: chapterFixedPhotos[chapter.id] || '',
        rectColor: fixedRectColor,
        minFlatQuestionIndex,
      })
    }

    for (const q of chapterQuestions) {
      if (!answerTextIsEffectivelyEmpty(answers[q.id] ?? '')) {
        spine.push({
          type: 'question',
          data: q,
          answer: answers[q.id] ?? '',
          showQuestionHeader: true,
        })
      }
      const attached = filledCustomPagesInQuestionSlot(q.id, flatQuestions, questionIndexById, customPages)
      attached.forEach((cp) =>
        spine.push({
          type: 'custom',
          data: cp,
          answer: cp.photo_path || cp.text_content || '',
        })
      )
    }
  }

  if (hasFaktilerChapter) {
    const sectionTitle = (faktilerChapter!.title_kk || '').trim() || 'Фактілер'
    const activeFacts = mergedFaktilerFacts.filter(faktilerSlotHasContent)
    if (activeFacts.length > 0) {
      spine.push({ type: 'faktiler_divider', title: sectionTitle, chapterNum: chapterNum + 1 })
      activeFacts.forEach((f) => {
        spine.push({
          type: 'faktiler_text',
          text: f.text,
          faktilerTextContinuation: false,
        })
        spine.push({ type: 'faktiler_photo', photoUrl: f.photo_path || '' })
      })
    }
  }

  const hatTrimmed = hat_text?.trim()
  if (hatTrimmed) {
    spine.push({
      type: 'hat',
      text: hatTrimmed,
      showSectionTitle: true,
    })
  }

  const expanded = expandPagesForTypography(spine, typo, order)
  const contentsIdxResolved = expanded.findIndex((p) => p.type === 'contents')
  patchContentsPageNums(expanded, contentsIdxResolved)

  return expanded
}