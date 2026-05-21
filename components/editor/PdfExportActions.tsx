'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

import { runClientBookPdfExport } from '@/lib/client/runClientBookPdfExport'
import { createClient } from '@/lib/supabase/client'
import type { Chapter, CustomPage } from '@/lib/types'
import type { ExportOrderInput, PdfClientPhotoMode } from '@/lib/utils/pdfExport'
import {
  PDF_EXPORT_JPEG_LABEL,
  PDF_EXPORT_PNG_LABEL,
} from '@/lib/utils/pdfExport'
import type { BookTypography } from '@/lib/utils/buildPreviewPages'
import { normalizeCoverTitleFontPreset } from '@/lib/bookLayout'
import { useEditorStore } from '@/lib/store/editorStore'

type PdfExportActionsProps = {
  order: ExportOrderInput
  chapters: Chapter[]
  answers: Record<string, string>
  customPages: CustomPage[]
  chapterFixedPhotos?: Record<string, string>
  chapterFixedPhraseOverrides?: Record<string, string>
  editorSkippedChapterIds?: string[]
  coverTitleFontPreset?: import('@/lib/bookLayout').CoverTitleFontPreset
  typography?: BookTypography | null
  extras?: {
    algy_soz?: string
    hat_text?: string
    faktiler_facts?: unknown
  }
  /** Compact row for admin table; default false for editor bar. */
  compact?: boolean
  /** Persist editor state (e.g. cover title mm) before building the PDF. */
  beforeExport?: () => Promise<boolean | void>
}

export function PdfExportActions({
  order,
  chapters,
  answers,
  customPages,
  chapterFixedPhotos,
  chapterFixedPhraseOverrides,
  editorSkippedChapterIds,
  coverTitleFontPreset,
  typography,
  extras,
  compact = false,
  beforeExport,
}: PdfExportActionsProps) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  async function enrichColophon(base: ExportOrderInput): Promise<ExportOrderInput> {
    if (base.pdf_colophon_template_kk?.trim()) return base
    const catId = base.category_id
    if (!catId) return base
    const supabase = createClient()
    const { data } = await supabase
      .from('categories')
      .select('pdf_colophon_template_kk')
      .eq('id', catId)
      .maybeSingle()
    return {
      ...base,
      pdf_colophon_template_kk:
        (data as { pdf_colophon_template_kk?: string | null } | null)?.pdf_colophon_template_kk ?? null,
    }
  }

  async function handleExport(photoMode: PdfClientPhotoMode) {
    if (exporting) return
    setExporting(true)
    setProgress({ current: 0, total: 0 })
    try {
      if (beforeExport) {
        await beforeExport()
      }
      const liveCoverPreset = normalizeCoverTitleFontPreset(
        coverTitleFontPreset ?? useEditorStore.getState().coverTitleFontPreset,
      )
      const pdfOrder = await enrichColophon({
        ...order,
        algy_soz: extras?.algy_soz ?? order.algy_soz,
        hat_text: extras?.hat_text ?? order.hat_text,
        faktiler_facts: extras?.faktiler_facts ?? order.faktiler_facts,
        cover_title_font_preset: liveCoverPreset,
      })
      await runClientBookPdfExport({
        order: pdfOrder,
        chapters,
        answers,
        customPages,
        chapterFixedPhotos,
        chapterFixedPhraseOverrides,
        editorSkippedChapterIds,
        coverTitleFontPreset: liveCoverPreset,
        typography,
        photoMode,
        onProgress: (current, total) => setProgress({ current, total }),
      })
    } catch (error) {
      console.error('[PDF Export]', error)
      const message = error instanceof Error ? error.message : 'PDF export failed'
      window.alert(message)
    } finally {
      setExporting(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const progressLabel =
    exporting && progress.total > 0 ? `${progress.current}/${progress.total}` : exporting ? '…' : null

  const btnCls = compact
    ? 'rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-left text-[10px] font-medium leading-tight text-[color:var(--text-primary)] hover:bg-[color:var(--surface-subtle)] disabled:opacity-50 max-w-[200px]'
    : 'rounded-lg border border-[#333] bg-[#0F0F0F] px-3 py-2 text-left text-[11px] font-medium leading-snug text-white hover:bg-[#222] disabled:opacity-50 max-w-[280px]'

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', compact && 'gap-1.5')} role="group" aria-label="PDF экспорт">
      <button
        type="button"
        className={btnCls}
        disabled={exporting}
        title={PDF_EXPORT_PNG_LABEL}
        onClick={() => void handleExport('png')}
      >
        {progressLabel ?? PDF_EXPORT_PNG_LABEL}
      </button>
      <button
        type="button"
        className={btnCls}
        disabled={exporting}
        title={PDF_EXPORT_JPEG_LABEL}
        onClick={() => void handleExport('jpeg')}
      >
        {exporting ? progressLabel : PDF_EXPORT_JPEG_LABEL}
      </button>
    </div>
  )
}
