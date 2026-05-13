'use client'
import { clsx } from 'clsx'
import { useEditorStore } from '@/lib/store/editorStore'
import { answerTextIsEffectivelyEmpty } from '@/lib/utils/answerHtml'

/**
 * Chapter rail — minimal sidebar that lists chapters and silently shows
 * progress (answered / total). Click a chapter → editor jumps the spread
 * to the chapter's first question.
 *
 * Design: no hard borders, soft surfaces, full token usage. The active
 * chapter is highlighted with the accent surface and an accent rail on
 * the left edge so the eye locks onto where you are without colour noise.
 */
export function ChapterSidebar() {
  const {
    chapters,
    activeChapterId,
    answers,
    setActiveChapter,
    setSpreadIndex,
    getAllQuestionsFlat,
  } = useEditorStore()
  const allQuestions = getAllQuestionsFlat()

  function switchChapter(chapterId: string) {
    setActiveChapter(chapterId)
    const ch = chapters.find((c) => c.id === chapterId)
    if (!ch) return
    const firstQIndex = allQuestions.findIndex((q) =>
      (ch.questions || []).some((cq) => cq.id === q.id)
    )
    if (firstQIndex >= 0) setSpreadIndex(Math.floor(firstQIndex / 2))
  }

  return (
    <aside
      className="flex w-[208px] shrink-0 flex-col overflow-y-auto bg-[color:var(--bg-page)] py-4 pl-3 pr-2"
      aria-label="Тараулар"
    >
      <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
        Тараулар
      </div>
      <nav className="flex flex-col gap-0.5">
        {chapters.map((ch) => {
          const total = (ch.questions || []).length
          const answered = (ch.questions || []).filter(
            (q) => !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')
          ).length
          const isActive = activeChapterId === ch.id
          const isComplete = total > 0 && answered === total

          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => switchChapter(ch.id)}
              aria-current={isActive ? 'true' : undefined}
              className={clsx(
                'group relative flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left',
                'transition-[color,background-color] duration-[var(--transition)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-1',
                isActive
                  ? 'bg-[color:var(--accent-surface)]'
                  : 'hover:bg-[color:var(--surface-subtle)]'
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[2px] rounded-full bg-[color:var(--accent)]"
                />
              )}
              <span
                className={clsx(
                  'min-w-0 flex-1 truncate text-[13px] leading-tight',
                  isActive
                    ? 'font-semibold text-[color:var(--text-primary)]'
                    : 'font-medium text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)]'
                )}
              >
                {ch.title_kk}
              </span>
              {total > 0 && (
                <span
                  className={clsx(
                    'tabular-nums text-[10.5px] font-semibold',
                    isComplete
                      ? 'text-emerald-700'
                      : isActive
                        ? 'text-[color:var(--accent)]'
                        : 'text-[color:var(--text-muted)]'
                  )}
                >
                  {answered}/{total}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
