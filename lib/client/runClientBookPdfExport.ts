'use client'

import type { Chapter, CustomPage } from '@/lib/types'
import type { BookTypography } from '@/lib/utils/buildPreviewPages'
import { exportBookToPDF, type ExportOrderInput, type PdfClientPhotoMode } from '@/lib/utils/pdfExport'

export type RunClientBookPdfExportParams = {
  order: ExportOrderInput
  chapters: Chapter[]
  answers: Record<string, string>
  customPages: CustomPage[]
  chapterFixedPhotos?: Record<string, string>
  typography?: BookTypography | null
  photoMode: PdfClientPhotoMode
  onProgress?: (current: number, total: number) => void
}

/** Stable in-browser PDF export (same layout engine as editor preview). */
export async function runClientBookPdfExport(params: RunClientBookPdfExportParams): Promise<void> {
  const {
    order,
    chapters,
    answers,
    customPages,
    chapterFixedPhotos,
    typography,
    photoMode,
    onProgress,
  } = params

  await exportBookToPDF(
    order,
    chapters,
    answers,
    customPages,
    onProgress,
    typography ?? null,
    chapterFixedPhotos,
    photoMode,
  )
}
