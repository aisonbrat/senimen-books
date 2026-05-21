'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEditorStore } from '@/lib/store/editorStore'
import { useEditorData } from '@/lib/hooks/useEditorData'
import { SpreadPreview } from '@/components/editor/SpreadPreview'
import { BookPagePreview } from '@/components/editor/BookPagePreview'
import { usePreviewPages } from '@/lib/hooks/usePreviewPages'
import { getCustomPagesInQuestionSlot } from '@/lib/utils/buildPreviewPages'
import { useMobileViewportWidth } from '@/lib/hooks/useMobileViewportWidth'
import type { CustomPage, Order, Question } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { IconEye, IconX } from '@/components/ui/icons'
import { EditorTypographyBar } from '@/components/editor/EditorTypographyBar'
import { CoverTitleTypographyBar } from '@/components/editor/CoverTitleTypographyBar'
import { ExportButton } from '@/components/editor/ExportButton'
import { FixedChapterBookSettingsPanel } from '@/components/editor/FixedChapterBookSettingsPanel'
import { CustomPageCard } from '@/components/editor/CustomPageCard'
import {
  answerPresetToUiPx,
  clampFontPresetToSectionMax,
  normalizeGlobalFontPreset,
  SECTION_FONT_PRESETS,
  type AnswerFontPreset,
} from '@/lib/bookLayout'
import { spreadIndexForPreviewTarget } from '@/lib/utils/previewNavigation'
import {
  answerPlainTextPreview,
  answerTextIsEffectivelyEmpty,
  normalizeAnswerToHtml,
  sanitizeAnswerHtmlFragment,
} from '@/lib/utils/answerHtml'
import { FaktilerFactsEditor } from '@/components/editor/FaktilerFactsEditor'
import { faktilerFactsHaveAnyContent } from '@/lib/utils/faktilerFacts'
import {
  answerDisplaysAsPhotoContent,
  splitPhotoAnswerRawSegments,
  splitPhotoAnswerToResolvedUrls,
  splitStoredPhotoPipeList,
} from '@/lib/utils/bookPhotoUrl'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'

const AnswerRichTextEditor = dynamic(
  () => import('@/components/editor/AnswerRichTextEditor').then((m) => m.AnswerRichTextEditor),
  { ssr: false, loading: () => <div style={{ minHeight: 220, borderRadius: 10, background: '#f4f4f3' }} /> }
)

/**
 * Editor-side question answer field. Uses the same rich TipTap editor as algy/hat/custom
 * so saved HTML (`<p>…</p>`) renders as formatted text instead of literal tags. The mobile
 * "peek" affordance and book-preview navigation are preserved.
 */
function EditorQuestionTextarea({
  question,
  questionId,
  orderId,
  isMobile,
  spreadIndexForQuestion,
  staffPhotosLocked,
}: {
  question: Pick<Question, 'id' | 'question_type'>
  questionId: string
  orderId: string
  isMobile: boolean
  /** Kept in the prop list for callsite parity; not used now that we render TipTap. */
  textAreaStyleFluid?: React.CSSProperties
  spreadIndexForQuestion: number
  staffPhotosLocked?: boolean
}) {
  const answer = useEditorStore((s) => s.answers[questionId] ?? '')
  const setAnswer = useEditorStore((s) => s.setAnswer)
  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const answerTextAlign = useEditorStore((s) => s.answerTextAlign)
  const setSpreadIndex = useEditorStore((s) => s.setSpreadIndex)

  const [mobilePeek, setMobilePeek] = useState(false)
  const has = !answerTextIsEffectivelyEmpty(answer)
  const plain = answerPlainTextPreview(answer)

  useEffect(() => {
    const a = useEditorStore.getState().answers[questionId] ?? ''
    setMobilePeek(isMobile && !answerTextIsEffectivelyEmpty(a))
  }, [questionId, isMobile])

  const onNavigatePreview = useCallback(() => {
    setSpreadIndex(spreadIndexForQuestion)
  }, [setSpreadIndex, spreadIndexForQuestion])

  const isPhotoQ =
    question.question_type === 'photo' || question.question_type === 'photo_with_text'
  if (staffPhotosLocked && isPhotoQ) {
    return <StaffPhotoAnswerReadOnly answer={answer} />
  }

  if (isMobile && has && mobilePeek) {
    return (
      <button
        type="button"
        onClick={() => setMobilePeek(false)}
        style={{
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 10,
          border: '0.5px solid #E8E8E6',
          background: '#FAFAF9',
          textAlign: 'left',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <div
          style={{
            maxHeight: '5.25rem',
            overflow: 'hidden',
            padding: '12px 14px',
            fontSize: 14,
            lineHeight: 1.55,
            color: '#5c4f4f',
            fontFamily: "'Cormorant', Georgia, serif",
          }}
        >
          {plain || '…'}
        </div>
        <div
          style={{
            borderTop: '0.5px solid #EEEAE8',
            padding: '8px 14px',
            fontSize: 11,
            fontWeight: 700,
            color: W,
            background: '#FAFAF9',
          }}
        >
          Жауапты ашу — өңдеу
        </div>
      </button>
    )
  }

  return (
    <>
      {isMobile && has ? (
        <div style={{ textAlign: 'right', marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setMobilePeek(true)}
            style={{ fontSize: 11, fontWeight: 700, color: W, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Жауапты жасыру (қысқа көрініс)
          </button>
        </div>
      ) : null}
      <AnswerRichTextEditor
        key={questionId}
        valueHtml={normalizeAnswerToHtml(answer)}
        onChangeHtml={(h) => setAnswer(questionId, h)}
        textAlign={answerTextAlign}
        fontSizePx={answerPresetToUiPx(answerFontPreset)}
        minHeightPx={isMobile ? 188 : 172}
        onNavigatePreview={onNavigatePreview}
        aiEnabled
        aiSource="answer"
        aiOrderId={orderId}
        aiBlockKey={`q:${questionId}`}
      />
    </>
  )
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  filling:   { label: 'Толтырылуда', color: '#2563EB', bg: '#EFF6FF' },
  checking:  { label: 'Тексеруде',   color: '#D97706', bg: '#FFFBEB' },
  completed: { label: 'Өңдеу аяқталды', color: '#059669', bg: '#ECFDF5' },
  design:    { label: 'Дизайнда',    color: '#7C3AED', bg: '#F5F3FF' },
  printing:  { label: 'Басылуда',    color: '#059669', bg: '#ECFDF5' },
  delivered: { label: 'Жеткізілді',  color: '#16A34A', bg: '#F0FDF4' },
}

const W = '#731616'

const textAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: 280, padding: '14px 16px', borderRadius: 10,
  border: '0.5px solid #E8E8E6', background: 'white', fontSize: 15, lineHeight: 1.6,
  fontFamily: "'Cormorant', Georgia, serif", resize: 'vertical', outline: 'none',
  boxSizing: 'border-box', color: '#1a1a1a',
}

/** Staff editor text-only mode: photo answers shown without edit/remove/upload. */
function StaffPhotoAnswerReadOnly({ answer }: { answer: string }) {
  if (answerDisplaysAsPhotoContent(answer)) {
    const urls = splitPhotoAnswerToResolvedUrls(answer)
    const rawSeg = splitPhotoAnswerRawSegments(answer)
    const refAt = (i: number) => rawSeg[i] || urls[i] || ''
    const n = urls.length
    if (n <= 1) {
      return (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '0.5px solid #E8E8E6' }}>
          <SignedBookPhotoImg
            storageRef={refAt(0)}
            alt=""
            style={{ display: 'block', maxHeight: 400, width: '100%', objectFit: 'cover' }}
          />
        </div>
      )
    }
    if (n === 2) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr', gap: 4, maxHeight: 400 }}>
          {urls.slice(0, 2).map((_, i) => (
            <div key={i} style={{ minHeight: 120, overflow: 'hidden', borderRadius: 8 }}>
              <SignedBookPhotoImg
                storageRef={refAt(i)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, maxHeight: 400 }}>
        {urls.slice(0, 4).map((_, i) => (
          <div key={i} style={{ aspectRatio: '1', overflow: 'hidden', borderRadius: 8 }}>
            <SignedBookPhotoImg storageRef={refAt(i)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div
      className="book-rich-root font-preview-book"
      style={{
        ...textAreaStyle,
        minHeight: 120,
        fontSize: 14,
        background: '#F9F6F6',
        color: '#7A6060',
        cursor: 'default',
        boxShadow: '0 1px 4px rgba(82,29,29,0.04)',
        fontWeight: 600,
        lineHeight: 1.55,
      }}
      dangerouslySetInnerHTML={{
        __html: sanitizeAnswerHtmlFragment(normalizeAnswerToHtml(answer)) || '<p style="color:#D4C4C4;margin:0">—</p>',
      }}
    />
  )
}

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
      <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: '0.5px solid #E8E8E6', background: 'white' }}>
        <span style={{ fontSize: 12, color: '#555', marginRight: 8 }}>Бет түрін таңдаңыз:</span>
        <Button size="sm" type="button" className="mr-2" onClick={() => { onAdd('custom_photo', questionId); setOpen(false) }}>Фото беті</Button>
        <Button size="sm" type="button" className="mr-2" onClick={() => { onAdd('custom_text', questionId); setOpen(false) }}>Мәтін беті</Button>
        <Button size="sm" type="button" className="mr-2" onClick={() => { onAdd('custom_poem', questionId); setOpen(false) }}>Өлең беті</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Жабу</Button>
      </div>
    )
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        width: '100%', marginBottom: 14, padding: '10px 0', borderRadius: 10,
        border: '1px dashed #E8E8E6', background: 'transparent', fontSize: 12, color: '#aaa', cursor: 'pointer',
      }}
    >
      + Бет қосу
    </button>
  )
}

export default function EditorViewPage() {
  const params = useParams()
  const orderId = params.orderId as string
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const mm = (v: number) => Math.round(v * 1.6)

  const [isMobile, setIsMobile] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [activeSpecial, setActiveSpecial] = useState<'algy_soz' | 'faktiler' | 'hat' | null>(null)
  const [completing, setCompleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [actorRole, setActorRole] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setActorRole(data?.role != null ? String(data.role).toLowerCase() : null)
    })
  }, [supabase])

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
  const editorSaving = useEditorStore((s) => s.saving)
  const spreadIndex = useEditorStore((s) => s.spreadIndex)
  const setSpreadIndex = useEditorStore((s) => s.setSpreadIndex)
  const editorSkippedChapterIds = useEditorStore((s) => s.editorSkippedChapterIds)
  const setChapterSkippedFromBook = useEditorStore((s) => s.setChapterSkippedFromBook)
  const textAreaStyleFluid = useMemo(
    () => ({
      ...textAreaStyle,
      fontSize: answerPresetToUiPx(answerFontPreset),
      textAlign: answerTextAlign === 'left' ? ('left' as const) : ('justify' as const),
      ...(answerTextAlign === 'justify' ? { textAlignLast: 'left' as const } : {}),
    }),
    [answerFontPreset, answerTextAlign]
  )
  const {
    autoSave,
    save,
    updateCustomPage,
    deleteCustomPage,
    uploadPhoto,
    uploadFaktilerPhoto,
    uploadFixedChapterPhoto,
    addCustomPage,
    moveCustomPage,
    completeEditing,
    assignEditor,
  } = useEditorData(orderId)

  const orderStatus = (order as any)?.status
  const editorDone = orderStatus === 'completed'
  const clientAiEnabled = (order as Order | null)?.client_ai_enabled === true
  const freezeEditing = editorDone || (actorRole === 'editor' && clientAiEnabled)
  const staffPhotosLocked = actorRole === 'editor' && !freezeEditing

  // Assign editor when they open a checking order (skip when editing is finished)
  useEffect(() => {
    if (!order || editorDone || orderStatus !== 'checking') return
    if (actorRole === 'editor' && clientAiEnabled) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const current = order as { assigned_editor?: string | null }
      if (!current.assigned_editor) {
        await assignEditor(user.id)
      }
    })
  }, [order, orderStatus, editorDone, assignEditor, actorRole, clientAiEnabled, supabase])

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
  const currentChapter = chapters.find((c) => c.id === activeChapterId && c.part_kind !== 'faktiler')
  const chapterIndex = chapters.findIndex(c => c.id === activeChapterId)
  const categoryId = (order as { category_id?: string } | null)?.category_id
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
    useEditorStore.getState().setActiveChapter(chapterId)
  }

  const previewPages = usePreviewPages()

  const totalMobileSpreads = Math.max(1, Math.ceil(previewPages.length / 2))

  const mobilePreviewWidth = useMobileViewportWidth(showPreview && isMobile)
  const mobilePreviewScale =
    mobilePreviewWidth != null ? Math.min(1, (mobilePreviewWidth - 32) / (mm(148) * 2 + 8)) : 1

  const handleManualSave = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault()
      e?.stopPropagation()
      void save({ manual: true })
    },
    [save],
  )

  if (loading) return (
    <div style={{ height: '100vh', background: '#F9F6F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: '#B8A8A8', fontWeight: 500 }}>Жүктелуде...</p>
    </div>
  )

  const saveStatus = editorSaving ? 'Сақталуда... · Saving...' : ''

  const sidebarBtn = (label: string, key: 'algy_soz' | 'faktiler' | 'hat', hasContent: boolean) => {
    const isActive = activeSpecial === key
    return (
      <button
        type="button"
        onClick={() => {
          if (freezeEditing) return
          if (isActive) {
            setActiveSpecial(null)
          } else {
            setActiveSpecial(key)
            const jump =
              key === 'algy_soz' ? { kind: 'algy' as const } : key === 'hat' ? { kind: 'hat' as const } : { kind: 'faktiler' as const }
            setSpreadIndex(spreadIndexForPreviewTarget(previewPages, jump))
          }
        }}
        style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 9, border: 'none', cursor: freezeEditing ? 'default' : 'pointer', marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)', background: isActive ? '#F5EDEC' : 'transparent', borderLeft: `2.5px solid ${isActive ? W : 'transparent'}` }}>
        <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? W : '#7A6060', letterSpacing: '-0.01em' }}>{label}</div>
        {hasContent && !isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />}
      </button>
    )
  }

  return (
    <>

      {/* Confirm complete modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: '600', color: '#0F0F0F', margin: '0 0 10px' }}>Өңдеуді аяқтау</h3>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 20px' }}>
              Өңдеу аяқталғаннан кейін кітап «Аяқталды» статусына өтеді. Жалғастырасыз ба?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '0.5px solid #E8E8E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#555' }}>
                Болдырмау
              </button>
              <button type="button" disabled={completing} onClick={async () => {
                setCompleting(true)
                try {
                  await completeEditing()
                  setShowConfirm(false)
                  window.location.href = '/editor-dashboard'
                } catch (err: any) {
                  alert('Қате: ' + (err?.message || 'Сақтау сәтсіз аяқталды'))
                } finally {
                  setCompleting(false)
                }
              }} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontSize: 13, fontWeight: '500', cursor: 'pointer', opacity: completing ? 0.7 : 1 }}>
                {completing ? 'Сақталуда...' : 'Растаймын, аяқтау'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile full-screen preview — match client dashboard editor chrome */}
      {showPreview && isMobile && (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-gradient-to-b from-[#1c1512] via-[#231a16] to-[#130f0d]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-black/25 px-4 py-3 backdrop-blur-md pt-[max(10px,env(safe-area-inset-top))]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8d5cf]/90">Алдын ала қарау</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 gap-2 border-white/20 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setShowPreview(false)}
            >
              <IconX className="size-4 shrink-0" />
              Жабу
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="w-full max-w-[min(100%,420px)] rounded-2xl border border-[#521d1d]/35 bg-gradient-to-b from-[#2a1f1c]/90 to-[#1a1412]/95 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06]">
              <div
                className="flex w-full justify-center gap-0.5"
                style={{ transform: `scale(${mobilePreviewScale})`, transformOrigin: 'top center' }}
              >
                <BookPagePreview page={previewPages[spreadIndex * 2] ?? null} pageNum={spreadIndex * 2 + 1} bookTitle={(order as any)?.book_title || ''} isLeft={true} />
                <BookPagePreview page={previewPages[spreadIndex * 2 + 1] ?? null} pageNum={spreadIndex * 2 + 2} bookTitle={(order as any)?.book_title || ''} isLeft={false} />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-2 backdrop-blur-sm">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 min-w-11 rounded-full border-white/15 bg-white/10 px-0 text-white hover:bg-white/18 disabled:opacity-35"
                disabled={spreadIndex === 0}
                onClick={() => setSpreadIndex(Math.max(0, spreadIndex - 1))}
                aria-label="Алдыңғы беттер"
              >
                ←
              </Button>
              <span className="min-w-[8.5rem] text-center text-[13px] font-semibold tabular-nums text-[#f5ebe8]">
                {spreadIndex * 2 + 1} – {spreadIndex * 2 + 2}{' '}
                <span className="font-normal text-[#c4b4ae]">/ {previewPages.length}</span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 min-w-11 rounded-full border-white/15 bg-white/10 px-0 text-white hover:bg-white/18 disabled:opacity-35"
                disabled={spreadIndex >= totalMobileSpreads - 1}
                onClick={() => setSpreadIndex(Math.min(totalMobileSpreads - 1, spreadIndex + 1))}
                aria-label="Келесі беттер"
              >
                →
              </Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '100vh', background: '#F9F6F6', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          background: 'white', minHeight: isMobile ? 52 : 64, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: isMobile ? '0 14px' : '0 24px', flexShrink: 0,
          boxShadow: '0 1px 0 rgba(82,29,29,0.06), 0 4px 20px rgba(82,29,29,0.05)',
          zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={() => {
                if (!freezeEditing) void save()
                router.push('/editor-dashboard')
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#B8A8A8', padding: '4px 0', fontWeight: 600, transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)' }}
              onMouseEnter={e => (e.currentTarget.style.color = W)}
              onMouseLeave={e => (e.currentTarget.style.color = '#B8A8A8')}>
              ← Артқа
            </button>
            <div style={{ width: 1, height: 18, background: '#EDE6E6' }} />
            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#1C1010', letterSpacing: '-0.01em', maxWidth: isMobile ? '42vw' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(order as any)?.book_title}</span>
            {!isMobile && (
              <span style={{ fontSize: 10, background: 'rgba(124,58,237,0.08)', color: '#7C3AED', borderRadius: 6, padding: '3px 9px', fontWeight: 800, letterSpacing: '0.08em' }}>РЕДАКТОР</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#C0B0B0', fontWeight: 500 }} aria-live="polite" aria-busy={editorSaving}>
              {saveStatus}
            </span>
            {editorDone ? (
              <span style={{ fontSize: 11, color: '#059669', background: '#ECFDF5', borderRadius: 8, padding: '5px 14px', fontWeight: 700 }}>Өңдеу аяқталды</span>
            ) : freezeEditing ? (
              <span style={{ fontSize: 11, color: '#1D4ED8', background: '#EFF6FF', borderRadius: 8, padding: '5px 14px', fontWeight: 700 }}>
                Тек оқу (клиент AI)
              </span>
            ) : (
              <>
                <ExportButton beforeExport={save} />
                <button
                  type="button"
                  disabled={editorSaving}
                  onClick={handleManualSave}
                  style={{
                    background: 'white',
                    color: W,
                    border: '1.5px solid rgba(82,29,29,0.18)',
                    borderRadius: 10,
                    padding: '7px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: editorSaving ? 'wait' : 'pointer',
                    opacity: editorSaving ? 0.65 : 1,
                    transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F5EDEC'; e.currentTarget.style.borderColor = 'rgba(82,29,29,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = 'rgba(82,29,29,0.18)' }}>
                  Сақтау
                </button>
                <button type="button" onClick={() => setShowConfirm(true)}
                  style={{ background: W, color: 'white', border: 'none', borderRadius: 10, padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(82,29,29,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(82,29,29,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(82,29,29,0.3)' }}>
                  Өңдеуді аяқтау
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(82,29,29,0.08)', background: '#FAFAF9', padding: isMobile ? '8px 14px' : '10px 24px' }}>
          <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <EditorTypographyBar disabled={freezeEditing || staffPhotosLocked} collapsible defaultCollapsed />
            <CoverTitleTypographyBar disabled={freezeEditing} collapsible defaultCollapsed />
            {hasFixedChapterPhrases ? (
              <FixedChapterBookSettingsPanel
                uploadFixedChapterPhoto={uploadFixedChapterPhoto}
                disabled={freezeEditing}
                defaultCollapsed
              />
            ) : null}
          </div>
        </div>

        {freezeEditing && !editorDone && (
          <div
            style={{
              background: '#EFF6FF',
              padding: '12px 24px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: '#1E40AF',
              flexShrink: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Клиент осы кітапқа AI арқылы өз бетінше өңдейді. Редактор рөлімен мәтін өзгерту жабық.
          </div>
        )}

        {!freezeEditing && !editorDone && orderStatus === 'checking' && (
          <div
            style={{
              background: '#ECFDF5',
              padding: '12px 24px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: '#065F46',
              flexShrink: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Клиент тапсырды. Бос сұрақтарға жауап жазуға және тұрақты тарау фразаларын түзетуге болады — өзгерістер автоматты сақталады.
          </div>
        )}

        {editorDone && (
          <div style={{ background: '#FDF7EE', padding: '12px 24px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#92400E', flexShrink: 0, letterSpacing: '-0.01em' }}>
            Өңдеу аяқталды. Текст дайын. Енді кітап версткасы жасалады.
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Sidebar */}
          {!isMobile && (
            <div style={{ width: 192, background: 'white', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '4px 0 24px rgba(82,29,29,0.04)' }}>
              <div style={{ padding: '16px 12px 10px', flexShrink: 0 }}>
                {sidebarBtn('Алғы сөз', 'algy_soz', !answerTextIsEffectivelyEmpty(algy_soz ?? ''))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px', minHeight: 0 }}>
                <div style={{ fontSize: 10, color: '#C0B0B0', fontWeight: 800, marginBottom: 10, padding: '0 8px', letterSpacing: '0.08em' }}>ТАРАУЛАР</div>
                {chapters.filter((ch) => ch.part_kind !== 'faktiler').map(ch => {
                  const chAns = (ch.questions || []).filter((q: any) => !answerTextIsEffectivelyEmpty(answers[q.id] ?? '')).length
                  const chTotal = (ch.questions || []).length
                  const isActive = activeChapterId === ch.id && !activeSpecial
                  const chapterEmpty = chAns === 0
                  const skippedFromBook = editorSkippedChapterIds.includes(ch.id)
                  return (
                    <div key={ch.id} style={{ marginBottom: 2 }}>
                      <button
                        type="button"
                        onClick={() => switchChapter(ch.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 10px',
                          borderRadius: 9,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                          background: isActive ? '#F5EDEC' : 'transparent',
                          borderLeft: `2.5px solid ${isActive ? W : 'transparent'}`,
                          opacity: skippedFromBook ? 0.55 : 1,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? W : '#7A6060',
                            marginBottom: 2,
                            letterSpacing: '-0.01em',
                            textDecoration: skippedFromBook ? 'line-through' : 'none',
                          }}
                        >
                          {ch.title_kk}
                        </div>
                        {chTotal > 0 && (
                          <div style={{ fontSize: 10, color: '#C0B0B0', fontWeight: 500 }}>
                            {chAns}/{chTotal}
                            {skippedFromBook ? ' · жасырылған' : ''}
                          </div>
                        )}
                      </button>
                      {!freezeEditing && chapterEmpty ? (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0 10px 6px',
                            fontSize: 10,
                            color: '#9A8080',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={skippedFromBook}
                            onChange={(e) => setChapterSkippedFromBook(ch.id, e.target.checked)}
                            style={{ width: 12, height: 12, accentColor: W }}
                          />
                          Кітаптан жасыру
                        </label>
                      ) : null}
                    </div>
                  )
                })}
                {showFaktilerNav ? (
                  <div style={{ marginTop: 8 }}>
                    {sidebarBtn('Фактілер', 'faktiler', faktilerFactsHaveAnyContent(faktiler_facts))}
                  </div>
                ) : null}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(82,29,29,0.06)' }}>
                  {sidebarBtn('Хат', 'hat', !answerTextIsEffectivelyEmpty(hat_text ?? ''))}
                </div>
              </div>
            </div>
          )}

          {/* Mobile tabs */}
          {isMobile && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', zIndex: 100, display: 'flex', overflowX: 'auto', padding: '10px 12px', gap: 8, boxShadow: '0 -4px 20px rgba(82,29,29,0.08)' }}>
              <button
                type="button"
                onClick={() => {
                  if (activeSpecial === 'algy_soz') setActiveSpecial(null)
                  else {
                    setActiveSpecial('algy_soz')
                    setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'algy' }))
                  }
                }}
                style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 150ms', background: activeSpecial === 'algy_soz' ? W : '#F5EDEC', color: activeSpecial === 'algy_soz' ? 'white' : W }}>
                Алғы сөз
              </button>
              {chapters.filter((ch) => ch.part_kind !== 'faktiler').map(ch => {
                const isActive = activeChapterId === ch.id && !activeSpecial
                return (
                  <button key={ch.id} onClick={() => switchChapter(ch.id)}
                    style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 150ms', background: isActive ? W : '#F5F2F2', color: isActive ? 'white' : '#7A6060' }}>
                    {ch.title_kk}
                  </button>
                )
              })}
              {showFaktilerNav && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeSpecial === 'faktiler') setActiveSpecial(null)
                    else {
                      setActiveSpecial('faktiler')
                      setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'faktiler' }))
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 150ms',
                    background: activeSpecial === 'faktiler' ? W : '#F5EDEC',
                    color: activeSpecial === 'faktiler' ? 'white' : W,
                  }}
                >
                  Фактілер
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (activeSpecial === 'hat') setActiveSpecial(null)
                  else {
                    setActiveSpecial('hat')
                    setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'hat' }))
                  }
                }}
                style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 150ms', background: activeSpecial === 'hat' ? W : '#F5EDEC', color: activeSpecial === 'hat' ? 'white' : W }}>
                Хат
              </button>
            </div>
          )}

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isMobile ? '24px 16px 96px' : '40px 40px', position: 'relative' }}>

            {activeSpecial === 'algy_soz' && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1C1010', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Алғы сөз</h2>
                  <p style={{ fontSize: 12, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Тек грамматика мен пунктуация түзетулері</p>
                </div>
                {!freezeEditing && !staffPhotosLocked && (
                  <div style={{ marginBottom: 16, maxWidth: 440 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#B8A8A8', margin: '0 0 8px', textTransform: 'uppercase' }}>Бұл бөлім өлшемі</p>
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
                {freezeEditing ? (
                  <div
                    className="book-rich-root font-preview-book"
                    style={{
                      ...textAreaStyle,
                      background: '#F9F6F6',
                      color: '#7A6060',
                      cursor: 'default',
                      boxShadow: '0 1px 4px rgba(82,29,29,0.04)',
                      fontWeight: 600,
                      lineHeight: 1.55,
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        sanitizeAnswerHtmlFragment(normalizeAnswerToHtml(algy_soz)) ||
                        '<p style="color:#D4C4C4;margin:0">—</p>',
                    }}
                  />
                ) : (
                  <AnswerRichTextEditor
                    valueHtml={normalizeAnswerToHtml(algy_soz)}
                    onChangeHtml={(h) => setAlgySoz(h)}
                    placeholder="Алғы сөз жоқ"
                    textAlign={answerTextAlign}
                    fontSizePx={answerPresetToUiPx(clampFontPresetToSectionMax(algyEffectivePreset))}
                    minHeightPx={280}
                    onNavigatePreview={() =>
                      setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'algy' }))
                    }
                    aiEnabled
                    aiSource="algy"
                    aiOrderId={orderId}
                    aiBlockKey="algy"
                  />
                )}
              </div>
            )}

            {activeSpecial === 'faktiler' && showFaktilerNav && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1C1010', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Фактілер</h2>
                  <p style={{ fontSize: 12, color: '#B8A8A8', margin: 0, fontWeight: 500, lineHeight: 1.45 }}>
                    Әр факт — бір мәтін беті және бір толық бет фотосы. Кем дегенде бір факт толтырылғанда ғана бөлім кітапта көрінеді.
                  </p>
                </div>
                <FaktilerFactsEditor
                  disabled={freezeEditing}
                  photosLocked={staffPhotosLocked}
                  orderId={orderId}
                  previewPages={previewPages}
                  onUploadFaktilerPhoto={(i, f) => void uploadFaktilerPhoto(i, f)}
                  variant="staff"
                />
              </div>
            )}

            {activeSpecial === 'hat' && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1C1010', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Хат</h2>
                  <p style={{ fontSize: 12, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Тек грамматика мен пунктуация түзетулері</p>
                </div>
                {!freezeEditing && !staffPhotosLocked && (
                  <div style={{ marginBottom: 16, maxWidth: 440 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#B8A8A8', margin: '0 0 8px', textTransform: 'uppercase' }}>Бұл бөлім өлшемі</p>
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
                {freezeEditing ? (
                  <div
                    className="book-rich-root font-preview-book"
                    style={{
                      ...textAreaStyle,
                      background: '#F9F6F6',
                      color: '#7A6060',
                      cursor: 'default',
                      boxShadow: '0 1px 4px rgba(82,29,29,0.04)',
                      fontWeight: 600,
                      lineHeight: 1.55,
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        sanitizeAnswerHtmlFragment(normalizeAnswerToHtml(hat_text)) ||
                        '<p style="color:#D4C4C4;margin:0">—</p>',
                    }}
                  />
                ) : (
                  <AnswerRichTextEditor
                    valueHtml={normalizeAnswerToHtml(hat_text)}
                    onChangeHtml={(h) => setHatText(h)}
                    placeholder="Хат жоқ"
                    textAlign={answerTextAlign}
                    fontSizePx={answerPresetToUiPx(clampFontPresetToSectionMax(hatEffectivePreset))}
                    minHeightPx={280}
                    onNavigatePreview={() =>
                      setSpreadIndex(spreadIndexForPreviewTarget(previewPages, { kind: 'hat' }))
                    }
                    aiEnabled
                    aiSource="hat"
                    aiOrderId={orderId}
                    aiBlockKey="hat"
                  />
                )}
              </div>
            )}

            {!activeSpecial && currentChapter && (
              <>
                <div style={{ marginBottom: 32 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1C1010', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{currentChapter.title_kk}</h2>
                  <p style={{ fontSize: 12, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>{(currentChapter.questions || []).length} сұрақ — тек грамматика/пунктуация түзетулері</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(currentChapter.questions || []).map((q: any) => {
                    const qCustomPages = getCustomPagesInQuestionSlot(q.id, flatQuestions, questionIndexById, customPages)
                    const answer = answers[q.id] || ''
                    if (
                      freezeEditing &&
                      answerTextIsEffectivelyEmpty(answer) &&
                      qCustomPages.length === 0
                    ) {
                      return null
                    }
                    return (
                      <div key={q.id} style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 4px rgba(82,29,29,0.06), 0 4px 16px rgba(82,29,29,0.04)' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setSpreadIndex(
                              spreadIndexForPreviewTarget(previewPages, {
                                kind: 'question',
                                questionId: q.id,
                              })
                            )
                          }
                          style={{
                            display: 'block',
                            width: '100%',
                            fontSize: 'clamp(14px, 4.2vw, 16px)',
                            color: '#B8A8A8',
                            marginBottom: 12,
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1.35,
                          }}
                        >
                          {q.question_kk}
                        </button>
                        {freezeEditing ? (
                          <div
                            style={{
                              ...textAreaStyle,
                              minHeight: 120,
                              fontSize: 14,
                              background: '#F9F6F6',
                              color: '#7A6060',
                              whiteSpace: 'pre-wrap',
                              cursor: 'default',
                            }}
                          >
                            {answerTextIsEffectivelyEmpty(answer) ? '—' : answerPlainTextPreview(answer)}
                          </div>
                        ) : (
                          <EditorQuestionTextarea
                            question={q}
                            questionId={q.id}
                            orderId={orderId}
                            isMobile={isMobile}
                            textAreaStyleFluid={textAreaStyleFluid}
                            spreadIndexForQuestion={spreadIndexForPreviewTarget(previewPages, {
                              kind: 'question',
                              questionId: q.id,
                            })}
                            staffPhotosLocked={staffPhotosLocked}
                          />
                        )}
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
                            disabled={freezeEditing}
                            photosLocked={staffPhotosLocked}
                            bookFontPreset={answerFontPreset}
                            textAlign={answerTextAlign === 'left' ? 'left' : 'justify'}
                            moveUpDisabled={idx === 0}
                            moveDownDisabled={idx === qCustomPages.length - 1}
                            onMove={(dir) => moveCustomPage(cp.id, dir)}
                            usedPhrases={customPages.filter((o) => o.id !== cp.id && o.overlay_text).map((o) => o.overlay_text!)}
                            blockedPhraseIds={[
                              ...chapters.flatMap((c) => (c.fixed_phrase_id ? [String(c.fixed_phrase_id)] : [])),
                              ...customPages
                                .filter((o) => o.id !== cp.id && o.selected_phrase_id)
                                .map((o) => String(o.selected_phrase_id)),
                            ]}
                            onNavigatePreview={() =>
                              setSpreadIndex(
                                spreadIndexForPreviewTarget(previewPages, {
                                  kind: 'custom',
                                  customPageId: cp.id,
                                })
                              )
                            }
                            aiEnabled
                          />
                        ))}
                        {!freezeEditing && !staffPhotosLocked && (
                          <AddPageButton questionId={q.id} onAdd={(type, qid) => addCustomPage(type, qid)} />
                        )}
                      </div>
                    )
                  })}
                </div>
                {!isMobile && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
                    {chapterIndex > 0 && (
                      <button onClick={() => switchChapter(chapters[chapterIndex - 1].id)}
                        style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#7A6060', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 1px 4px rgba(82,29,29,0.06), 0 2px 12px rgba(82,29,29,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(82,29,29,0.1), 0 1px 4px rgba(82,29,29,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(82,29,29,0.06), 0 2px 12px rgba(82,29,29,0.04)')}>
                        ← Алдыңғы
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {chapterIndex < chapters.length - 1 && (
                      <button onClick={async () => { await autoSave(); switchChapter(chapters[chapterIndex + 1].id) }}
                        style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(82,29,29,0.3)' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(82,29,29,0.35)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(82,29,29,0.3)' }}>
                        Келесі →
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!isMobile && <SpreadPreview />}
        </div>
      </div>

      {isMobile && (
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="fixed bottom-[5.25rem] right-4 z-[200] flex size-[52px] cursor-pointer items-center justify-center rounded-full bg-[color:var(--text-primary)] text-white shadow-[var(--shadow-md)] transition-transform touch-manipulation hover:bg-[color:var(--text-secondary)] active:scale-[0.98]"
          aria-label="Алдын ала қарау"
        >
          <IconEye className="size-[22px]" />
        </button>
      )}
    </>
  )
}
