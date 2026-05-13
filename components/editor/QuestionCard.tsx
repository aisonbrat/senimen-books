'use client'
import { memo, useMemo, useState, useEffect, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import { clsx } from 'clsx'
import { useEditorStore } from '@/lib/store/editorStore'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { IconCamera, IconX } from '@/components/ui/icons'
import type { Question } from '@/lib/types'
import { answerPresetToUiPx } from '@/lib/bookLayout'
import {
  answerPlainTextPreview,
  answerTextIsEffectivelyEmpty,
  normalizeAnswerToHtml,
} from '@/lib/utils/answerHtml'
import { STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'
import { compressForStorage } from '@/lib/utils/imageCompression'
import { showStorageUploadAlert } from '@/lib/utils/storageUploadErrorAlert'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'
import {
  answerDisplaysAsPhotoContent,
  splitPhotoAnswerRawSegments,
  splitPhotoAnswerToResolvedUrls,
} from '@/lib/utils/bookPhotoUrl'
import { TrialLockedOverlay } from '@/components/editor/TrialLockedOverlay'

const AnswerRichTextEditor = dynamic(
  () => import('@/components/editor/AnswerRichTextEditor').then((m) => m.AnswerRichTextEditor),
  {
    ssr: false,
    loading: () => <Skeleton height={160} className="rounded-[var(--radius-md)]" />,
  }
)

interface QuestionCardProps {
  question: Question
  orderId: string
  disabled?: boolean
  /** When true (e.g. client read-only or staff text-only mode), photo answers cannot be changed or removed. */
  photosReadOnly?: boolean
  /** Jump book preview to this answer page (desktop/mobile spread index). */
  onPreviewNavigate?: () => void
  /** Editor-only: shows the "Әрлеу" Gemini polish button inside the toolbar. */
  aiEnabled?: boolean
  /** Trial book: question beyond free tier — blur and block edits. */
  trialLocked?: boolean
  /** Optional wrapper classes (e.g. Bento hero emphasis) without changing card logic. */
  shellClassName?: string
  /** Override TipTap min height (e.g. hero bento on mobile). */
  textEditorMinHeightPx?: number
  /** Larger question title for hero layouts (mobile-first readability). */
  emphasizePrompt?: boolean
  /** Remove inner Card shell shadow/border — use when the card lives inside a Bento hero container that provides its own shadow. */
  flat?: boolean
}

/**
 * Question card — the atomic unit of the editor canvas.
 *
 * Visual rules (do not relax these without redesigning the card):
 *   • No hard outer border; rely on a soft surface + xs shadow for hierarchy.
 *   • Header is a one-line muted prompt; clicking it jumps the preview.
 *   • Photo questions get a single dropzone; the dropzone collapses into a
 *     tight image card with an absolute-positioned remove pill.
 *   • Text questions delegate to `AnswerRichTextEditor` and never render
 *     their own toolbar.
 */
function QuestionCardInner({
  question,
  orderId,
  disabled,
  photosReadOnly,
  onPreviewNavigate,
  aiEnabled,
  trialLocked = false,
  shellClassName,
  textEditorMinHeightPx,
  emphasizePrompt,
  flat,
}: QuestionCardProps) {
  const answer = useEditorStore((s) => s.answers[question.id] ?? '')
  const setAnswer = useEditorStore((s) => s.setAnswer)
  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const answerTextAlign = useEditorStore((s) => s.answerTextAlign)
  const supabase = useMemo(() => createClient(), [])

  const [isNarrow, setIsNarrow] = useState(false)
  /** Mobile: folded row shows a short preview; expanded shows full editor. */
  const [mobileAnswerPeek, setMobileAnswerPeek] = useState(false)

  useEffect(() => {
    const sync = () =>
      setIsNarrow(typeof window !== 'undefined' && window.innerWidth < 900)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    const a = useEditorStore.getState().answers[question.id] ?? ''
    setMobileAnswerPeek(isNarrow && !answerTextIsEffectivelyEmpty(a))
  }, [question.id, isNarrow])

  const isPhoto =
    question.question_type === 'photo' ||
    question.question_type === 'photo_with_text'
  const photoLocked = !!(disabled || photosReadOnly || trialLocked)
  const editorDisabled = !!(disabled || trialLocked)

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || trialLocked) return
    try {
      const compressed = await compressForStorage(file)
      const ext = compressed.name.split('.').pop()
      const filePath = `${orderId}/${question.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET_BOOK_PHOTOS)
        .upload(filePath, compressed, { upsert: true })
      if (error) {
        void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (сұрақ)', error)
        return
      }
      /** Object key inside `book-photos` — same as custom pages; avoids public URL parsing. */
      setAnswer(question.id, filePath)
    } catch (err: unknown) {
      void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (сұрақ)', null, err)
    }
  }

  const editorHtml = normalizeAnswerToHtml(answer)
  const hasTextAnswer = !answerTextIsEffectivelyEmpty(answer)
  const peekPlain = answerPlainTextPreview(answer)

  /** Single source of truth for the small prompt above the body. */
  const headerInner = (
    <>
      <div
        className={clsx(
          'font-semibold leading-snug tracking-tight text-[color:var(--text-primary)]',
          emphasizePrompt
            ? 'text-[17px] sm:text-[18px] leading-snug'
            : 'text-[16.5px] sm:text-[15.5px]'
        )}
      >
        {question.question_kk}
      </div>
      {question.is_required && (
        <span className="mt-0.5 inline-block text-[10.5px] font-semibold uppercase tracking-wider text-red-600">
          міндетті
        </span>
      )}
    </>
  )

  return (
    <div className={clsx('relative', shellClassName)}>
      <Card
      padding="sm"
      className={clsx(
        'bg-[color:var(--surface)] transition-shadow duration-[var(--transition)]',
        flat
          ? '!border-transparent !shadow-none !bg-transparent'
          : 'shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]'
      )}
    >
      <header className="mb-3">
        {onPreviewNavigate ? (
          <button
            type="button"
            onClick={() => onPreviewNavigate()}
            className="-mx-2 -my-1 block w-[calc(100%+1rem)] cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 text-left transition-colors duration-[var(--transition)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
          >
            {headerInner}
          </button>
        ) : (
          headerInner
        )}
      </header>

      {isPhoto ? (
        answer && answerDisplaysAsPhotoContent(answer) ? (
          <div className="relative overflow-hidden rounded-[var(--radius-md)]">
            {(() => {
              const urls = splitPhotoAnswerToResolvedUrls(answer)
              const rawSeg = splitPhotoAnswerRawSegments(answer)
              const n = urls.length
              const refAt = (i: number) => rawSeg[i] || urls[i] || ''
              if (n <= 1) {
                return (
                  <SignedBookPhotoImg
                    storageRef={refAt(0)}
                    alt=""
                    className="block max-h-[52vh] w-full object-cover sm:max-h-[400px]"
                  />
                )
              }
              if (n === 2) {
                return (
                  <div className="grid max-h-[52vh] grid-cols-1 grid-rows-2 gap-0.5 sm:max-h-[400px]">
                    {urls.slice(0, 2).map((u, i) => (
                      <div key={i} className="min-h-0 overflow-hidden bg-[color:var(--surface-subtle)]">
                        <SignedBookPhotoImg storageRef={refAt(i)} alt="" className="h-full min-h-[120px] w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )
              }
              return (
                <div className="grid max-h-[52vh] grid-cols-2 grid-rows-2 gap-0.5 sm:max-h-[400px]">
                  {urls.slice(0, 4).map((u, i) => (
                    <div key={i} className="aspect-square min-h-0 overflow-hidden bg-[color:var(--surface-subtle)]">
                      <SignedBookPhotoImg storageRef={refAt(i)} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )
            })()}
            {!photoLocked && (
              <button
                type="button"
                onClick={() => setAnswer(question.id, '')}
                className="absolute right-2 top-2 z-10 inline-flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors duration-[var(--transition)] hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 touch-manipulation"
              >
                <IconX className="size-3.5" />
                Жою
              </button>
            )}
          </div>
        ) : photoLocked ? (
          <div className="rounded-[var(--radius-md)] bg-[color:var(--surface-subtle)] p-6 text-center">
            <p className="text-[13px] font-medium text-[color:var(--text-muted)]">
              Фото жоқ
            </p>
          </div>
        ) : (
          <label
            className={clsx(
              'group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--surface-subtle)] px-4 py-8 text-center',
              'ring-1 ring-inset ring-[color:var(--border)]',
              'transition-[background-color,box-shadow] duration-[var(--transition)]',
              'hover:bg-[color:var(--accent-surface)] hover:ring-[color:var(--accent-ring)]',
              'focus-within:ring-2 focus-within:ring-[color:var(--accent-ring)]'
            )}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="sr-only"
            />
            <span className="flex size-10 items-center justify-center rounded-full bg-[color:var(--surface)] text-[color:var(--text-secondary)] shadow-[var(--shadow-xs)] ring-1 ring-[color:var(--border)] transition-colors duration-[var(--transition)] group-hover:text-[color:var(--accent)]">
              <IconCamera className="size-5" />
            </span>
            <span className="text-[13px] font-semibold text-[color:var(--text-primary)]">
              Фото таңдаңыз
            </span>
            <span className="text-[11px] font-medium text-[color:var(--text-muted)]">
              JPG, PNG — кез келген өлшем
            </span>
          </label>
        )
      ) : isNarrow && hasTextAnswer && mobileAnswerPeek && !editorDisabled ? (
        <button
          type="button"
          onClick={() => setMobileAnswerPeek(false)}
          className={clsx(
            'relative w-full overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--surface-subtle)] text-left',
            'ring-1 ring-inset ring-[color:var(--border)] shadow-[var(--shadow-xs)]',
            'transition-[transform,background-color,box-shadow] duration-[var(--transition)]',
            'hover:bg-[color:var(--accent-surface)] hover:ring-[color:var(--accent-ring)] active:scale-[0.99]'
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-10 bg-gradient-to-t from-[color:var(--surface-subtle)] via-[color:var(--surface-subtle)]/85 to-transparent"
          />
          <div
            className="max-h-[5.25rem] overflow-hidden px-4 py-3 text-[13px] leading-snug text-[color:var(--text-secondary)]"
            style={{ fontFamily: "'Cormorant', Georgia, serif" }}
          >
            {peekPlain || '…'}
          </div>
          <div className="relative z-[2] border-t border-[color:var(--border)] px-4 py-2 text-[11px] font-semibold text-[color:var(--accent)]">
            Жауапты ашу — өңдеу
          </div>
        </button>
      ) : (
        <>
          {isNarrow && hasTextAnswer && !editorDisabled && (
            <div className="mb-2 flex justify-end md:hidden">
              <button
                type="button"
                onClick={() => setMobileAnswerPeek(true)}
                className="text-[11px] font-semibold text-[color:var(--accent)] underline-offset-2 transition-colors hover:underline"
              >
                Жауапты жасыру (қысқа көрініс)
              </button>
            </div>
          )}
          <AnswerRichTextEditor
            key={question.id}
            valueHtml={editorHtml}
            onChangeHtml={(h) => !editorDisabled && setAnswer(question.id, h)}
            disabled={editorDisabled}
            placeholder={question.hint_kk || 'Жауабыңызды жазыңыз...'}
            textAlign={answerTextAlign}
            fontSizePx={answerPresetToUiPx(answerFontPreset)}
            minHeightPx={textEditorMinHeightPx ?? (isNarrow ? 188 : 172)}
            onNavigatePreview={onPreviewNavigate}
            aiEnabled={aiEnabled}
            aiSource="answer"
            aiOrderId={orderId}
            aiBlockKey={`q:${question.id}`}
          />
        </>
      )}
    </Card>
      {trialLocked ? <TrialLockedOverlay density="compact" className="rounded-[var(--radius-lg)]" /> : null}
    </div>
  )
}

export const QuestionCard = memo(QuestionCardInner)
QuestionCard.displayName = 'QuestionCard'
