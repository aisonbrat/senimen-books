'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { clsx } from 'clsx'
import { useParams } from 'next/navigation'
import { useEditorStore } from '@/lib/store/editorStore'
import { useEditorData } from '@/lib/hooks/useEditorData'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { SpreadPreview } from '@/components/editor/SpreadPreview'
import { QuestionCard } from '@/components/editor/QuestionCard'
import { BookPagePreview } from '@/components/editor/BookPagePreview'
import { usePreviewPages } from '@/lib/hooks/usePreviewPages'
import { getCustomPagesInQuestionSlot } from '@/lib/utils/buildPreviewPages'
import { useMobileViewportWidth } from '@/lib/hooks/useMobileViewportWidth'
import { Button } from '@/components/ui/Button'
import { IconEye, IconRows, IconX } from '@/components/ui/icons'
import { CustomPageCard } from '@/components/editor/CustomPageCard'
import { EditorDashboardSettingsDeck } from '@/components/editor/EditorDashboardSettingsDeck'
import type { CustomPage, Order } from '@/lib/types'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  answerPresetToUiPx,
  clampFontPresetToSectionMax,
  normalizeGlobalFontPreset,
  SECTION_FONT_PRESETS,
  type AnswerFontPreset,
} from '@/lib/bookLayout'
import { spreadIndexForPreviewTarget } from '@/lib/utils/previewNavigation'
import {
  normalizeAnswerToHtml,
  answerTextIsEffectivelyEmpty,
} from '@/lib/utils/answerHtml'
import { FaktilerFactsEditor } from '@/components/editor/FaktilerFactsEditor'
import { faktilerFactsHaveAnyContent } from '@/lib/utils/faktilerFacts'
import { splitStoredPhotoPipeList } from '@/lib/utils/bookPhotoUrl'
import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'
import { TRIAL_BANNER_KK } from '@/lib/constants/trialContact'
import { TrialPreviewBlurWrap } from '@/components/editor/TrialPreviewBlurWrap'
import { TrialLockedOverlay } from '@/components/editor/TrialLockedOverlay'

const AnswerRichTextEditor = dynamic(
  () => import('@/components/editor/AnswerRichTextEditor').then((m) => m.AnswerRichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[220px] animate-pulse rounded-[10px] bg-[color:var(--surface-subtle)]" /> }
)

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--surface-subtle)',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
}

const RULES = [
  'Барлық сұраққа жауап беру міндетті емес. Жауап бермеген сұрақтарыңыз кітапқа енгізілмейді.',
  'Сұрақтарды толтырып болған соң менеджерге ескерту қажет.',
  'Сұрақтарды толтыру 2–4 сағат уақытты алады. Ноутбукпен толтыруға кеңес береміз.',
  'Жауаптарды барынша әрлеп, эмоция беретіндей етіп жазыңыз.',
  'Біз тек грамматикалық, пунктуациялық және орфографиялық қателерді түзетеміз.',
]

function AddPageButton({
  questionId,
  onAdd,
}: {
  questionId: string
  onAdd: (type: 'custom_photo' | 'custom_text' | 'custom_poem', questionId: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (open)
    return (
      <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
        <span className="mr-1 text-[11px] font-medium text-[color:var(--text-muted)]">Бет түрі:</span>
        <Button size="sm" onClick={() => { onAdd('custom_photo', questionId); setOpen(false) }}>Фото</Button>
        <Button size="sm" onClick={() => { onAdd('custom_text', questionId); setOpen(false) }}>Мәтін</Button>
        <Button size="sm" onClick={() => { onAdd('custom_poem', questionId); setOpen(false) }}>Өлең</Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>✕</Button>
      </div>
    )
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mx-4 mb-4 flex w-[calc(100%-2rem)] cursor-pointer items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[color:var(--border)] py-2.5 text-[12px] font-medium text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-secondary)]"
    >
      <span className="text-[14px] font-normal leading-none">+</span> Бет қосу
    </button>
  )
}

export default function EditorPage() {
  const params = useParams()
  const orderId = params.orderId as string
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [activeSpecial, setActiveSpecial] = useState<'algy_soz' | 'faktiler' | 'hat' | null>(null)
  const [showBookInfoModal, setShowBookInfoModal] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [mobileBentoSheetOpen, setMobileBentoSheetOpen] = useState(false)
  const [mobileFocusedQuestionId, setMobileFocusedQuestionId] = useState<string | null>(null)
  const [bookInfoForm, setBookInfoForm] = useState({ book_title: '', author_name: '', recipient_name: '', city: '', delivery_address: '' })
  const [savingBookInfo, setSavingBookInfo] = useState(false)
  const modalShownRef = useRef(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const {
    loading,
    chapters,
    activeChapterId,
    customPages,
    answers,
    order,
    algy_soz,
    hat_text,
    faktiler_facts,
    setAlgySoz,
    setHatText,
  } = useEditorStore()
  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const answerTextAlign = useEditorStore((s) => s.answerTextAlign)
  const algyFontPresetOverride = useEditorStore((s) => s.algyFontPresetOverride)
  const hatFontPresetOverride = useEditorStore((s) => s.hatFontPresetOverride)
  const setSectionFontPresetOverride = useEditorStore((s) => s.setSectionFontPresetOverride)
  const spreadIndex = useEditorStore((s) => s.spreadIndex)
  const setSpreadIndex = useEditorStore((s) => s.setSpreadIndex)
  const {
    autoSave,
    addCustomPage,
    updateCustomPage,
    deleteCustomPage,
    uploadPhoto,
    uploadFaktilerPhoto,
    uploadFixedChapterPhoto,
    moveCustomPage,
    completeOrder,
    saveBookInfo,
    patchOrder,
    uploadAdminCoverPrint,
  } = useEditorData(orderId)

  const clientReadOnly = (order as Order | null)?.status !== 'filling'
  const trialMode = (order as Order | null)?.trial_mode === true
  const clientAiEnabled = (order as Order | null)?.client_ai_enabled === true
  const clientAiFeaturesEnabled = clientAiEnabled || trialMode

  useEffect(() => {
    if (!order || loading) return
    if (modalShownRef.current) return
    const alreadyFilled = typeof window !== 'undefined' && localStorage.getItem(`book_info_${orderId}`) === 'done'
    if (alreadyFilled) return
    const o = order as any
    if (!o.recipient_name || o.book_title === 'Менің кітабым') {
      modalShownRef.current = true
      setBookInfoForm({
        book_title: o.book_title === 'Менің кітабым' ? '' : (o.book_title || ''),
        author_name: o.author_name || '',
        recipient_name: o.recipient_name || '',
        city: o.city || '',
        delivery_address: o.delivery_address || '',
      })
      setShowBookInfoModal(true)
    }
  }, [order, loading])

  const flatQuestions = useMemo(
    () => chapters.filter((c) => c.part_kind !== 'faktiler').flatMap((c) => c.questions ?? []),
    [chapters]
  )
  const showFaktilerNav = chapters.some((c) => c.part_kind === 'faktiler')
  const questionIndexById = useMemo(() => {
    const m = new Map<string, number>()
    flatQuestions.forEach((q, i) => m.set(q.id, i))
    return m
  }, [flatQuestions])
  const currentChapter = chapters.find(
    (c) => c.id === activeChapterId && c.part_kind !== 'faktiler'
  )
  const chapterIndex = chapters.findIndex(c => c.id === activeChapterId)
  const categoryId = (order as any)?.category_id
  const hasFixedChapterPhrases = useMemo(
    () => chapters.some((c) => !!c.fixed_phrase_id),
    [chapters]
  )
  const algyEffectivePreset = algyFontPresetOverride ?? answerFontPreset
  const hatEffectivePreset = hatFontPresetOverride ?? answerFontPreset

  const sectionInheritPreset = useMemo(() => {
    const g = normalizeGlobalFontPreset(answerFontPreset)
    const n = Number(g)
    return (n > 20 ? '20' : g) as AnswerFontPreset
  }, [answerFontPreset])

  function switchChapter(chapterId: string) {
    setActiveSpecial(null)
    setMobileFocusedQuestionId(null)
    useEditorStore.getState().setActiveChapter(chapterId)
  }

  useEffect(() => {
    setMobileFocusedQuestionId(null)
  }, [activeChapterId])

  const chapterQuestions = currentChapter?.questions ?? []

  // Mobile: resolve which question is the hero
  const mobileHeroQuestionId = useMemo(() => {
    if (!isMobile || !currentChapter || chapterQuestions.length === 0) return null
    if (mobileFocusedQuestionId && chapterQuestions.some((q) => q.id === mobileFocusedQuestionId))
      return mobileFocusedQuestionId
    const firstEmpty = chapterQuestions.find((q) => answerTextIsEffectivelyEmpty(answers[q.id] ?? ''))
    return (firstEmpty ?? chapterQuestions[0]).id
  }, [isMobile, currentChapter, chapterQuestions, mobileFocusedQuestionId, answers])

  // Mobile: prev/next question navigation
  const mobileHeroIndex = useMemo(() => {
    if (!mobileHeroQuestionId) return 0
    const idx = chapterQuestions.findIndex((q) => q.id === mobileHeroQuestionId)
    return idx >= 0 ? idx : 0
  }, [mobileHeroQuestionId, chapterQuestions])

  const mobilePrevQ = chapterQuestions[mobileHeroIndex - 1] ?? null
  const mobileNextQ = chapterQuestions[mobileHeroIndex + 1] ?? null
  const mobilePrevChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null
  const mobileNextChapter = chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null

  const mobileHeroQ = mobileHeroQuestionId
    ? chapterQuestions.find((q) => q.id === mobileHeroQuestionId) ?? chapterQuestions[0]
    : chapterQuestions[0]

  useEffect(() => {
    if (!isMobile || !mobileBentoSheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isMobile, mobileBentoSheetOpen])

  useEffect(() => {
    if (!mobileBentoSheetOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileBentoSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileBentoSheetOpen])

  const mm = (v: number) => Math.round(v * 1.6)

  const previewPages = usePreviewPages()
  const totalMobileSpreads = Math.max(1, Math.ceil(previewPages.length / 2))
  const mobilePreviewWidth = useMobileViewportWidth(showPreview && isMobile)
  const mobilePreviewScale =
    mobilePreviewWidth != null ? Math.min(1, (mobilePreviewWidth - 32) / (mm(148) * 2 + 8)) : 1

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[color:var(--bg-page)]">
        <p className="text-[13px] font-medium text-[color:var(--text-muted)]">Жүктелуде...</p>
      </div>
    )

  // ─── Shared section renderers ──────────────────────────────────────────────

  const algySozSection = (
    <div className="rounded-[20px] bg-[color:var(--surface)] p-6 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
      <h2 className="font-serif-display text-[1.2rem] font-semibold tracking-tight text-[color:var(--text-primary)]">Алғы сөз</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--text-muted)]">
        Кітаптың басында көрінеді. Өз сөздеріңізбен жазыңыз.
      </p>
      {!clientReadOnly && (
        <div className="my-5 max-w-md rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Өлшем</p>
          <SegmentedControl
            fullWidth
            value={(Number(algyEffectivePreset) > 20 ? '20' : algyEffectivePreset) as AnswerFontPreset}
            onChange={(v) => {
              const p = v as AnswerFontPreset
              setSectionFontPresetOverride('algy', p === sectionInheritPreset ? null : p)
            }}
            options={SECTION_FONT_PRESETS.map((px) => ({ value: px, label: px }))}
          />
        </div>
      )}
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <AnswerRichTextEditor
          key="algy_soz"
          valueHtml={normalizeAnswerToHtml(algy_soz)}
          onChangeHtml={(h) => !clientReadOnly && setAlgySoz(h)}
          disabled={clientReadOnly}
          placeholder="Бұл кітапты жазуға не шабыттандырды?..."
          textAlign={answerTextAlign}
          fontSizePx={answerPresetToUiPx(clampFontPresetToSectionMax(algyEffectivePreset))}
          minHeightPx={280}
          onNavigatePreview={() => setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'algy' }))}
          aiEnabled={clientAiFeaturesEnabled}
          aiSource="algy"
          aiOrderId={orderId}
          aiBlockKey="algy"
        />
      </div>
    </div>
  )

  const faktilerSection = showFaktilerNav ? (
    <div className="rounded-[20px] bg-[color:var(--surface)] p-6 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] md:mx-auto md:max-w-xl md:p-8">
      <h2 className="font-serif-display text-[1.2rem] font-semibold tracking-tight text-[color:var(--text-primary)]">Фактілер</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--text-muted)]">
        Әр факт — мәтін беті + толық бет фотосы.
      </p>
      <div className="mt-6">
        <FaktilerFactsEditor
          disabled={clientReadOnly}
          photosLocked={clientReadOnly}
          orderId={orderId}
          previewPages={previewPages}
          onUploadFaktilerPhoto={(i, f) => void uploadFaktilerPhoto(i, f)}
          variant="client"
          clientAiEnabled={clientAiFeaturesEnabled}
          trialLocked={trialMode}
        />
      </div>
    </div>
  ) : null

  const hatSection = (
    <div className="relative rounded-[20px] bg-[color:var(--surface)] p-6 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
      <h2 className="font-serif-display text-[1.2rem] font-semibold tracking-tight text-[color:var(--text-primary)]">Хат</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--text-muted)]">
        Кітаптың соңында көрінеді. Алушыға жеке хат жазыңыз.
      </p>
      {!clientReadOnly && (
        <div className="my-5 max-w-md rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Өлшем</p>
          <SegmentedControl
            fullWidth
            value={(Number(hatEffectivePreset) > 20 ? '20' : hatEffectivePreset) as AnswerFontPreset}
            onChange={(v) => {
              const p = v as AnswerFontPreset
              setSectionFontPresetOverride('hat', p === sectionInheritPreset ? null : p)
            }}
            options={SECTION_FONT_PRESETS.map((px) => ({ value: px, label: px }))}
          />
        </div>
      )}
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <AnswerRichTextEditor
          key="hat_text"
          valueHtml={normalizeAnswerToHtml(hat_text)}
          onChangeHtml={(h) => !clientReadOnly && setHatText(h)}
          disabled={clientReadOnly}
          placeholder="Сізге арнаған хатым..."
          textAlign={answerTextAlign}
          fontSizePx={answerPresetToUiPx(clampFontPresetToSectionMax(hatEffectivePreset))}
          minHeightPx={280}
          onNavigatePreview={() => setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'hat' }))}
          aiEnabled={clientAiFeaturesEnabled}
          aiSource="hat"
          aiOrderId={orderId}
          aiBlockKey="hat"
        />
      </div>
      {trialMode ? <TrialLockedOverlay className="rounded-[14px]" /> : null}
    </div>
  )

  // ─── Mobile sheet content ──────────────────────────────────────────────────

  const mobileSheetChapterPills = (
    <>
      <section>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Кітап бөліктері</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'algy_soz' as const, label: 'Алғы сөз', hasContent: !!algy_soz?.trim() },
            ...chapters.filter((ch) => ch.part_kind !== 'faktiler').map((ch) => {
              const tabActive = activeChapterId === ch.id && !activeSpecial
              const chAns = (ch.questions || []).filter((q: any) => !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')).length
              const chTotal = (ch.questions || []).length
              return { key: ch.id, label: ch.title_kk, isChapter: true, tabActive, chAns, chTotal, ch }
            }),
            ...(showFaktilerNav ? [{ key: 'faktiler' as const, label: 'Фактілер', hasContent: faktilerFactsHaveAnyContent(faktiler_facts) }] : []),
            { key: 'hat' as const, label: 'Хат', hasContent: !!hat_text?.trim() },
          ].map((item) => {
            const isChapter = 'isChapter' in item && item.isChapter
            const isActive = isChapter
              ? (item as any).tabActive
              : activeSpecial === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (isChapter) {
                    switchChapter((item as any).ch.id)
                  } else {
                    const k = item.key as 'algy_soz' | 'faktiler' | 'hat'
                    if (activeSpecial === k) setActiveSpecial(null)
                    else {
                      setActiveSpecial(k)
                      const target = k === 'algy_soz' ? { kind: 'algy' as const } : k === 'hat' ? { kind: 'hat' as const } : { kind: 'faktiler' as const }
                      setSpreadIndex(spreadIndexForPreviewTarget(previewPages, target))
                    }
                  }
                  setMobileBentoSheetOpen(false)
                }}
                className={clsx(
                  'relative inline-flex min-h-11 shrink-0 items-center justify-center rounded-[14px] px-3.5 text-[12px] font-semibold transition-colors touch-manipulation',
                  isActive
                    ? 'bg-[color:var(--accent)] text-white shadow-[var(--shadow-sm)]'
                    : 'border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)]'
                )}
              >
                {item.label}
                {isChapter && (item as any).chTotal > 0 && !isActive && (
                  <span className="ml-1.5 text-[10px] font-medium tabular-nums opacity-60">
                    {(item as any).chAns}/{(item as any).chTotal}
                  </span>
                )}
                {!isChapter && (item as any).hasContent && !isActive && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500" />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {!activeSpecial && currentChapter && chapterQuestions.length > 0 ? (
        <section>
          <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Сұраққа өту</h3>
          <div className="flex flex-wrap gap-2">
            {chapterQuestions.map((q: any, i: number) => {
              const isHero = mobileHeroQuestionId === q.id
              const isDone = !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => { setMobileFocusedQuestionId(q.id); setMobileBentoSheetOpen(false) }}
                  className={clsx(
                    'relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-[14px] text-[13px] font-semibold tabular-nums transition-colors touch-manipulation',
                    isHero
                      ? 'bg-[color:var(--accent)] text-white shadow-[var(--shadow-sm)]'
                      : 'border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)]'
                  )}
                >
                  {i + 1}
                  {isDone && !isHero && (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Баптаулар</h3>
        <div className="overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
          <EditorDashboardSettingsDeck
            disabled={clientReadOnly}
            trialMode={trialMode}
            showCoverPanel={!clientReadOnly}
            hasFixedChapterPhrases={hasFixedChapterPhrases}
            uploadFixedChapterPhoto={uploadFixedChapterPhoto}
            uploadAdminCoverPrint={uploadAdminCoverPrint}
            order={order as Order | null}
            defaultCollapsed={false}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Ақпарат</h3>
        <Button
          type="button" variant="secondary" fullWidth
          className="min-h-12 rounded-[14px] text-[13px] font-semibold"
          onClick={() => { setShowRules(true); setMobileBentoSheetOpen(false) }}
        >
          Маңызды ережелер мен кеңестер
        </Button>
      </section>
    </>
  )

  // ─── Sidebar chapter nav (desktop) ────────────────────────────────────────

  const desktopSidebar = (
    <aside className="flex w-[192px] shrink-0 flex-col gap-2 overflow-hidden p-3 pr-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-[color:var(--surface)] p-2 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="shrink-0 border-b border-[color:var(--border)] pb-2 pt-1">
          <button
            type="button"
            onClick={() => { setActiveSpecial(activeSpecial === 'algy_soz' ? null : 'algy_soz'); if (activeSpecial !== 'algy_soz') setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'algy' })) }}
            className={clsx(
              'mb-0.5 flex w-full cursor-pointer items-center justify-between rounded-[14px] border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors',
              activeSpecial === 'algy_soz' ? 'border-[color:var(--accent)] bg-[color:var(--accent-surface)]' : 'border-transparent hover:bg-[color:var(--surface-subtle)]'
            )}
          >
            <span className={clsx('text-[12px] tracking-tight', activeSpecial === 'algy_soz' ? 'font-semibold text-[color:var(--accent)]' : 'font-medium text-[color:var(--text-secondary)]')}>
              Алғы сөз
            </span>
            {algy_soz?.trim() && activeSpecial !== 'algy_soz' ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden /> : null}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <div className="mb-1.5 px-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Тараулар</div>
          {chapters.filter((ch) => ch.part_kind !== 'faktiler').map((ch) => {
            const chAns = (ch.questions || []).filter((q: any) => !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')).length
            const chTotal = (ch.questions || []).length
            const isActive = activeChapterId === ch.id && !activeSpecial
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => switchChapter(ch.id)}
                className={clsx(
                  'mb-0.5 w-full cursor-pointer rounded-[14px] border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors',
                  isActive
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-surface)]'
                    : 'border-transparent hover:bg-[color:var(--surface-subtle)]'
                )}
              >
                <div className={clsx('mb-0.5 text-[12px] tracking-tight', isActive ? 'font-semibold text-[color:var(--accent)]' : 'font-medium text-[color:var(--text-secondary)]')}>
                  {ch.title_kk}
                </div>
                {chTotal > 0 ? (
                  <div className="text-[10px] font-medium tabular-nums text-[color:var(--text-muted)]">{chAns}/{chTotal}</div>
                ) : null}
              </button>
            )
          })}

          {showFaktilerNav ? (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => { const k: 'faktiler' = 'faktiler'; setActiveSpecial(activeSpecial === k ? null : k); if (activeSpecial !== k) setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: k })) }}
                className={clsx(
                  'mb-0.5 flex w-full cursor-pointer items-center justify-between rounded-[14px] border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors',
                  activeSpecial === 'faktiler' ? 'border-[color:var(--accent)] bg-[color:var(--accent-surface)]' : 'border-transparent hover:bg-[color:var(--surface-subtle)]'
                )}
              >
                <span className={clsx('text-[12px] tracking-tight', activeSpecial === 'faktiler' ? 'font-semibold text-[color:var(--accent)]' : 'font-medium text-[color:var(--text-secondary)]')}>Фактілер</span>
                {faktilerFactsHaveAnyContent(faktiler_facts) && activeSpecial !== 'faktiler' ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden /> : null}
              </button>
            </div>
          ) : null}

          <div className="mt-2 border-t border-[color:var(--border)] pt-2">
            <button
              type="button"
              onClick={() => { setActiveSpecial(activeSpecial === 'hat' ? null : 'hat'); if (activeSpecial !== 'hat') setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'hat' })) }}
              className={clsx(
                'mb-0.5 flex w-full cursor-pointer items-center justify-between rounded-[14px] border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors',
                activeSpecial === 'hat' ? 'border-[color:var(--accent)] bg-[color:var(--accent-surface)]' : 'border-transparent hover:bg-[color:var(--surface-subtle)]'
              )}
            >
              <span className={clsx('text-[12px] tracking-tight', activeSpecial === 'hat' ? 'font-semibold text-[color:var(--accent)]' : 'font-medium text-[color:var(--text-secondary)]')}>Хат</span>
              {hat_text?.trim() && activeSpecial !== 'hat' ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden /> : null}
            </button>
          </div>
        </div>
      </div>
    </aside>
  )

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Book info modal */}
      {showBookInfoModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-[24px] bg-[color:var(--surface)] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.18)] md:p-10">
            <h2 className="text-[1.3rem] font-bold tracking-tight text-[color:var(--text-primary)]">Кітап туралы</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-muted)]">
              Бастамас бұрын негізгі мәліметтерді толтырыңыз.
            </p>
            <form
              className="mt-7 flex flex-col gap-5"
              onSubmit={async e => {
                e.preventDefault()
                if (!bookInfoForm.book_title || !bookInfoForm.recipient_name) return
                setSavingBookInfo(true)
                await saveBookInfo(bookInfoForm)
                setSavingBookInfo(false)
                localStorage.setItem(`book_info_${orderId}`, 'done')
                setShowBookInfoModal(false)
                setShowRules(true)
              }}
            >
              {[
                { field: 'book_title' as const, label: 'Кітаптың атауы', placeholder: 'Анама арналған кітап', required: true },
                { field: 'author_name' as const, label: 'Авторы', placeholder: 'Сіздің атыңыз', required: true },
                { field: 'recipient_name' as const, label: 'Кімге арналған', placeholder: 'Алушының аты', required: true },
                { field: 'city' as const, label: 'Қала', placeholder: 'Алматы', required: false },
                { field: 'delivery_address' as const, label: 'Жеткізу мекенжайы', placeholder: 'Абай к-сі 1/2, пәтер 5', required: false },
              ].map(({ field, label, placeholder, required }, idx) => (
                <div key={field}>
                  {idx === 3 && <div className="mb-5 h-px bg-[color:var(--border)]" />}
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">{label}</label>
                  <input
                    value={bookInfoForm[field]}
                    onChange={e => setBookInfoForm(f => ({ ...f, [field]: e.target.value }))}
                    required={required}
                    placeholder={placeholder}
                    style={inputStyle}
                  />
                </div>
              ))}
              <Button type="submit" variant="primary" fullWidth className="mt-1" disabled={savingBookInfo}>
                {savingBookInfo ? 'Сақталуда...' : 'Жалғастыру →'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-[24px] bg-[color:var(--surface)] p-7 shadow-[0_24px_60px_rgba(0,0,0,0.18)] md:p-10">
            <h2 className="text-[1.3rem] font-bold tracking-tight text-[color:var(--text-primary)]">Маңызды ақпарат</h2>
            <ul className="mt-6 flex list-none flex-col gap-4">
              {RULES.map((rule, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-surface)] text-[11px] font-bold text-[color:var(--accent)] ring-1 ring-inset ring-[color:var(--accent-ring)]">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-medium leading-relaxed text-[color:var(--text-secondary)]">{rule}</span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="primary" fullWidth className="mt-8" onClick={() => setShowRules(false)}>
              Түсіндім, бастаймын →
            </Button>
          </div>
        </div>
      )}

      {/* Mobile: full-screen preview overlay */}
      {showPreview && isMobile && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-gradient-to-b from-[#1c1512] via-[#231a16] to-[#130f0d]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-black/25 px-4 py-3 backdrop-blur-md pt-[max(10px,env(safe-area-inset-top))]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8d5cf]/90">Алдын ала қарау</p>
            <Button type="button" variant="secondary" size="sm"
              className="min-h-11 gap-2 border-white/20 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setShowPreview(false)}
            >
              <IconX className="size-4 shrink-0" /> Жабу
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="w-full max-w-[min(100%,420px)] rounded-2xl border border-[#521d1d]/35 bg-gradient-to-b from-[#2a1f1c]/90 to-[#1a1412]/95 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
              <div className="flex w-full justify-center gap-0.5"
                style={{ transform: `scale(${mobilePreviewScale})`, transformOrigin: 'top center' }}
              >
                <TrialPreviewBlurWrap page={previewPages[spreadIndex * 2] ?? null} trialMode={trialMode} flatQuestions={flatQuestions} customPages={customPages}>
                  <BookPagePreview page={previewPages[spreadIndex * 2] ?? null} pageNum={spreadIndex * 2 + 1} bookTitle={(order as any)?.book_title || ''} isLeft={true} />
                </TrialPreviewBlurWrap>
                <TrialPreviewBlurWrap page={previewPages[spreadIndex * 2 + 1] ?? null} trialMode={trialMode} flatQuestions={flatQuestions} customPages={customPages}>
                  <BookPagePreview page={previewPages[spreadIndex * 2 + 1] ?? null} pageNum={spreadIndex * 2 + 2} bookTitle={(order as any)?.book_title || ''} isLeft={false} />
                </TrialPreviewBlurWrap>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-2 backdrop-blur-sm">
              <Button type="button" variant="secondary" size="sm"
                className="min-h-11 min-w-11 rounded-full border-white/15 bg-white/10 px-0 text-white hover:bg-white/18 disabled:opacity-35"
                disabled={spreadIndex === 0} onClick={() => setSpreadIndex(Math.max(0, spreadIndex - 1))} aria-label="Алдыңғы"
              >←</Button>
              <span className="min-w-[8rem] text-center text-[13px] font-semibold tabular-nums text-[#f5ebe8]">
                {spreadIndex * 2 + 1}–{spreadIndex * 2 + 2} <span className="font-normal text-[#c4b4ae]">/ {previewPages.length}</span>
              </span>
              <Button type="button" variant="secondary" size="sm"
                className="min-h-11 min-w-11 rounded-full border-white/15 bg-white/10 px-0 text-white hover:bg-white/18 disabled:opacity-35"
                disabled={spreadIndex >= totalMobileSpreads - 1} onClick={() => setSpreadIndex(Math.min(totalMobileSpreads - 1, spreadIndex + 1))} aria-label="Келесі"
              >→</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="flex h-dvh flex-col bg-[color:var(--bg-page)]">

        {/* Shared top header */}
        <EditorHeader
          onSave={autoSave}
          onComplete={completeOrder}
          isCompleted={clientReadOnly}
          trialLockedClient={trialMode && !clientReadOnly}
          editableBookTitle={!clientReadOnly}
          onCommitBookTitle={(t) => void patchOrder({ book_title: t })}
        />

        {/* Read-only / status banners */}
        {trialMode && !clientReadOnly && isMobile ? (
          <div className="shrink-0 border-b border-amber-900/14 bg-amber-50/95 px-4 py-2">
            <p className="text-[11px] font-medium leading-snug text-amber-900">{TRIAL_BANNER_KK}</p>
          </div>
        ) : null}
        {clientReadOnly && (
          <div className="shrink-0 border-b border-emerald-900/10 bg-emerald-50 px-6 py-2.5 text-center text-[12px] font-semibold text-emerald-950">
            {(order as Order)?.status === 'checking'
              ? 'Кітап тексерілуге жіберілді — тек қарау режимі.'
              : 'Тек қарау режимі. Тараулар арасында қозғала аласыз.'}
          </div>
        )}

        {/* ─────────────── MOBILE BENTO ─────────────── */}
        {isMobile ? (
          <>
            {/* Chapter/question context strip */}
            {currentChapter && !activeSpecial && (
              <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-tight text-[color:var(--text-secondary)]">
                    {currentChapter.title_kk}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums text-[color:var(--text-muted)]">
                    {mobileHeroIndex + 1}&thinsp;/&thinsp;{chapterQuestions.length}
                  </span>
                </div>
              </div>
            )}
            {activeSpecial && (
              <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5">
                <span className="text-[11px] font-semibold tracking-tight text-[color:var(--text-secondary)]">
                  {activeSpecial === 'algy_soz' ? 'Алғы сөз' : activeSpecial === 'faktiler' ? 'Фактілер' : 'Хат'}
                </span>
              </div>
            )}

            {/* Hero content area — fills remaining height */}
            <main className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
              <div className="flex flex-col gap-3 pb-1">
                {/* Special sections */}
                {activeSpecial === 'algy_soz' && algySozSection}
                {activeSpecial === 'faktiler' && faktilerSection}
                {activeSpecial === 'hat' && hatSection}

                {/* Chapter questions — hero single card */}
                {!activeSpecial && currentChapter && mobileHeroQ && (() => {
                  const q = mobileHeroQ
                  const qi = questionIndexById.get(q.id) ?? -1
                  const qTrialLocked = trialMode && qi >= TRIAL_FREE_QUESTION_COUNT
                  const qCustomPages = getCustomPagesInQuestionSlot(q.id, flatQuestions, questionIndexById, customPages)

                  return (
                    // Hero bento card — white, deep shadow, no border
                    <div
                      className="overflow-hidden rounded-[22px] bg-[color:var(--surface)]"
                      style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.06), 0 20px 48px rgba(15,23,42,0.12)' }}
                    >
                      <QuestionCard
                        question={q}
                        orderId={orderId}
                        disabled={clientReadOnly}
                        photosReadOnly={clientReadOnly}
                        aiEnabled={clientAiFeaturesEnabled}
                        trialLocked={qTrialLocked}
                        emphasizePrompt
                        flat
                        textEditorMinHeightPx={320}
                        shellClassName="rounded-none"
                        onPreviewNavigate={() =>
                          setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'question', questionId: q.id }))
                        }
                      />
                      {qCustomPages.length > 0 && (
                        <div className="border-t border-[color:var(--border)] px-4 py-3 space-y-3">
                          {qCustomPages.map((cp: CustomPage, idx: number) => (
                            <CustomPageCard
                              key={cp.id}
                              cp={cp}
                              orderId={orderId}
                              categoryId={categoryId}
                              onUpdate={updateCustomPage}
                              onDelete={deleteCustomPage}
                              onUpload={uploadPhoto}
                              currentPhotos={splitStoredPhotoPipeList(cp.photo_path)}
                              openCardId={openCardId}
                              onToggle={setOpenCardId}
                              disabled={clientReadOnly}
                              photosLocked={clientReadOnly}
                              aiEnabled={clientAiFeaturesEnabled}
                              trialLocked={qTrialLocked}
                              bookFontPreset={answerFontPreset}
                              textAlign={answerTextAlign === 'left' ? 'left' : 'justify'}
                              moveUpDisabled={idx === 0}
                              moveDownDisabled={idx === qCustomPages.length - 1}
                              onMove={(dir) => moveCustomPage(cp.id, dir)}
                              usedPhrases={customPages.filter((o) => o.id !== cp.id && o.overlay_text).map((o) => o.overlay_text!)}
                              blockedPhraseIds={[
                                ...chapters.flatMap((c) => (c.fixed_phrase_id ? [String(c.fixed_phrase_id)] : [])),
                                ...customPages.filter((o) => o.id !== cp.id && o.selected_phrase_id).map((o) => String(o.selected_phrase_id)),
                              ]}
                              onNavigatePreview={() =>
                                setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'custom', customPageId: cp.id }))
                              }
                            />
                          ))}
                        </div>
                      )}
                      {!clientReadOnly && !qTrialLocked && <AddPageButton questionId={q.id} onAdd={addCustomPage} />}
                    </div>
                  )
                })()}
              </div>
            </main>

            {/* Mobile bottom navigation bar */}
            <nav
              className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)]"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {!activeSpecial && currentChapter ? (
                // Question prev/next nav
                <div className="flex items-center gap-1 px-3 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (mobilePrevQ) {
                        setMobileFocusedQuestionId(mobilePrevQ.id)
                      } else if (mobilePrevChapter) {
                        switchChapter(mobilePrevChapter.id)
                      }
                    }}
                    disabled={!mobilePrevQ && !mobilePrevChapter}
                    className="inline-flex min-h-11 min-w-[4.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[13px] font-semibold text-[color:var(--text-secondary)] transition-colors touch-manipulation hover:bg-[color:var(--surface)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
                  >
                    ← {mobilePrevQ ? '' : (mobilePrevChapter ? 'Алд.' : '')}
                  </button>

                  {/* Progress dots */}
                  <div className="flex flex-1 items-center justify-center gap-1.5 px-1">
                    {chapterQuestions.length <= 12 ? (
                      chapterQuestions.map((q: any, i: number) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setMobileFocusedQuestionId(q.id)}
                          className={clsx(
                            'rounded-full transition-all touch-manipulation',
                            i === mobileHeroIndex
                              ? 'h-2 w-4 bg-[color:var(--accent)]'
                              : !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')
                                ? 'size-1.5 bg-emerald-500/60'
                                : 'size-1.5 bg-[color:var(--text-muted)]/25'
                          )}
                          aria-label={`Сұрақ ${i + 1}`}
                        />
                      ))
                    ) : (
                      <span className="text-[12px] font-semibold tabular-nums text-[color:var(--text-muted)]">
                        {mobileHeroIndex + 1} / {chapterQuestions.length}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (mobileNextQ) {
                        setMobileFocusedQuestionId(mobileNextQ.id)
                      } else if (mobileNextChapter) {
                        if (!clientReadOnly) await autoSave()
                        switchChapter(mobileNextChapter.id)
                      }
                    }}
                    disabled={!mobileNextQ && !mobileNextChapter}
                    className="inline-flex min-h-11 min-w-[4.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-[12px] bg-[color:var(--accent)] text-[13px] font-semibold text-white transition-colors touch-manipulation hover:bg-[color:var(--accent-hover)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
                  >
                    {mobileNextQ ? '' : (mobileNextChapter ? 'Кел.' : '')} →
                  </button>
                </div>
              ) : (
                // Special section back bar
                <div className="flex items-center justify-between px-3 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveSpecial(null)}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 text-[13px] font-semibold text-[color:var(--text-secondary)] touch-manipulation"
                  >
                    ← Тараулар
                  </button>
                  <span className="text-[11px] font-medium text-[color:var(--text-muted)]">
                    {activeSpecial === 'algy_soz' ? 'Алғы сөз' : activeSpecial === 'faktiler' ? 'Фактілер' : 'Хат'}
                  </span>
                </div>
              )}
            </nav>
          </>
        ) : (
          // ─────────────── DESKTOP BENTO ───────────────
          <>
            {/* Settings strip */}
            <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 md:px-8">
              <div className="mx-auto max-w-[900px]">
                <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-sm)]">
                  <EditorDashboardSettingsDeck
                    disabled={clientReadOnly}
                    trialMode={trialMode}
                    showCoverPanel={!clientReadOnly}
                    hasFixedChapterPhrases={hasFixedChapterPhrases}
                    uploadFixedChapterPhoto={uploadFixedChapterPhoto}
                    uploadAdminCoverPrint={uploadAdminCoverPrint}
                    order={order as Order | null}
                    defaultCollapsed={trialMode}
                  />
                </div>
                {trialMode && !clientReadOnly ? (
                  <div className="mt-2 rounded-[14px] border border-amber-900/15 bg-amber-50/90 px-4 py-2.5 text-[12px] font-medium text-amber-900">
                    {TRIAL_BANNER_KK}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {desktopSidebar}

              {/* Center scroll area */}
              <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
                <div className="mx-auto flex w-full max-w-[min(100%,680px)] flex-col gap-4">

                  {activeSpecial === 'algy_soz' && algySozSection}
                  {activeSpecial === 'faktiler' && showFaktilerNav && faktilerSection}
                  {activeSpecial === 'hat' && hatSection}

                  {!activeSpecial && currentChapter && (
                    <>
                      {/* Chapter title bento */}
                      <div className="rounded-[18px] bg-[color:var(--surface)] px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
                        <h2 className="text-[1.05rem] font-bold tracking-tight text-[color:var(--text-primary)]">
                          {currentChapter.title_kk}
                        </h2>
                        <p className="mt-0.5 text-[12px] font-medium text-[color:var(--text-muted)]">
                          {(currentChapter.questions || []).length} сұрақ
                        </p>
                      </div>

                      {/* Question cards */}
                      <div className="flex flex-col gap-3">
                        {(currentChapter.questions || []).map((q: any, rowIndex: number) => {
                          const qi = questionIndexById.get(q.id) ?? -1
                          const qTrialLocked = trialMode && qi >= TRIAL_FREE_QUESTION_COUNT
                          const qCustomPages = getCustomPagesInQuestionSlot(q.id, flatQuestions, questionIndexById, customPages)
                          const isHero = rowIndex === 0

                          return (
                            <div
                              key={q.id}
                              className={clsx(
                                'overflow-hidden rounded-[20px] bg-[color:var(--surface)] transition-shadow',
                                isHero
                                  ? 'ring-1 ring-[color:var(--accent-ring)]'
                                  : ''
                              )}
                              style={{
                                boxShadow: isHero
                                  ? '0 2px 8px rgba(15,23,42,0.07), 0 16px 40px rgba(15,23,42,0.09)'
                                  : '0 1px 3px rgba(15,23,42,0.05), 0 4px 12px rgba(15,23,42,0.05)',
                              }}
                            >
                              <QuestionCard
                                question={q}
                                orderId={orderId}
                                disabled={clientReadOnly}
                                photosReadOnly={clientReadOnly}
                                aiEnabled={clientAiFeaturesEnabled}
                                trialLocked={qTrialLocked}
                                emphasizePrompt={isHero}
                                flat
                                textEditorMinHeightPx={isHero ? 240 : undefined}
                                shellClassName="rounded-none"
                                onPreviewNavigate={() =>
                                  setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'question', questionId: q.id }))
                                }
                              />
                              {(qCustomPages.length > 0 || (!clientReadOnly && !qTrialLocked)) && (
                                <div className="border-t border-[color:var(--border)] px-1 pb-2 pt-1 space-y-2">
                                  {qCustomPages.map((cp: CustomPage, idx: number) => (
                                    <CustomPageCard
                                      key={cp.id}
                                      cp={cp}
                                      orderId={orderId}
                                      categoryId={categoryId}
                                      onUpdate={updateCustomPage}
                                      onDelete={deleteCustomPage}
                                      onUpload={uploadPhoto}
                                      currentPhotos={splitStoredPhotoPipeList(cp.photo_path)}
                                      openCardId={openCardId}
                                      onToggle={setOpenCardId}
                                      disabled={clientReadOnly}
                                      photosLocked={clientReadOnly}
                                      aiEnabled={clientAiFeaturesEnabled}
                                      trialLocked={qTrialLocked}
                                      bookFontPreset={answerFontPreset}
                                      textAlign={answerTextAlign === 'left' ? 'left' : 'justify'}
                                      moveUpDisabled={idx === 0}
                                      moveDownDisabled={idx === qCustomPages.length - 1}
                                      onMove={(dir) => moveCustomPage(cp.id, dir)}
                                      usedPhrases={customPages.filter((o) => o.id !== cp.id && o.overlay_text).map((o) => o.overlay_text!)}
                                      blockedPhraseIds={[
                                        ...chapters.flatMap((c) => (c.fixed_phrase_id ? [String(c.fixed_phrase_id)] : [])),
                                        ...customPages.filter((o) => o.id !== cp.id && o.selected_phrase_id).map((o) => String(o.selected_phrase_id)),
                                      ]}
                                      onNavigatePreview={() =>
                                        setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'custom', customPageId: cp.id }))
                                      }
                                    />
                                  ))}
                                  {!clientReadOnly && !qTrialLocked && (
                                    <AddPageButton questionId={q.id} onAdd={addCustomPage} />
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Chapter navigation bento */}
                      <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[color:var(--surface)] px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
                        <div>
                          {chapterIndex > 0 ? (
                            <Button type="button" variant="secondary"
                              onClick={() => switchChapter(chapters[chapterIndex - 1].id)}
                            >
                              ← Алдыңғы
                            </Button>
                          ) : <span />}
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                          {chapterIndex + 1} / {chapters.filter(c => c.part_kind !== 'faktiler').length}
                        </p>
                        <div>
                          {chapterIndex < chapters.length - 1 ? (
                            <Button type="button" variant="primary"
                              onClick={async () => { if (!clientReadOnly) await autoSave(); switchChapter(chapters[chapterIndex + 1].id) }}
                            >
                              Келесі →
                            </Button>
                          ) : <span />}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: preview panel */}
              <SpreadPreview />
            </div>
          </>
        )}
      </div>

      {/* ── MOBILE SHEET + FABS ── */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <div
            role="presentation"
            aria-hidden={!mobileBentoSheetOpen}
            className={clsx(
              'fixed inset-0 z-[240] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300',
              mobileBentoSheetOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            )}
            onClick={() => setMobileBentoSheetOpen(false)}
          />

          {/* Bottom sheet */}
          <div
            className={clsx(
              'fixed inset-x-0 bottom-0 z-[250] flex max-h-[min(88dvh,860px)] flex-col rounded-t-[24px] bg-[color:var(--surface)] shadow-[0_-4px_32px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-[var(--easing-spring)] will-change-transform',
              mobileBentoSheetOpen ? 'translate-y-0' : 'translate-y-[108%]'
            )}
          >
            <div className="flex shrink-0 flex-col items-center border-b border-[color:var(--border)] px-4 pb-2 pt-3">
              <div className="mb-3 h-1 w-10 shrink-0 rounded-full bg-[color:var(--text-muted)]/25" aria-hidden />
              <div className="flex w-full items-center justify-between gap-3 pb-1">
                <p className="text-[15px] font-bold tracking-tight text-[color:var(--text-primary)]">Мәзір</p>
                <button
                  type="button"
                  onClick={() => setMobileBentoSheetOpen(false)}
                  className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-subtle)] touch-manipulation"
                >
                  <IconX className="size-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
              <div className="space-y-6 pb-4">{mobileSheetChapterPills}</div>
            </div>
          </div>

          {/* FABs — positioned above the bottom nav bar */}
          <button
            type="button"
            onClick={() => setMobileBentoSheetOpen(true)}
            className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom)+5rem)] left-4 z-[210] flex size-14 cursor-pointer items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--accent)] shadow-[0_4px_16px_rgba(15,23,42,0.12)] transition-transform duration-[var(--transition)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.14)] active:scale-[0.97] touch-manipulation"
            aria-label="Мәзірді ашу"
          >
            <IconRows className="size-6" />
          </button>

          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom)+5rem)] right-4 z-[210] flex size-14 cursor-pointer items-center justify-center rounded-full bg-[color:var(--accent)] text-white shadow-[0_4px_16px_rgba(115,22,22,0.3)] transition-transform duration-[var(--transition)] hover:bg-[color:var(--accent-hover)] active:scale-[0.97] touch-manipulation"
            aria-label="Алдын ала қарау"
          >
            <IconEye className="size-[22px]" />
          </button>
        </>
      )}
    </>
  )
}
