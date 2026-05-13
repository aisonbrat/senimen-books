'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { clsx } from 'clsx'
import { IconRedo, IconSparkles, IconUndo, IconX } from '@/components/ui/icons'
import {
  EnhanceRequestError,
  enhanceTextWithAi,
  type AiEnhanceQuota,
  type EnhanceMode,
} from '@/lib/ai/enhanceClient'
import { normalizeAnswerToHtml } from '@/lib/utils/answerHtml'

/** ProseMirror undo depth (typing + formatting); external HTML sync does not consume steps. */
const EDITOR_HISTORY_DEPTH = 100

export interface AnswerRichTextEditorProps {
  valueHtml: string
  onChangeHtml: (html: string) => void
  disabled?: boolean
  placeholder?: string
  textAlign: 'left' | 'justify' | 'center'
  fontSizePx: number
  minHeightPx?: number
  /** Extra stanza gap between paragraphs (matches preview `.book-stanza-gap`). */
  variant?: 'default' | 'poem'
  /** When the editor already has text, focusing it jumps the book preview to this block. */
  onNavigatePreview?: () => void
  /** Editor-only: grammar / polish / literary AI controls. */
  aiEnabled?: boolean
  /** Analytics tag stored on `ai_enhancement_logs.source`. */
  aiSource?: 'answer' | 'algy' | 'hat' | 'custom_text'
  /** Optional: associates each AI call with an order in analytics. */
  aiOrderId?: string
  /** Client • бөлім бойынша ЖИ лимит үшін тұрақты id (қ/х/fak түрі). Редакторда бос қалуы мүмкін. */
  aiBlockKey?: string
}

function formatAiQuotaReachedMessage(q: AiEnhanceQuota): string {
  if (q.tier === 'trial') {
    return `Осы бөлім үшін тегін ЖИ таусылды (${q.limit} рет). Басқа бөлімде ЖИ қайта қолданылады.`
  }
  const hint =
    typeof q.resetsAt === 'string' && q.resetsAt.trim()
      ? ` Кейін қайталау шамасы: ${new Date(q.resetsAt).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' })}.`
      : ''
  return `Шектеу: осы бөлімде 30 минут ішінде ЖИ тек ${q.limit} рет.${hint}`
}

/** Local snapshot of an in-flight AI suggestion the user inspects before accepting. */
interface AiReview {
  originalHtml: string
  polishedHtml: string
  view: 'original' | 'polished'
  mode: EnhanceMode
}

export function AnswerRichTextEditor({
  valueHtml,
  onChangeHtml,
  disabled,
  placeholder,
  textAlign,
  fontSizePx,
  minHeightPx = 168,
  variant = 'default',
  onNavigatePreview,
  aiEnabled,
  aiSource,
  aiOrderId,
  aiBlockKey,
}: AnswerRichTextEditorProps) {
  const aiReviewRef = useRef<AiReview | null>(null)
  const lastEditorEditableRef = useRef<boolean | null>(null)
  /** Last HTML we sent to the parent from this editor — avoids prop round-trip `setContent` wiping undo history. */
  const lastEmittedToParentRef = useRef<string | undefined>(undefined)
  const committedHtmlRef = useRef(valueHtml)
  const onChangeHtmlRef = useRef(onChangeHtml)
  onChangeHtmlRef.current = onChangeHtml

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        code: false,
        underline: false,
        undoRedo: { depth: EDITOR_HISTORY_DEPTH, newGroupDelay: 650 },
      }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || 'Жауабыңызды жазыңыз...' }),
    ],
    [placeholder]
  )

  const [aiReview, setAiReview] = useState<AiReview | null>(null)
  const [aiLoadingMode, setAiLoadingMode] = useState<EnhanceMode | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiWarn, setAiWarn] = useState<string | null>(null)
  const [aiQuota, setAiQuota] = useState<AiEnhanceQuota | null>(null)

  useEffect(() => {
    aiReviewRef.current = aiReview
  }, [aiReview])

  useEffect(() => {
    setAiQuota(null)
    setAiWarn(null)
  }, [aiOrderId, aiBlockKey])

  useEffect(() => {
    if (aiReview) return
    committedHtmlRef.current = valueHtml
  }, [valueHtml, aiReview])

  const editor = useEditor({
    extensions,
    content: valueHtml?.trim() ? valueHtml : '<p></p>',
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: clsx(
          'focus:outline-none px-4 py-3',
          variant === 'poem' && 'answer-rich-inner--poem'
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const rev = aiReviewRef.current
      if (rev) {
        if (rev.view === 'polished') {
          const html = !ed.getText().trim() ? '<p></p>' : ed.getHTML()
          setAiReview((prev) => {
            if (!prev || prev.view !== 'polished') return prev
            if (prev.polishedHtml === html) return prev
            return { ...prev, polishedHtml: html }
          })
        }
        return
      }
      const empty = !ed.getText().trim()
      const html = empty ? '' : ed.getHTML()
      lastEmittedToParentRef.current = empty ? '' : normalizeAnswerToHtml(html)
      onChangeHtmlRef.current(html)
    },
  })

  useEffect(() => {
    if (!editor || valueHtml === undefined) return
    if (aiReview) return
    const normalizedProp = valueHtml.trim() ? normalizeAnswerToHtml(valueHtml) : ''
    if (normalizedProp === lastEmittedToParentRef.current) return
    const incoming = normalizedProp ? valueHtml : '<p></p>'
    const cur = editor.getHTML()
    if (incoming !== cur) {
      editor.chain().setMeta('addToHistory', false).setContent(incoming, { emitUpdate: false }).run()
    }
    lastEmittedToParentRef.current = normalizedProp
  }, [valueHtml, editor, aiReview])

  useEffect(() => {
    if (!editor) return
    const canEdit = !disabled && (!aiReview || aiReview.view === 'polished')
    if (lastEditorEditableRef.current === canEdit) return
    lastEditorEditableRef.current = canEdit
    editor.setEditable(canEdit)
  }, [disabled, editor, aiReview])

  const aiBusy = aiLoadingMode !== null
  const aiAnswerEmpty = !(editor?.getText().trim().length ?? 0)
  const aiCoreDisabled =
    disabled || !editor || aiBusy || !!aiReview || aiAnswerEmpty
  const aiAtLimitUi = !!(aiQuota && aiQuota.remaining <= 0)
  const aiEnhanceBlockedByEmptyAnswer = !!(editor && !disabled && !aiBusy && !aiReview && aiAnswerEmpty)

  const AI_NEED_TEXT_HINT_KK = 'ЖИ құралдары тек мәтін бар кезде қосылады — алдымен жауап жазыңыз.'

  async function runEnhance(mode: EnhanceMode) {
    if (!editor || aiBusy || aiReview) return
    const html = editor.getHTML()
    if (!editor.getText().trim()) return
    setAiError(null)
    setAiWarn(null)
    setAiLoadingMode(mode)
    try {
      const result = await enhanceTextWithAi({
        html,
        source: aiSource ?? 'answer',
        orderId: aiOrderId,
        blockKey: aiBlockKey,
        mode,
      })
      if (result.quota) setAiQuota(result.quota)
      const review: AiReview = {
        originalHtml: html,
        polishedHtml: result.html,
        view: 'polished',
        mode,
      }
      setAiReview(review)
      editor.commands.setContent(result.html, { emitUpdate: false })
    } catch (err) {
      if (err instanceof EnhanceRequestError && err.status === 429) {
        setAiWarn(err.message)
        setAiError(null)
      } else {
        setAiWarn(null)
        setAiError(err instanceof Error ? err.message : 'Қате')
      }
    } finally {
      setAiLoadingMode(null)
    }
  }

  function tryRunAiEnhance(mode: EnhanceMode) {
    if (!editor || aiBusy || aiReview) return
    if (!editor.getText().trim()) return
    if (aiQuota && aiQuota.remaining <= 0) {
      setAiWarn(formatAiQuotaReachedMessage(aiQuota))
      setAiError(null)
      return
    }
    void runEnhance(mode)
  }

  function switchReviewView(view: 'original' | 'polished') {
    if (!editor) return
    let htmlToApply: string | null = null
    setAiReview((prev) => {
      if (!prev || prev.view === view) return prev
      htmlToApply = view === 'original' ? prev.originalHtml : prev.polishedHtml
      return { ...prev, view }
    })
    if (htmlToApply !== null) {
      queueMicrotask(() => {
        editor.commands.setContent(htmlToApply!, { emitUpdate: false })
      })
    }
  }

  function acceptAi() {
    if (!aiReview || !editor) return
    const polished = aiReview.view === 'polished' ? editor.getHTML() : aiReview.polishedHtml
    setAiReview(null)
    editor.commands.setContent(polished, { emitUpdate: false })
    onChangeHtml(polished)
    lastEmittedToParentRef.current = normalizeAnswerToHtml(polished)
  }

  function cancelAi() {
    if (!aiReview || !editor) return
    const original = aiReview.originalHtml
    setAiReview(null)
    editor.commands.setContent(original, { emitUpdate: false })
    const out = original.trim() ? original : ''
    onChangeHtml(out)
    lastEmittedToParentRef.current = out ? normalizeAnswerToHtml(out) : ''
  }

  const markBtn = (label: string, active: boolean, run: () => void) => (
    <button
      type="button"
      onClick={run}
      disabled={disabled || !editor || !!aiReview}
      className={clsx(
        'rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors',
        active
          ? 'bg-[color:var(--accent)] text-white'
          : 'bg-white text-[color:var(--text-secondary)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-subtle)]'
      )}
    >
      {label}
    </button>
  )

  const reviewing = !!aiReview
  const loadingLabel =
    aiLoadingMode === 'grammar'
      ? 'Түзеп жатыр…'
      : aiLoadingMode === 'literary'
        ? 'Әдебилеп жатыр…'
        : aiLoadingMode === 'polish'
          ? 'Әрлеп жатыр…'
          : ''

  const reviewBarTitle =
    aiReview?.mode === 'grammar' ? (
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--text-secondary)]">
        Түзету ұсынысы — бастапқы мен өңделгенді салыстырыңыз
      </div>
    ) : (
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3B2A66]">
        <IconSparkles className="size-3.5" />
        AI ұсыныс — салыстырып шешім қабылдаңыз
      </div>
    )

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[color:var(--border)] bg-white">
      {reviewing ? (
        <div
          className={clsx(
            'flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] px-3 py-2',
            aiReview!.mode === 'grammar'
              ? 'bg-[color:var(--surface-subtle)]'
              : 'bg-gradient-to-r from-[#F4F1FB] to-[#FBEFEC]'
          )}
        >
          {reviewBarTitle}
          <div className="ml-auto inline-flex overflow-hidden rounded-full ring-1 ring-[color:var(--border)] bg-white">
            <button
              type="button"
              onClick={() => switchReviewView('original')}
              className={clsx(
                'px-3 py-1 text-[11px] font-semibold transition-colors',
                aiReview!.view === 'original'
                  ? 'bg-[color:var(--text-primary)] text-white'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-subtle)]'
              )}
            >
              Бастапқы
            </button>
            <button
              type="button"
              onClick={() => switchReviewView('polished')}
              className={clsx(
                'px-3 py-1 text-[11px] font-semibold transition-colors',
                aiReview!.view === 'polished'
                  ? 'bg-[color:var(--text-primary)] text-white'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-subtle)]'
              )}
            >
              {aiReview!.mode === 'grammar' ? 'Өңделген' : 'AI ұсынысы'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1.5">
          {markBtn('B', !!editor?.isActive('bold'), () => editor?.chain().focus().toggleBold().run())}
          {markBtn('I', !!editor?.isActive('italic'), () => editor?.chain().focus().toggleItalic().run())}
          {markBtn('U', !!editor?.isActive('underline'), () => editor?.chain().focus().toggleUnderline().run())}

          <div
            className="h-5 w-px shrink-0 bg-[color:var(--border)]"
            role="separator"
            aria-orientation="vertical"
          />
          <div
            className="inline-flex items-center gap-0"
            role="group"
            aria-label="Өзгерістерді қайтару (⌘Z / ⌘⇧Z)"
            title="Мәтіндегі өзгерістер: ⌘Z қайтару, ⌘⇧Z немесе ⌘Y қайта іске қосу (соңғы қадамдар шектелген, браузер жүктемесін арттырмайды)."
          >
            <button
              type="button"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={disabled || !!aiReview || aiBusy || !editor?.can().undo()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-l-md bg-white text-[color:var(--text-secondary)] ring-1 ring-inset ring-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Қайтару (⌘Z)"
            >
              <IconUndo className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={disabled || !!aiReview || aiBusy || !editor?.can().redo()}
              className="-ml-px inline-flex h-7 w-7 items-center justify-center rounded-r-md bg-white text-[color:var(--text-secondary)] ring-1 ring-inset ring-[color:var(--border)] transition-colors hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Қайта іске қосу (⌘⇧Z)"
            >
              <IconRedo className="size-3.5" />
            </button>
          </div>

          {aiEnabled ? (
            <>
              <span className="ml-auto" />
              {aiQuota && aiQuota.remaining > 0 ? (
                <span
                  className="shrink-0 text-[10px] font-semibold tabular-nums text-[color:var(--text-muted)]"
                  title={
                    aiQuota.tier === 'trial'
                      ? `Тегін бөлімде ${aiQuota.limit} ЖИ дейін`
                      : `30 мин ішінде ${aiQuota.limit} ЖИ бөлім бойынша`
                  }
                >
                  ЖИ: {aiQuota.remaining}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => tryRunAiEnhance('grammar')}
                disabled={aiCoreDisabled}
                title={
                  aiAtLimitUi
                    ? formatAiQuotaReachedMessage(aiQuota!)
                    : aiEnhanceBlockedByEmptyAnswer
                      ? AI_NEED_TEXT_HINT_KK
                      : 'Пунктуация, орфография және грамматика ғана (мағына өзгермейді).'
                }
                className={clsx(
                  'rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-[background-color,border-color,opacity] duration-150',
                  aiAtLimitUi
                    ? 'border-amber-500/65 bg-amber-50 text-amber-950 hover:bg-amber-100'
                    : 'border-[color:var(--border)] bg-white text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-subtle)]',
                  aiCoreDisabled && 'opacity-45'
                )}
              >
                {aiLoadingMode === 'grammar' ? loadingLabel : 'Қателерін түзеу'}
              </button>
              <button
                type="button"
                onClick={() => tryRunAiEnhance('polish')}
                disabled={aiCoreDisabled}
                title={
                  aiAtLimitUi
                    ? formatAiQuotaReachedMessage(aiQuota!)
                    : aiEnhanceBlockedByEmptyAnswer
                      ? AI_NEED_TEXT_HINT_KK
                      : 'Мәтінді әрлеу: оқуға ыңғайлы түрде.'
                }
                className={clsx(
                  'ai-magic-btn',
                  aiLoadingMode === 'polish' && 'ai-magic-btn--loading',
                  aiAtLimitUi && 'ai-magic-btn--at-limit'
                )}
              >
                <IconSparkles className="size-3.5 shrink-0" />
                <span>{aiLoadingMode === 'polish' ? loadingLabel : 'Әрлеу'}</span>
              </button>
              <button
                type="button"
                onClick={() => tryRunAiEnhance('literary')}
                disabled={aiCoreDisabled}
                title={
                  aiAtLimitUi
                    ? formatAiQuotaReachedMessage(aiQuota!)
                    : aiEnhanceBlockedByEmptyAnswer
                      ? AI_NEED_TEXT_HINT_KK
                      : 'Әдеби стильге жақындату.'
                }
                className={clsx(
                  'ai-magic-btn ai-magic-btn--literary',
                  aiLoadingMode === 'literary' && 'ai-magic-btn--loading',
                  aiAtLimitUi && 'ai-magic-btn--at-limit'
                )}
              >
                <IconSparkles className="size-3.5 shrink-0" />
                <span>{aiLoadingMode === 'literary' ? loadingLabel : 'Әдеби ету'}</span>
              </button>
            </>
          ) : null}
        </div>
      )}

      <div className="relative">
        <div
          data-text-align={textAlign}
          data-ai-review={reviewing ? aiReview!.view : undefined}
          className={clsx(
            'answer-rich-editor font-preview-book',
            variant === 'poem' && 'answer-rich-editor--poem',
            reviewing && aiReview!.view === 'polished' && 'bg-gradient-to-br from-[#FAFAFE] to-[#FFF8FA]'
          )}
          style={{
            fontSize: fontSizePx,
            fontFamily: "'Cormorant', Georgia, serif",
            fontWeight: 500,
            minHeight: minHeightPx,
            lineHeight: 1.45,
          }}
          onFocusCapture={() => {
            if (!onNavigatePreview || !editor || reviewing) return
            if (!editor.getText().trim()) return
            onNavigatePreview()
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {reviewing ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
          <p className="min-w-[180px] flex-1 text-[11px] leading-snug text-[color:var(--text-muted)]">
            {aiReview!.view === 'polished'
              ? '«AI ұсынысы» режимінде мәтінді өзгерте аласыз. «Бастапқы» — сақталған нұсқа.'
              : 'Бастапқы нұсқа. Салыстыру үшін «AI ұсынысы» / «Өңделген» түймесін басыңыз.'}
          </p>
          <button
            type="button"
            onClick={cancelAi}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[color:var(--text-secondary)] ring-1 ring-[color:var(--border)] bg-white transition-all hover:bg-[color:var(--surface-subtle)] active:scale-[0.98]"
          >
            <IconX className="size-3.5" />
            Болдырмау
          </button>
          <button
            type="button"
            onClick={acceptAi}
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <IconSparkles className="size-3.5" />
            Қабылдау
          </button>
        </div>
      ) : null}

      {aiWarn ? (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-950">
          <span className="mt-0.5 shrink-0 text-[13px] leading-none" aria-hidden>
            ⚠
          </span>
          <span className="flex-1">{aiWarn}</span>
          <button
            type="button"
            onClick={() => setAiWarn(null)}
            className="shrink-0 text-[11px] font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            Жабу
          </button>
        </div>
      ) : null}

      {aiError ? (
        <div className="flex items-start gap-2 border-t border-[color:var(--border)] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
          <IconSparkles className="mt-[1px] size-3.5 flex-none" />
          <span className="flex-1">{aiError}</span>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="ml-2 text-[11px] font-semibold text-[#B91C1C] underline-offset-2 hover:underline"
          >
            Жабу
          </button>
        </div>
      ) : null}
    </div>
  )
}
