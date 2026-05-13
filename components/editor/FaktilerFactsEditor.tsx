'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { IconCamera } from '@/components/ui/icons'
import { useEditorStore } from '@/lib/store/editorStore'
import { normalizeAnswerToHtml, sanitizeAnswerHtmlFragment } from '@/lib/utils/answerHtml'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'
import { TrialLockedOverlay } from '@/components/editor/TrialLockedOverlay'
import { spreadIndexForPreviewTarget } from '@/lib/utils/previewNavigation'
import type { PreviewPage } from '@/components/editor/BookPagePreview'
import { answerPresetToUiPx } from '@/lib/bookLayout'
import type { AnswerFontPreset } from '@/lib/bookLayout'

const AnswerRichTextEditor = dynamic(
  () => import('@/components/editor/AnswerRichTextEditor').then((m) => m.AnswerRichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[200px] animate-pulse rounded-[10px] bg-[color:var(--surface-subtle)]" /> }
)

type Props = {
  disabled: boolean
  orderId: string
  previewPages: PreviewPage[]
  onUploadFaktilerPhoto: (slotIndex: number, file: File) => void | Promise<void>
  /** Staff editor enables the same AI affordances as other staff fields. */
  variant?: 'client' | 'staff'
  /** When `variant` is `client`, set true if admin/manager enabled AI for this order. */
  clientAiEnabled?: boolean
  /** Staff editor: cannot change fact photos (upload/remove). */
  photosLocked?: boolean
  /** Trial book: lock фактілер editor. */
  trialLocked?: boolean
}

export function FaktilerFactsEditor({
  disabled,
  orderId,
  previewPages,
  onUploadFaktilerPhoto,
  variant = 'client',
  clientAiEnabled = false,
  photosLocked = false,
  trialLocked = false,
}: Props) {
  const faktiler_facts = useEditorStore((s) => s.faktiler_facts)
  const faktiler_example_facts = useEditorStore((s) => s.faktiler_example_facts)
  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const updateFaktilerFact = useEditorStore((s) => s.updateFaktilerFact)
  const addFaktilerFactSlot = useEditorStore((s) => s.addFaktilerFactSlot)
  const removeFaktilerFactAt = useEditorStore((s) => s.removeFaktilerFactAt)
  const setSpreadIndex = useEditorStore((s) => s.setSpreadIndex)

  const aiSource = variant === 'staff' ? 'algy' : 'algy'
  const aiEnabled = variant === 'staff' ? true : clientAiEnabled
  const factPhotoLocked = !!(disabled || photosLocked)

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-col">
      {faktiler_example_facts?.trim() ? (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
            Мысалдар
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
            {faktiler_example_facts
              .split(/\n+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-8">
        {faktiler_facts.map((slot, index) => (
          <div
            key={slot.id}
            className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-xs)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Факт {index + 1}
              </span>
              {!disabled && !photosLocked && faktiler_facts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeFaktilerFactAt(index)}
                  className="text-[12px] font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                >
                  Жою
                </button>
              ) : null}
            </div>
            {disabled ? (
              <div className="space-y-4">
                <div
                  className="book-rich-root font-preview-book rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 text-center text-[color:var(--text-secondary)]"
                  dangerouslySetInnerHTML={{
                    __html:
                      sanitizeAnswerHtmlFragment(normalizeAnswerToHtml(slot.text)) ||
                      '<p style="opacity:0.5;margin:0">—</p>',
                  }}
                />
                {slot.photo_path ? (
                  <SignedBookPhotoImg
                    storageRef={slot.photo_path}
                    alt=""
                    className="mx-auto max-h-72 w-full max-w-md rounded-[var(--radius-md)] object-contain"
                  />
                ) : null}
              </div>
            ) : (
              <>
                <AnswerRichTextEditor
                  key={slot.id}
                  valueHtml={normalizeAnswerToHtml(slot.text)}
                  onChangeHtml={(h) => updateFaktilerFact(index, { text: h })}
                  placeholder="Ол туралы қызықты факт жазыңыз"
                  textAlign="center"
                  fontSizePx={answerPresetToUiPx(answerFontPreset as AnswerFontPreset)}
                  minHeightPx={200}
                  onNavigatePreview={() =>
                    setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'faktiler' }))
                  }
                  aiEnabled={aiEnabled}
                  aiSource={aiSource}
                  aiOrderId={orderId}
                  aiBlockKey={`fak:${slot.id}`}
                />
                <div className="mt-4">
                  <p className="mb-1 text-[13px] font-semibold text-[color:var(--text-primary)]">
                    Толық бет фотосы
                  </p>
                  {slot.photo_path ? (
                    <div className="relative inline-block max-w-full">
                      <SignedBookPhotoImg
                        storageRef={slot.photo_path}
                        alt=""
                        className="max-h-72 rounded-[var(--radius-md)] object-contain"
                      />
                      {!factPhotoLocked ? (
                        <button
                          type="button"
                          onClick={() => updateFaktilerFact(index, { photo_path: '' })}
                          className="absolute right-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-white"
                        >
                          Жою
                        </button>
                      ) : null}
                    </div>
                  ) : factPhotoLocked ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-6 py-10">
                      <span className="text-[13px] font-medium text-[color:var(--text-muted)]">Фото жоқ (тек оқу)</span>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-6 py-10">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          if (f) void onUploadFaktilerPhoto(index, f)
                        }}
                      />
                      <IconCamera className="size-8 text-[color:var(--text-muted)]" />
                      <span className="text-[13px] font-medium text-[color:var(--text-secondary)]">
                        Суретті осы жерге сүйреңіз немесе басыңыз
                      </span>
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {!disabled && !photosLocked ? (
        <Button type="button" variant="secondary" className="mt-2 self-start" onClick={() => addFaktilerFactSlot()}>
          + Факт қосу
        </Button>
      ) : null}
      {trialLocked ? <TrialLockedOverlay className="rounded-[var(--radius-xl)]" /> : null}
    </div>
  )
}
