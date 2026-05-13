'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { Chapter, Order, Question } from '@/lib/types'
import { useEditorStore } from '@/lib/store/editorStore'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'
import { TrialLockedOverlay } from '@/components/editor/TrialLockedOverlay'
import {
  FIXED_CHAPTER_RECT_PALETTE,
  normalizeFixedRectangleColor,
} from '@/lib/utils/fixedChapterRectPalette'
import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'

interface Props {
  uploadFixedChapterPhoto: (chapterId: string, file: File) => void | Promise<void>
  disabled?: boolean
  /**
   * Trial: only chapters whose first question is at/after the trial cutoff get a row lock.
   * Global color strip stays usable for early chapters.
   */
  trialMode?: boolean
  /** Match typography row: start collapsed on desktop */
  defaultCollapsed?: boolean
  /** Nested in `EditorDashboardSettingsDeck`: no outer card toggle. */
  embedded?: boolean
}

function chapterMinFlatQuestionIndex(ch: Chapter, indexById: Map<string, number>): number {
  const qs = ch.questions ?? []
  if (!qs.length) return Number.MAX_SAFE_INTEGER
  let min = Number.MAX_SAFE_INTEGER
  for (const q of qs) {
    const idx = indexById.get(q.id)
    if (typeof idx === 'number') min = Math.min(min, idx)
  }
  return min
}

export function FixedChapterBookSettingsPanel({
  uploadFixedChapterPhoto,
  disabled,
  trialMode = false,
  defaultCollapsed = true,
  embedded = false,
}: Props) {
  const chapters = useEditorStore((s) => s.chapters)
  const chapterFixedPhotos = useEditorStore((s) => s.chapterFixedPhotos)
  const order = useEditorStore((s) => s.order)
  const setOrder = useEditorStore((s) => s.setOrder)

  const [open, setOpen] = useState(!defaultCollapsed)

  const rows = chapters.filter(
    (c) => c.part_kind !== 'faktiler' && !c.is_foreword && !c.is_afterword && c.fixed_phrase_id
  ) as Chapter[]

  const flatQuestions: Question[] = useMemo(
    () => chapters.filter((c) => c.part_kind !== 'faktiler').flatMap((c) => c.questions ?? []),
    [chapters]
  )
  const questionIndexById = useMemo(() => {
    const m = new Map<string, number>()
    flatQuestions.forEach((q, i) => m.set(q.id, i))
    return m
  }, [flatQuestions])

  const currentHex = normalizeFixedRectangleColor((order as Order | null)?.fixed_rectangle_color)

  if (rows.length === 0 || !order) return null

  const paletteAndPhotos = (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          Түстер ({FIXED_CHAPTER_RECT_PALETTE.length})
        </p>
        <p className="mb-3 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
          Барлық тұрақты беттердегі төменгі бөліктің түсі. Бір түс бүкіл кітапқа қолданылады.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {FIXED_CHAPTER_RECT_PALETTE.map((p) => {
            const active = currentHex.toUpperCase() === p.hex.toUpperCase()
            return (
              <button
                key={p.hex}
                type="button"
                disabled={disabled}
                title={p.label}
                onClick={() => {
                  if (disabled) return
                  setOrder({ ...(order as object), fixed_rectangle_color: p.hex } as Order)
                }}
                className={clsx(
                  'relative aspect-square w-full max-w-[52px] rounded-[10px] transition-transform touch-manipulation sm:max-w-none',
                  'ring-2 ring-offset-2 ring-offset-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-[color:var(--accent)]',
                  active ? 'ring-[color:var(--accent)] scale-[1.02]' : 'ring-transparent hover:scale-[1.02]'
                )}
                style={{ backgroundColor: p.hex }}
              >
                <span className="sr-only">{p.label}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] text-[color:var(--text-muted)]">
          Таңдалған:{' '}
          <span className="font-mono font-semibold text-[color:var(--text-secondary)]">{currentHex}</span>
        </p>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 sm:p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          Фото жүктеу
        </p>
        <p className="mb-4 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
          Әр тарау үшін үстіңгі 60% аумаққа бір фото. Мәтін үлгіден келеді, өзгерту мүмкін емес.
        </p>
        <ul className="flex flex-col gap-2.5">
          {rows.map((ch) => {
            const path = chapterFixedPhotos[ch.id] || ''
            const minIdx = chapterMinFlatQuestionIndex(ch, questionIndexById)
            const rowTrialLocked =
              trialMode === true &&
              minIdx !== Number.MAX_SAFE_INTEGER &&
              minIdx >= TRIAL_FREE_QUESTION_COUNT
            return (
              <li
                key={ch.id}
                className={clsx(
                  'relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4'
                )}
              >
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-[13px] font-bold tracking-tight text-[color:var(--text-primary)]">
                    {ch.title_kk}
                  </p>
                  {ch.fixed_phrase_kk ? (
                    <p className="mx-auto mt-1 max-w-[42ch] text-[12px] italic leading-snug text-[color:var(--text-secondary)] sm:mx-0">
                      {ch.fixed_phrase_kk}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-row items-center justify-center gap-3 sm:flex-col sm:justify-center">
                  {path.trim() ? (
                    <SignedBookPhotoImg
                      storageRef={path}
                      alt=""
                      className="size-14 rounded-[10px] object-cover shadow-[var(--shadow-xs)] ring-1 ring-[color:var(--border)]"
                    />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded-[10px] bg-[color:var(--surface)] text-[9px] font-semibold text-[color:var(--text-muted)] ring-1 ring-[color:var(--border)]">
                      Жоқ
                    </div>
                  )}
                  <label className={disabled || rowTrialLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={disabled || rowTrialLocked}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadFixedChapterPhoto(ch.id, f)
                        e.target.value = ''
                      }}
                    />
                    <span className="inline-flex min-h-10 min-w-[88px] items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--text-primary)] px-3 text-[12px] font-semibold text-white shadow-[var(--shadow-xs)] touch-manipulation">
                      {path.trim() ? 'Ауыстыру' : 'Фото қосу'}
                    </span>
                  </label>
                </div>
                {rowTrialLocked ? (
                  <TrialLockedOverlay density="compact" className="rounded-[var(--radius-md)]" />
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )

  const sectionHeading = (
    <>
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        Тұрақты тарау беттері
      </span>
      <p className="mt-0.5 text-[12px] font-medium leading-snug text-[color:var(--text-secondary)]">
        Түс пен фото — атау бетінен кейінгі толық бет
      </p>
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-1">
        <div className="pb-1">{sectionHeading}</div>
        {paletteAndPhotos}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-xs)]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-black/[0.02] disabled:opacity-60 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
      >
        <div className="min-w-0">{sectionHeading}</div>
        <span className="shrink-0 text-[11px] font-semibold text-[color:var(--accent)] sm:text-right">
          {open ? 'Жасыру' : 'Көрсету'}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-4 sm:px-4">
          {paletteAndPhotos}
        </div>
      ) : null}
    </div>
  )
}
