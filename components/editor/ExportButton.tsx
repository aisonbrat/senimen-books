'use client'

import { PdfExportActions } from '@/components/editor/PdfExportActions'
import { useEditorStore } from '@/lib/store/editorStore'
import { normalizeBookTypographyFromOrder } from '@/lib/utils/buildPreviewPages'
import type { ExportOrderInput } from '@/lib/utils/pdfExport'

type Props = {
  /** Saves typography / cover settings before export so PDF matches preview. */
  beforeExport?: () => Promise<boolean | void>
}

export function ExportButton({ beforeExport }: Props = {}) {
  const order = useEditorStore((s) => s.order)
  const chapters = useEditorStore((s) => s.chapters)
  const answers = useEditorStore((s) => s.answers)
  const customPages = useEditorStore((s) => s.customPages)
  const chapterFixedPhotos = useEditorStore((s) => s.chapterFixedPhotos)
  const chapterFixedPhraseOverrides = useEditorStore((s) => s.chapterFixedPhraseOverrides)
  const editorSkippedChapterIds = useEditorStore((s) => s.editorSkippedChapterIds)
  const coverTitleFontPreset = useEditorStore((s) => s.coverTitleFontPreset)
  const algy_soz = useEditorStore((s) => s.algy_soz)
  const hat_text = useEditorStore((s) => s.hat_text)
  const faktiler_facts = useEditorStore((s) => s.faktiler_facts)

  if (!order) return null

  return (
    <PdfExportActions
      order={order as ExportOrderInput}
      chapters={chapters}
      answers={answers}
      customPages={customPages}
      chapterFixedPhotos={chapterFixedPhotos}
      chapterFixedPhraseOverrides={chapterFixedPhraseOverrides}
      editorSkippedChapterIds={editorSkippedChapterIds}
      coverTitleFontPreset={coverTitleFontPreset}
      typography={normalizeBookTypographyFromOrder(order as ExportOrderInput)}
      extras={{ algy_soz, hat_text, faktiler_facts }}
      beforeExport={beforeExport}
    />
  )
}
