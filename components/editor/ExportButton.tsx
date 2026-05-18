'use client'

import { PdfExportActions } from '@/components/editor/PdfExportActions'
import { useEditorStore } from '@/lib/store/editorStore'
import { normalizeBookTypographyFromOrder } from '@/lib/utils/buildPreviewPages'
import type { ExportOrderInput } from '@/lib/utils/pdfExport'

export function ExportButton() {
  const order = useEditorStore((s) => s.order)
  const chapters = useEditorStore((s) => s.chapters)
  const answers = useEditorStore((s) => s.answers)
  const customPages = useEditorStore((s) => s.customPages)
  const chapterFixedPhotos = useEditorStore((s) => s.chapterFixedPhotos)
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
      typography={normalizeBookTypographyFromOrder(order as ExportOrderInput)}
      extras={{ algy_soz, hat_text, faktiler_facts }}
    />
  )
}
