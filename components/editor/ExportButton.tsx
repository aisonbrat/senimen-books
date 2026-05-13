'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEditorStore } from '@/lib/store/editorStore'
import { exportBookToPDF, type ExportOrderInput } from '@/lib/utils/pdfExport'

export function ExportButton() {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const order = useEditorStore((s) => s.order)
  const chapters = useEditorStore((s) => s.chapters)
  const answers = useEditorStore((s) => s.answers)
  const customPages = useEditorStore((s) => s.customPages)
  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const answerTextAlign = useEditorStore((s) => s.answerTextAlign)
  const algy_soz = useEditorStore((s) => s.algy_soz)
  const hat_text = useEditorStore((s) => s.hat_text)
  const faktiler_facts = useEditorStore((s) => s.faktiler_facts)
  const chapterFixedPhotos = useEditorStore((s) => s.chapterFixedPhotos)

  async function handleExport() {
    if (!order || exporting) return
    setExporting(true)
    setProgress({ current: 0, total: 0 })
    try {
      const supabase = createClient()
      let pdf_colophon_template_kk: string | null = null
      const catId = order.category_id
      if (catId) {
        const { data } = await supabase
          .from('categories')
          .select('pdf_colophon_template_kk')
          .eq('id', catId)
          .maybeSingle()
        pdf_colophon_template_kk = (data as { pdf_colophon_template_kk?: string | null } | null)?.pdf_colophon_template_kk ?? null
      }

      await exportBookToPDF(
        {
          ...(order as ExportOrderInput),
          algy_soz,
          hat_text,
          faktiler_facts,
          pdf_colophon_template_kk,
        },
        chapters,
        answers,
        customPages,
        (current, total) => setProgress({ current, total }),
        { fontPreset: answerFontPreset, textAlign: answerTextAlign },
        chapterFixedPhotos
      )
    } finally {
      setExporting(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      style={{
        background: exporting ? '#555' : '#0F0F0F',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 12,
        fontWeight: 500,
        cursor: exporting ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.2s',
      }}
    >
      {exporting ? (
        <>{progress.total > 0 ? `${progress.current}/${progress.total} бет...` : '…'}</>
      ) : (
        <>PDF жүктеу</>
      )}
    </button>
  )
}
