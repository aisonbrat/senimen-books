'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useEditorStore } from '@/lib/store/editorStore'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Tag'
import { IconChevronLeft } from '@/components/ui/icons'
import { answerTextIsEffectivelyEmpty } from '@/lib/utils/answerHtml'
import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'

interface EditorHeaderProps {
  onSave: () => void
  onComplete: () => Promise<void>
  isCompleted: boolean
  isEditorMode?: boolean
  onCompleteEditing?: () => Promise<void>
  editorDone?: boolean
  /** Client trial book: hide «Аяқтау» until admin grants full access. */
  trialLockedClient?: boolean
  /** Client fills book while status is filling — allow editing headline title in the bar. */
  editableBookTitle?: boolean
  onCommitBookTitle?: (trimmedTitle: string) => void | Promise<void>
}

export function EditorHeader({
  onSave,
  onComplete,
  isCompleted,
  isEditorMode,
  onCompleteEditing,
  editorDone,
  trialLockedClient = false,
  editableBookTitle = false,
  onCommitBookTitle,
}: EditorHeaderProps) {
  const router = useRouter()
  const { order, saving, lastSaved, answers, chapters } = useEditorStore()
  const [titleDraft, setTitleDraft] = useState('')
  useEffect(() => {
    setTitleDraft(String(order?.book_title ?? ''))
  }, [order?.id, order?.book_title])

  async function flushTitleDraft() {
    const t = titleDraft.trim()
    if (!t || !onCommitBookTitle) return
    if (t === String(order?.book_title ?? '').trim()) return
    await onCommitBookTitle(t)
  }

  const allQuestions = chapters.flatMap(c => c.questions ?? [])
  const answeredCount = allQuestions.filter((q) => !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')).length
  const [showModal, setShowModal] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const saveStatus = saving
    ? 'Сақталуда... · Saving...'
    : lastSaved
      ? `Сақталды ${lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      : ''

  function goBack() {
    onSave()
    router.push(isEditorMode ? '/editor-dashboard' : '/dashboard')
  }

  const touch = isMobile ? 'min-h-[44px] touch-manipulation px-4' : ''

  const titleControl = editableBookTitle && !isEditorMode && onCommitBookTitle ? (
    <input
      type="text"
      value={titleDraft}
      onChange={(e) => setTitleDraft(e.target.value)}
      onBlur={() => void flushTitleDraft()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      maxLength={120}
      className={clsx(
        'min-w-0 flex-1 rounded-[var(--radius-sm)] border border-transparent bg-[color:var(--surface-subtle)] px-2 py-1 text-[13px] font-semibold tracking-tight text-[color:var(--text-primary)] outline-none ring-[color:var(--accent-ring)] transition-[border-color,box-shadow] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-strong)] focus:ring-2',
        touch && 'min-h-[44px] text-[14px]'
      )}
      placeholder="Кітап атауы"
      aria-label="Кітап атауы"
    />
  ) : (
    <span className={clsx('truncate text-[13px] font-semibold tracking-tight text-[color:var(--text-primary)]')}>
      {order?.book_title}
    </span>
  )

  const actionButtons = isEditorMode ? (
    editorDone ? (
      <Tag tone="success" size="sm">Өңдеу аяқталды</Tag>
    ) : (
      <>
        <Button type="button" variant="primary" size={isMobile ? 'md' : 'sm'} className={touch} disabled={saving} onClick={onSave}>
          Сақтау
        </Button>
        <Button
          type="button"
          size={isMobile ? 'md' : 'sm'}
          variant="secondary"
          className={clsx(
            '!border-[color:var(--accent)] !bg-transparent !text-[color:var(--accent)] hover:!bg-[color:var(--accent-surface)]',
            touch
          )}
          onClick={() => setShowModal(true)}
        >
          Өңдеуді аяқтау
        </Button>
      </>
    )
  ) : trialLockedClient ? (
    <>
      <Button type="button" variant="primary" size={isMobile ? 'md' : 'sm'} className={touch} disabled={saving} onClick={onSave}>
        Сақтау
      </Button>
      {!isMobile ? (
        <Tag tone="accent" size="sm">
          Тегін кезең · алдымен {TRIAL_FREE_QUESTION_COUNT} сұрақ ашық
        </Tag>
      ) : null}
    </>
  ) : isCompleted ? (
    <Tag tone="warning" size="sm">Тексерілуде</Tag>
  ) : (
    <>
      <Button type="button" variant="primary" size={isMobile ? 'md' : 'sm'} className={touch} disabled={saving} onClick={onSave}>
        Сақтау
      </Button>
      <Button
        type="button"
        size={isMobile ? 'md' : 'sm'}
        variant="secondary"
        className={clsx(
          '!border-[color:var(--accent)] !bg-transparent !text-[color:var(--accent)] hover:!bg-[color:var(--accent-surface)]',
          touch
        )}
        onClick={() => setShowModal(true)}
      >
        Аяқтау
      </Button>
    </>
  )

  const shellCls =
    'shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]'

  return (
    <>
      {isMobile ? (
        <div className={shellCls}>
          <div className="flex items-center gap-2 px-3.5 pb-1 pt-2">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] px-1 text-[13px] font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--accent)] touch-manipulation"
            >
              <IconChevronLeft className="size-4 shrink-0" />
              <span className="whitespace-nowrap">Артқа</span>
            </button>
            <span className="h-3.5 w-px shrink-0 bg-[color:var(--border)]" aria-hidden />
            {titleControl}
          </div>
          <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-0.5">
            <span
              className="min-w-0 truncate text-[11px] font-medium leading-tight text-[color:var(--text-muted)]"
              aria-live="polite"
              aria-busy={saving}
            >
              {saveStatus}
            </span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span className="text-[11px] font-medium tabular-nums text-[color:var(--text-muted)]">
                {answeredCount}/{allQuestions.length}
              </span>
              {actionButtons}
            </div>
          </div>
        </div>
      ) : (
        <header className={clsx(shellCls, 'flex h-[54px] items-center justify-between gap-4 px-5')}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] py-1.5 pl-1 pr-2 text-[13px] font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--accent)]"
            >
              <IconChevronLeft className="size-4" />
              Артқа
            </button>
            <span className="h-4 w-px shrink-0 bg-[color:var(--border)]" aria-hidden />
            <div className="min-w-0 max-w-[min(100%,420px)] flex-1">{titleControl}</div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-[11px] text-[color:var(--text-muted)] sm:inline" aria-live="polite" aria-busy={saving}>
              {saveStatus}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-[color:var(--text-muted)]">
              {answeredCount}/{allQuestions.length}
            </span>
            <div className="flex items-center gap-2">{actionButtons}</div>
          </div>
        </header>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4 backdrop-blur-[3px]">
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-[420px] rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-lg)]"
          >
            <h3 className="font-serif-display text-[1.05rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
              {isEditorMode ? 'Өңдеуді аяқтау' : 'Кітапты аяқтау'}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
              {isEditorMode
                ? 'Өңдеу аяқталғаннан кейін кітап «Аяқталды» статусына өтеді. Жалғастырасыз ба?'
                : 'Аяқтаған соң кітап редакторға жіберіледі. Мазмұнды өзгерту мүмкін болмайды. Жалғастырасыз ба?'}
            </p>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                Болдырмау
              </Button>
              <Button type="button" variant="primary" disabled={completing} className="flex-[1.15]" onClick={async () => {
                  setCompleting(true)
                  try {
                    if (isEditorMode && onCompleteEditing) {
                      await onCompleteEditing()
                    } else {
                      await onComplete()
                    }
                    setShowModal(false)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Сақтау сәтсіз аяқталды')
                  } finally {
                    setCompleting(false)
                  }
                }}
              >
                {completing ? 'Жіберілуде...' : 'Растаймын, аяқтау'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
