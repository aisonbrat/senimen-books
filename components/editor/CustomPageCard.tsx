'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { clsx } from 'clsx'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { CustomPage } from '@/lib/types'
import {
  answerPresetToUiPx,
  normalizeGlobalFontPreset,
  normalizeSectionFontPreset,
  SECTION_FONT_PRESETS,
  type AnswerFontPreset,
} from '@/lib/bookLayout'
import { createClient } from '@/lib/supabase/client'
import { formatPhotoTitleKkCount, getPhotoCountFromTitleKk, resolveOverlayShadowOpacity } from '@/lib/utils/customPagePhotoMeta'
import { normalizeOverlayComposite, type OverlayVertical } from '@/lib/utils/overlayParts'
import {
  allowedOverlayVerticalsWhenQrSet,
  allowedQrVerticalsWhenOverlayAt,
  normalizeQrSizeKey,
  pickFallbackOverlayVertical,
  pickFallbackQrVertical,
  QR_SIZE_LABELS,
  type QrSizeKey,
} from '@/lib/utils/overlayQrRules'
import { normalizeAnswerToHtml } from '@/lib/utils/answerHtml'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'
import { TrialLockedOverlay } from '@/components/editor/TrialLockedOverlay'
import { IconCamera, IconChevronDown, IconDocument, IconX } from '@/components/ui/icons'

const AnswerRichTextEditor = dynamic(
  () => import('@/components/editor/AnswerRichTextEditor').then((m) => m.AnswerRichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[140px] rounded-[10px] bg-[color:var(--surface-subtle)]" /> }
)

interface Props {
  cp: CustomPage
  orderId: string
  categoryId?: string
  onUpdate: (id: string, field: string, value: string | number | boolean | null) => void
  onDelete: (id: string) => void
  onUpload: (pageId: string, file: File, slotIndex: number, currentPhotos: string[]) => void
  currentPhotos: string[]
  openCardId: string | null
  onToggle: (id: string | null) => void
  usedPhrases?: string[]
  /** Phrase row ids reserved for fixed chapter pages or other custom pages in this order. */
  blockedPhraseIds?: string[]
  disabled?: boolean
  /** Staff editor text-only: no photo upload, count change, or slot delete. */
  photosLocked?: boolean
  bookFontPreset: AnswerFontPreset
  textAlign: 'left' | 'justify'
  moveUpDisabled?: boolean
  moveDownDisabled?: boolean
  onMove?: (direction: -1 | 1) => void
  onNavigatePreview?: () => void
  /** Editor-only: forwards to `AnswerRichTextEditor.aiEnabled` for the polish button. */
  aiEnabled?: boolean
  /** Trial book: custom page slot locked. */
  trialLocked?: boolean
}

const OVERLAY_BAND_OPTS: { value: OverlayVertical; label: string }[] = [
  { value: 'top', label: '↑ Жоғары' },
  { value: 'center', label: '↔ Ортасы' },
  { value: 'bottom', label: '↓ Төмен' },
]

const QR_BAND_OPTS: { value: OverlayVertical; label: string }[] = [
  { value: 'top', label: '↑ Жоғары' },
  { value: 'center', label: '↔ Ортасы' },
  { value: 'bottom', label: '↓ Төмен' },
]

export function CustomPageCard({
  cp,
  orderId,
  categoryId,
  onUpdate,
  onDelete,
  onUpload,
  currentPhotos,
  openCardId,
  onToggle,
  usedPhrases,
  blockedPhraseIds,
  disabled,
  photosLocked = false,
  bookFontPreset,
  textAlign,
  moveUpDisabled,
  moveDownDisabled,
  onMove,
  onNavigatePreview,
  aiEnabled,
  trialLocked = false,
}: Props) {
  const photoCount = getPhotoCountFromTitleKk(cp.title_kk)
  const shadowPctUi = resolveOverlayShadowOpacity(cp)
  const { vertical: pos, bg: bgType } = normalizeOverlayComposite(cp.overlay_position)
  const isOverlayOpen = openCardId === cp.id
  /** Poem/text: collapses font controls only — editor stays visible */
  const [settingsOpen, setSettingsOpen] = useState(true)
  const hasOverlayText = !!(cp.overlay_text?.trim())
  const hasQrUrl = !!(cp.qr_url?.trim())
  /** Include in book (preview/PDF). Saved separately from copy so unchecking does not erase fields. */
  const overlayInBook = cp.overlay_in_book === true
  const qrInBook = cp.qr_in_book === true
  const showOverlayFields = overlayInBook || hasOverlayText
  const showQrFields = qrInBook || hasQrUrl
  const [phraseRows, setPhraseRows] = useState<Array<{ id: string; phrase_kk: string }>>([])
  const [moveFlash, setMoveFlash] = useState(false)
  const prevSortRef = useRef(cp.sort_order)
  const supabase = useMemo(() => createClient(), [])

  const qrUrlTrim = (cp.qr_url || '').trim()
  const hasQr = !!qrUrlTrim
  const qrBand = (cp.qr_vertical || 'bottom') as OverlayVertical
  const qrSize = normalizeQrSizeKey(cp.qr_size)

  const overlayOptsFiltered = useMemo(() => {
    if (!hasQr) return OVERLAY_BAND_OPTS
    const allowed = allowedOverlayVerticalsWhenQrSet(qrBand)
    return OVERLAY_BAND_OPTS.filter((o) => allowed.includes(o.value))
  }, [hasQr, qrBand])

  const qrOptsFiltered = useMemo(() => {
    if (!cp.overlay_text?.trim()) return QR_BAND_OPTS
    const allowed = allowedQrVerticalsWhenOverlayAt(pos)
    return QR_BAND_OPTS.filter((o) => allowed.includes(o.value))
  }, [pos, cp.overlay_text])

  const inheritPreset: AnswerFontPreset = useMemo(() => {
    const g = normalizeGlobalFontPreset(bookFontPreset)
    const n = Number(g)
    return (n > 20 ? '20' : g) as AnswerFontPreset
  }, [bookFontPreset])

  const effectiveTextPreset: AnswerFontPreset = useMemo(() => {
    const parsed = normalizeSectionFontPreset(cp.text_font_preset)
    if (parsed !== null) return parsed
    return inheritPreset
  }, [cp.text_font_preset, inheritPreset])

  const fontPx = useMemo(() => answerPresetToUiPx(effectiveTextPreset), [effectiveTextPreset])

  useEffect(() => {
    if (prevSortRef.current !== cp.sort_order) {
      prevSortRef.current = cp.sort_order
      setMoveFlash(true)
      const t = window.setTimeout(() => setMoveFlash(false), 720)
      return () => clearTimeout(t)
    }
  }, [cp.sort_order])

  useEffect(() => {
    if (!categoryId) return
    supabase
      .from('category_phrases')
      .select('id, phrase_kk')
      .eq('category_id', categoryId)
      .order('sort_order')
      .then(({ data }: { data: Array<{ id: string; phrase_kk: string }> | null }) => {
        if (data) setPhraseRows(data.map((p) => ({ id: p.id, phrase_kk: p.phrase_kk })))
      })
  }, [categoryId])

  function setOverlayVertical(next: OverlayVertical) {
    const allowed = hasQr ? allowedOverlayVerticalsWhenQrSet(qrBand) : (['top', 'center', 'bottom'] as const)
    const fixed = pickFallbackOverlayVertical(next, [...allowed])
    onUpdate(cp.id, 'overlay_position', normalizeOverlayComposite(`${fixed}:${bgType}`).composite)
  }

  function setQrVertical(next: OverlayVertical) {
    const allowed = cp.overlay_text?.trim()
      ? allowedQrVerticalsWhenOverlayAt(pos)
      : (['top', 'center', 'bottom'] as const)
    const fixed = pickFallbackQrVertical(next, [...allowed])
    onUpdate(cp.id, 'qr_vertical', fixed)
  }

  const photoSlotDisabled = !!(disabled || photosLocked)

  const photoBody = cp.photo_path || disabled || photosLocked ? (
    <>
      {!photoSlotDisabled ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 8 }}>Фото саны</label>
          <SegmentedControl
            options={[{ value: '1', label: '1 фото' }, { value: '2', label: '2 фото' }, { value: '4', label: '4 фото' }]}
            value={String(photoCount)}
            onChange={(v) => onUpdate(cp.id, 'title_kk', formatPhotoTitleKkCount(cp.title_kk, Number(v)))}
            fullWidth
          />
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: photoCount === 1 ? '1fr' : '1fr 1fr', gap: 4, marginBottom: 14 }}>
        {Array.from({ length: photoCount }).map((_, idx) => (
          <div key={idx} style={{ position: 'relative', aspectRatio: photoCount === 1 ? '3/2' : '1/1', background: '#F7F7F5', borderRadius: 6, overflow: 'hidden', border: '0.5px dashed #E8E8E6' }}>
            {currentPhotos[idx] ? (
              <>
                <SignedBookPhotoImg
                  storageRef={currentPhotos[idx] || ''}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {!photoSlotDisabled && (
                  <button
                    onClick={() => {
                      const np = [...currentPhotos]
                      np[idx] = ''
                      onUpdate(cp.id, 'photo_path', np.filter(Boolean).join('|') || '')
                    }}
                    type="button"
                    className="absolute right-1 top-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-black/65 text-white touch-manipulation"
                    aria-label="Жою"
                  >
                    <IconX className="size-3.5" />
                  </button>
                )}
              </>
            ) : photoSlotDisabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 80 }}>
                <span style={{ fontSize: 11, color: '#ccc' }}>Фото жоқ</span>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer', minHeight: 80 }}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) onUpload(cp.id, file, idx, currentPhotos)
                  }}
                />
                <IconCamera className="mx-auto size-6 text-[color:var(--text-muted)]" />
                <span style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Қосу</span>
              </label>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 4, marginBottom: 8, paddingTop: 10, borderTop: '0.5px solid #F0F0EE' }}>
        {!photosLocked ? (
          <>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                cursor: disabled ? 'default' : 'pointer',
                marginBottom: showOverlayFields ? 10 : 0,
              }}
            >
              <input
                type="checkbox"
                checked={overlayInBook}
                disabled={disabled}
                onChange={(e) => {
                  const v = e.target.checked
                  onUpdate(cp.id, 'overlay_in_book', v)
                  if (!v && isOverlayOpen) onToggle(null)
                }}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: '#0F0F0F', flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#333', lineHeight: 1.35 }}>
                Мәтінді қосу (фото үстінде)
              </span>
            </label>
            <p className="-mt-1 mb-2 ml-[26px] text-[10px] leading-snug text-[color:var(--text-muted)]">
              Белгіленбесе, мәтін сақталады бірақ кітапта көрінбейді.
            </p>

            {showOverlayFields ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>Мәтін</label>
                  <input
                    value={cp.overlay_text || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      onUpdate(cp.id, 'overlay_text', v)
                      if (cp.selected_phrase_id) onUpdate(cp.id, 'selected_phrase_id', null)
                    }}
                    placeholder="Мерзім, сөз, ой..."
                    disabled={disabled}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '0.5px solid #E8E8E6',
                      background: '#FAFAFA',
                      fontSize: 15,
                      boxSizing: 'border-box',
                      outline: 'none',
                      fontFamily: "'Cormorant',Georgia,serif",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onToggle(isOverlayOpen ? null : cp.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    background: 'none',
                    border: 'none',
                    borderTop: '0.5px solid #F0F0EE',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#555',
                    fontWeight: '500',
                  }}
                >
                  <span>Мәтін және фон баптаулары</span>
                  <IconChevronDown className={`size-4 shrink-0 text-[color:var(--text-muted)] transition-transform duration-200 ${isOverlayOpen ? 'rotate-180' : ''}`} />
                </button>
              </>
            ) : null}
          </>
        ) : showOverlayFields ? (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>Мәтін</label>
            <input
              value={cp.overlay_text || ''}
              onChange={(e) => {
                const v = e.target.value
                onUpdate(cp.id, 'overlay_text', v)
                if (cp.selected_phrase_id) onUpdate(cp.id, 'selected_phrase_id', null)
              }}
              placeholder="Мерзім, сөз, ой..."
              disabled={disabled}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '0.5px solid #E8E8E6',
                background: '#FAFAFA',
                fontSize: 15,
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: "'Cormorant',Georgia,serif",
              }}
            />
          </div>
        ) : null}
      </div>

      {!photosLocked && showOverlayFields && isOverlayOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 12 }}>
          {phraseRows.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {phraseRows
                .filter((row) => {
                  const blocked = blockedPhraseIds?.includes(row.id) && row.id !== cp.selected_phrase_id
                  const usedElsewhere =
                    usedPhrases?.includes(row.phrase_kk) && row.phrase_kk !== cp.overlay_text
                  return !blocked && (!usedElsewhere || row.phrase_kk === cp.overlay_text)
                })
                .map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      onUpdate(cp.id, 'selected_phrase_id', row.id)
                      onUpdate(cp.id, 'overlay_text', row.phrase_kk)
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: '0.5px solid #E8E8E6',
                      background: cp.selected_phrase_id === row.id ? '#0F0F0F' : 'white',
                      color: cp.selected_phrase_id === row.id ? 'white' : '#555',
                      cursor: 'pointer',
                      fontFamily: "'Cormorant',Georgia,serif",
                      transition: 'all 0.15s',
                    }}
                  >
                    {row.phrase_kk}
                  </button>
                ))}
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>Мәтін орны</label>
            <SegmentedControl
              fullWidth
              options={overlayOptsFiltered.map((o) => ({ value: o.value, label: o.label }))}
              value={
                overlayOptsFiltered.some((o) => o.value === pos)
                  ? pos
                  : (overlayOptsFiltered[0]?.value ?? pos)
              }
              onChange={(v) => setOverlayVertical(v as OverlayVertical)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>Фон түрі</label>
            <SegmentedControl
              fullWidth
              options={[
                { value: 'none', label: 'Жоқ' },
                { value: 'gradient', label: 'Градиент' },
                { value: 'solid', label: 'Толық' },
              ]}
              value={bgType}
              onChange={(v) => onUpdate(cp.id, 'overlay_position', normalizeOverlayComposite(`${pos}:${v}`).composite)}
            />
          </div>
          {bgType !== 'none' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>
                Фон мөлдірлігі: <b>{cp.photo_dpi || 60}%</b>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={cp.photo_dpi ?? 60}
                onChange={(e) => onUpdate(cp.id, 'photo_dpi', Number(e.target.value))}
                style={{ width: '100%', accentColor: '#0F0F0F' }}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>
              Мәтін өлшемі: <b>{cp.text_content || '18'}px</b>
            </label>
            <input
              type="range"
              min="12"
              max="48"
              step="2"
              value={parseInt(String(cp.text_content || '18'), 10) || 18}
              onChange={(e) => onUpdate(cp.id, 'text_content', e.target.value)}
              style={{ width: '100%', accentColor: '#0F0F0F' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>
              Мәтін көлеңкесі: <b>{shadowPctUi}%</b> (0 — жоқ)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={shadowPctUi}
              onChange={(e) => onUpdate(cp.id, 'overlay_shadow_opacity', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#0F0F0F' }}
            />
          </div>
        </div>
      )}

      {!photosLocked ? (
        <div style={{ marginBottom: 8, paddingTop: 10, borderTop: '0.5px solid #F0F0EE' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: disabled ? 'default' : 'pointer',
              marginBottom: showQrFields ? 10 : 0,
            }}
          >
            <input
              type="checkbox"
              checked={qrInBook}
              disabled={disabled}
              onChange={(e) => onUpdate(cp.id, 'qr_in_book', e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: '#0F0F0F', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333', lineHeight: 1.35 }}>QR код қосу</span>
          </label>
          <p className="-mt-1 mb-2 ml-[26px] text-[10px] leading-snug text-[color:var(--text-muted)]">
            Белгіленбесе, сілтеме сақталады бірақ кітапта көрінбейді.
          </p>

          {showQrFields ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 4 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 6 }}>QR сілтемесі</label>
                <input
                  value={cp.qr_url || ''}
                  onChange={(e) => onUpdate(cp.id, 'qr_url', e.target.value || null)}
                  placeholder="https://..."
                  disabled={disabled}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '0.5px solid #E8E8E6',
                    background: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <p className="mt-1 text-[10px] leading-snug text-[color:var(--text-muted)]">
                  QR мен мәтін бір жерде тұра алмайды — орындар өзара сүзіледі.
                </p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 8 }}>QR өлшемі</label>
                <div className={disabled || !hasQr ? 'pointer-events-none opacity-45' : ''}>
                  <SegmentedControl
                    fullWidth
                    value={qrSize}
                    onChange={(v) => onUpdate(cp.id, 'qr_size', v as QrSizeKey)}
                    options={[
                      { value: 'lg', label: QR_SIZE_LABELS.lg },
                      { value: 'xl', label: QR_SIZE_LABELS.xl },
                    ]}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 8 }}>QR орны</label>
                <div className={disabled || !hasQr ? 'pointer-events-none opacity-45' : ''}>
                  <SegmentedControl
                    fullWidth
                    value={qrBand}
                    onChange={(v) => setQrVertical(v as OverlayVertical)}
                    options={qrOptsFiltered.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  ) : photoSlotDisabled ? (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-[#E8E8E6] bg-[#F7F7F5] p-6 text-center">
      <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Фото жоқ (тек оқу)</p>
    </div>
  ) : (
    <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-[#E8E8E6] bg-[#F7F7F5] p-6 text-center touch-manipulation">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(cp.id, file, 0, [])
        }}
      />
      <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[color:var(--surface)] text-[color:var(--text-secondary)] shadow-[var(--shadow-xs)] ring-1 ring-[color:var(--border)]">
        <IconCamera className="size-6" />
      </span>
      <p style={{ fontSize: 13, color: '#555', margin: 0 }}>Фото таңдаңыз</p>
    </label>
  )

  const poemControls = (
    <>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 8 }}>Мәтін өлшемі (кітапқа қатысты)</label>
        <SegmentedControl
          fullWidth
          value={effectiveTextPreset}
          onChange={(v) => {
            const p = v as AnswerFontPreset
            onUpdate(cp.id, 'text_font_preset', p === inheritPreset ? null : p)
          }}
          options={SECTION_FONT_PRESETS.map((px) => ({
            value: px,
            label: px,
          }))}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 8 }}>Станзадағы жол саны (әр жол жаңа жолдан)</label>
        <SegmentedControl
          fullWidth
          options={[
            { value: '4', label: '4' },
            { value: '5', label: '5' },
            { value: '6', label: '6' },
            { value: '7', label: '7' },
            { value: '8', label: '8' },
          ]}
          value={String(Math.min(8, Math.max(4, cp.poem_stanza_lines ?? 4)))}
          onChange={(v) => onUpdate(cp.id, 'poem_stanza_lines', Number(v))}
        />
      </div>
    </>
  )

  const textControls = (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: '500', marginBottom: 8 }}>Мәтін өлшемі (кітапқа қатысты)</label>
      <SegmentedControl
        fullWidth
        value={effectiveTextPreset}
        onChange={(v) => {
          const p = v as AnswerFontPreset
          onUpdate(cp.id, 'text_font_preset', p === inheritPreset ? null : p)
        }}
        options={SECTION_FONT_PRESETS.map((px) => ({
          value: px,
          label: px,
        }))}
      />
    </div>
  )

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-[10px] border border-[#E8E8E6] bg-white transition-shadow duration-300 ease-out',
        moveFlash && 'custom-page-reorder-animate'
      )}
      style={{ marginBottom: 14 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', gap: 10 }}>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--surface-subtle)] px-2.5 py-1 text-[12px] font-semibold text-[color:var(--text-secondary)] ring-1 ring-[color:var(--border)]">
          {cp.page_type === 'custom_photo' ? (
            <>
              <IconCamera className="size-3.5 shrink-0" />
              Фото беті
            </>
          ) : cp.page_type === 'custom_poem' ? (
            <>
              <IconDocument className="size-3.5 shrink-0" />
              Өлең беті
            </>
          ) : (
            <>
              <IconDocument className="size-3.5 shrink-0" />
              Мәтін беті
            </>
          )}
        </span>
        <div className="flex flex-shrink-0 items-center gap-1">
          {!disabled && !photosLocked && onMove && (
            <>
              <button
                type="button"
                disabled={moveUpDisabled}
                onClick={() => onMove(-1)}
                title="Жоғары жылжыту"
                className="inline-flex size-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[13px] font-semibold text-[color:var(--text-secondary)] disabled:opacity-35"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={moveDownDisabled}
                onClick={() => onMove(1)}
                title="Төмен жылжыту"
                className="inline-flex size-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[13px] font-semibold text-[color:var(--text-secondary)] disabled:opacity-35"
              >
                ↓
              </button>
            </>
          )}
          {!disabled && !photosLocked && (
            <button onClick={() => onDelete(cp.id)} style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
              Жою
            </button>
          )}
        </div>
      </div>

      {cp.page_type === 'custom_photo' ? (
        <div style={{ padding: '0 18px 18px' }}>{photoBody}</div>
      ) : (
        <>
          {!photosLocked && (
            <>
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                className="flex w-full items-center justify-between border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-[18px] py-2.5 text-left transition-colors hover:bg-black/[0.03]"
              >
                <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">
                  {settingsOpen ? 'Бет баптауларын жасыру' : 'Бет баптауларын көрсету'}
                </span>
                <IconChevronDown className={`size-4 shrink-0 text-[color:var(--text-muted)] transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              {settingsOpen ? (
                <div style={{ padding: '0 18px 12px' }}>{cp.page_type === 'custom_poem' ? poemControls : textControls}</div>
              ) : null}
            </>
          )}
          <div style={{ padding: '0 18px 18px' }}>
            {cp.page_type === 'custom_poem' ? (
              disabled ? (
                <div
                  className="book-rich-root font-preview-book min-h-[120px] rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-[color:var(--text-secondary)]"
                  style={{ fontSize: fontPx, lineHeight: 1.55 }}
                  dangerouslySetInnerHTML={{
                    __html: normalizeAnswerToHtml(cp.text_content || '') || '<p>—</p>',
                  }}
                />
              ) : (
                <AnswerRichTextEditor
                  variant="poem"
                  valueHtml={normalizeAnswerToHtml(cp.text_content || '')}
                  onChangeHtml={(h) => onUpdate(cp.id, 'text_content', h)}
                  placeholder="Әр жолға бір жол — Enter көп stanza үшін"
                  textAlign={textAlign}
                  fontSizePx={fontPx}
                  minHeightPx={200}
                  onNavigatePreview={onNavigatePreview}
                  aiEnabled={aiEnabled}
                  aiSource="custom_text"
                  aiOrderId={orderId}
                  aiBlockKey={`cp:${cp.id}`}
                />
              )
            ) : disabled ? (
              <div
                className="book-rich-root font-preview-book min-h-[120px] rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-[color:var(--text-secondary)]"
                style={{ fontSize: fontPx, lineHeight: 1.55 }}
                dangerouslySetInnerHTML={{
                  __html: normalizeAnswerToHtml(cp.text_content || '') || '<p>—</p>',
                }}
              />
            ) : (
              <AnswerRichTextEditor
                valueHtml={normalizeAnswerToHtml(cp.text_content || '')}
                onChangeHtml={(h) => onUpdate(cp.id, 'text_content', h)}
                placeholder="Өлең, хат, ойлар..."
                textAlign={textAlign}
                fontSizePx={fontPx}
                minHeightPx={200}
                onNavigatePreview={onNavigatePreview}
                aiEnabled={aiEnabled}
                aiSource="custom_text"
                aiOrderId={orderId}
                aiBlockKey={`cp:${cp.id}`}
              />
            )}
          </div>
        </>
      )}
      {trialLocked ? <TrialLockedOverlay density="compact" className="rounded-[10px]" /> : null}
    </div>
  )
}
