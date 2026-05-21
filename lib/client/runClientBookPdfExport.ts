'use client'

import type { Chapter, CustomPage } from '@/lib/types'
import {
  normalizeCoverTitleFontPreset,
  type CoverTitleFontPreset,
} from '@/lib/bookLayout'
import type { BookTypography } from '@/lib/utils/buildPreviewPages'
import { exportBookToPDF, type ExportOrderInput, type PdfClientPhotoMode } from '@/lib/utils/pdfExport'
import { useEditorStore } from '@/lib/store/editorStore'

export type RunClientBookPdfExportParams = {
  order: ExportOrderInput
  chapters: Chapter[]
  answers: Record<string, string>
  customPages: CustomPage[]
  chapterFixedPhotos?: Record<string, string>
  chapterFixedPhraseOverrides?: Record<string, string>
  editorSkippedChapterIds?: string[]
  coverTitleFontPreset?: CoverTitleFontPreset
  typography?: BookTypography | null
  photoMode: PdfClientPhotoMode
  onProgress?: (current: number, total: number) => void
}

function resolveCoverPresetForExport(
  order: ExportOrderInput,
  presetArg?: CoverTitleFontPreset,
): CoverTitleFontPreset {
  const fromStore =
    typeof window !== 'undefined' ? useEditorStore.getState().coverTitleFontPreset : undefined
  const fromOrder = (order as { cover_title_font_preset?: unknown }).cover_title_font_preset
  return normalizeCoverTitleFontPreset(presetArg ?? fromStore ?? fromOrder)
}

/** Stable in-browser PDF export (same layout engine as editor preview). */
export async function runClientBookPdfExport(params: RunClientBookPdfExportParams): Promise<void> {
  const {
    order,
    chapters,
    answers,
    customPages,
    chapterFixedPhotos,
    chapterFixedPhraseOverrides,
    editorSkippedChapterIds,
    coverTitleFontPreset: coverTitleFontPresetArg,
    typography,
    photoMode,
    onProgress,
  } = params

  const coverTitleFontPreset = resolveCoverPresetForExport(order, coverTitleFontPresetArg)
  const orderForExport = {
    ...(order as object),
    cover_title_font_preset: coverTitleFontPreset,
  } as ExportOrderInput

  await exportBookToPDF(
    orderForExport,
    chapters,
    answers,
    customPages,
    onProgress,
    typography ?? null,
    chapterFixedPhotos,
    chapterFixedPhraseOverrides,
    editorSkippedChapterIds,
    coverTitleFontPreset,
    photoMode,
  )
}
