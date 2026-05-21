'use client'

import { useMemo } from 'react'
import { useEditorStore } from '@/lib/store/editorStore'
import { buildPreviewPages } from '@/lib/utils/buildPreviewPages'

/**
 * Single source for preview page list — same inputs as the editor chrome + preview rail.
 */
export function usePreviewPages() {
  const order = useEditorStore((s) => s.order)
  const chapters = useEditorStore((s) => s.chapters)
  const answers = useEditorStore((s) => s.answers)
  const customPages = useEditorStore((s) => s.customPages)
  const algy_soz = useEditorStore((s) => s.algy_soz)
  const hat_text = useEditorStore((s) => s.hat_text)
  const faktiler_facts = useEditorStore((s) => s.faktiler_facts)
  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const answerTextAlign = useEditorStore((s) => s.answerTextAlign)
  const algyFontPresetOverride = useEditorStore((s) => s.algyFontPresetOverride)
  const hatFontPresetOverride = useEditorStore((s) => s.hatFontPresetOverride)
  const chapterFixedPhotos = useEditorStore((s) => s.chapterFixedPhotos)
  const chapterFixedPhraseOverrides = useEditorStore((s) => s.chapterFixedPhraseOverrides)
  const editorSkippedChapterIds = useEditorStore((s) => s.editorSkippedChapterIds)
  const coverTitleFontPreset = useEditorStore((s) => s.coverTitleFontPreset)

  return useMemo(() => {
    const mergedOrder =
      order &&
      ({
        ...(order as object),
        algy_font_preset: algyFontPresetOverride,
        hat_font_preset: hatFontPresetOverride,
      } as typeof order)
    return buildPreviewPages({
      order: mergedOrder,
      chapters,
      answers,
      customPages,
      algy_soz,
      hat_text,
      faktiler_facts,
      typography: { fontPreset: answerFontPreset, textAlign: answerTextAlign },
      chapterFixedPhotos,
      chapterFixedPhraseOverrides,
      editorSkippedChapterIds,
      coverTitleFontPreset,
    })
  }, [
    order,
    chapters,
    answers,
    customPages,
    algy_soz,
    hat_text,
    faktiler_facts,
    answerFontPreset,
    answerTextAlign,
    algyFontPresetOverride,
    hatFontPresetOverride,
    chapterFixedPhotos,
    chapterFixedPhraseOverrides,
    editorSkippedChapterIds,
    coverTitleFontPreset,
  ])
}
