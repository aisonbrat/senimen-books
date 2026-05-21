import { useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEditorStore } from '@/lib/store/editorStore'
import { prepareBookPhotoForUpload } from '@/lib/utils/imageCompression'
import {
  getQuestionSlotBounds,
  nextCustomPageSortOrder,
  normalizeBookTypographyFromOrder,
} from '@/lib/utils/buildPreviewPages'
import { normalizeSectionFontPreset } from '@/lib/bookLayout'
import { normalizeOverlayComposite } from '@/lib/utils/overlayParts'
import {
  parseFaktilerFactsPayload,
  ensureFaktilerEditorSlots,
  faktilerFactsForDb,
} from '@/lib/utils/faktilerFacts'
import { completeEditorOrder } from '@/app/editor-dashboard/actions'
import { STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'
import type { Chapter, CustomPage, Order } from '@/lib/types'
import { normalizeFixedRectangleColor } from '@/lib/utils/fixedChapterRectPalette'
import { showStorageUploadAlert } from '@/lib/utils/storageUploadErrorAlert'
import {
  isLikelyNetworkOrFetchFailure,
  showEditorSaveNetworkErrorToast,
  showEditorActionErrorToast,
  showEditorSaveSuccessToast,
} from '@/lib/utils/editorSaveErrorToast'
import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'
import {
  ANSWERS_TEXT_ONLY_SELECT,
  CUSTOM_PAGES_EDITOR_SELECT,
  ORDERS_EDITOR_SELECT,
  ORDERS_EDITOR_SELECT_LEGACY,
} from '@/lib/supabase/querySelects'
import { phraseOverrideForDb } from '@/lib/utils/fixedChapterPhrase'
import {
  fetchOrderChapterFixedPhotos,
  formatSupabaseError,
  isMissingPostgrestColumn,
  upsertOrderChapterFixedPhotos,
  upsertOrderChapterFixedPhotoPath,
} from '@/lib/supabase/orderChapterFixedPhotos'
import {
  bookSettingsPersistErrorMessage,
  fetchOrderBookSettings,
  isMissingBookSettingsColumn,
  parseBookSettingsFromOrderRow,
  persistOrderBookSettings,
} from '@/lib/supabase/orderBookSettings'
import {
  recoverFixedChapterPhotosFromStorage,
  repairFixedChapterPhotoRows,
} from '@/lib/storage/recoverFixedChapterPhotos'

/** Snapshot of all fields that `save()` persists — used to skip autosave right after hydrate. */
function editorAutosaveSnapshot(): string {
  const s = useEditorStore.getState()
  return JSON.stringify({
    answers: s.answers,
    algy_soz: s.algy_soz,
    hat_text: s.hat_text,
    faktiler_facts: s.faktiler_facts,
    answerFontPreset: s.answerFontPreset,
    answerTextAlign: s.answerTextAlign,
    coverTitleFontPreset: s.coverTitleFontPreset,
    algyFontPresetOverride: s.algyFontPresetOverride,
    hatFontPresetOverride: s.hatFontPresetOverride,
    chapterFixedPhotos: s.chapterFixedPhotos,
    chapterFixedPhraseOverrides: s.chapterFixedPhraseOverrides,
    editorSkippedChapterIds: [...s.editorSkippedChapterIds].sort(),
    fixed_rectangle_color: s.order?.fixed_rectangle_color ?? '',
  })
}

export function useEditorData(orderId: string) {
  const supabase = useMemo(() => createClient(), [])
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** Serialize saves so overlapping autosave + manual save never run in parallel. */
  const saveMutexTail = useRef<Promise<void>>(Promise.resolve())
  const fetchGenerationRef = useRef(0)
  const fetchOrderIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const autosaveAllowedRef = useRef(false)
  /** After hydrate, autosave runs only when state differs (prevents overwriting DB with defaults). */
  const autosaveBaselineRef = useRef<string | null>(null)

  const { setOrder, setCustomPages, setSavedAnswers, setSaving, setLastSaved, getUnsavedPairs } =
    useEditorStore()

  const fetchData = useCallback(async () => {
    abortControllerRef.current?.abort()
    const ac = new AbortController()
    abortControllerRef.current = ac
    const signal = ac.signal

    const gen = ++fetchGenerationRef.current
    autosaveAllowedRef.current = false

    const store = useEditorStore.getState()
    const switchingOrder = fetchOrderIdRef.current !== orderId
    fetchOrderIdRef.current = orderId
    if (switchingOrder) {
      store.clearEditorSessionForNewOrder()
      autosaveBaselineRef.current = null
      store.setLoading(true)
    }

    try {
      let orderData: unknown = null
      let orderErr: unknown = null
      const primaryOrderRes = await supabase
        .from('orders')
        .select(ORDERS_EDITOR_SELECT)
        .eq('id', orderId)
        .abortSignal(signal)
        .single()
      orderData = primaryOrderRes.data
      orderErr = primaryOrderRes.error
      if (orderErr && isMissingBookSettingsColumn(orderErr)) {
        const legacyRes = await supabase
          .from('orders')
          .select(ORDERS_EDITOR_SELECT_LEGACY)
          .eq('id', orderId)
          .abortSignal(signal)
          .single()
        orderData = legacyRes.data
        orderErr = legacyRes.error
      }

      if (signal.aborted || gen !== fetchGenerationRef.current) return
      if (orderErr || !orderData) throw orderErr ?? new Error('Order not found')

      const orderRecord = orderData as unknown as Record<string, unknown>

      let bookSettings = parseBookSettingsFromOrderRow(orderRecord)
      const rowHasBookSettingsCols =
        Object.prototype.hasOwnProperty.call(orderRecord, 'cover_title_font_preset') ||
        Object.prototype.hasOwnProperty.call(orderRecord, 'editor_skipped_chapter_ids')
      if (!rowHasBookSettingsCols) {
        bookSettings = await fetchOrderBookSettings(supabase, orderId, signal)
      } else {
        try {
          const fetched = await fetchOrderBookSettings(supabase, orderId, signal)
          bookSettings = fetched
        } catch (bookErr) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[useEditorData] book settings fetch fallback to order row:', bookErr)
          }
        }
      }
      const { editorSkippedChapterIds, coverTitleFontPreset } = bookSettings

      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('*, questions(*)')
        .eq('category_id', orderRecord.category_id as string)
        .order('sort_order')
        .abortSignal(signal)

      if (signal.aborted || gen !== fetchGenerationRef.current) return

      const sorted: Chapter[] = (chaptersData || []).map((ch) => {
        const c = ch as Chapter & { questions?: Array<{ sort_order: number }>; part_kind?: string }
        const part_kind = c.part_kind === 'faktiler' ? 'faktiler' : 'standard'
        return {
          ...c,
          part_kind,
          questions: (c.questions ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
        } as Chapter
      })

      const fpIds = sorted.map((c) => c.fixed_phrase_id).filter(Boolean) as string[]

      const phrasePromise =
        fpIds.length > 0
          ? supabase
              .from('category_phrases')
              .select('id, phrase_kk')
              .in('id', fpIds)
              .abortSignal(signal)
          : Promise.resolve({ data: [] as { id: string; phrase_kk: string }[], error: null })

      const cfpPromise = fetchOrderChapterFixedPhotos(supabase, orderId, signal)

      const [phRes, cfpPack, answersRes, cpRes] = await Promise.all([
        phrasePromise,
        cfpPromise,
        supabase
          .from('answers')
          .select(ANSWERS_TEXT_ONLY_SELECT)
          .eq('order_id', orderId)
          .abortSignal(signal),
        supabase
          .from('custom_pages')
          .select(CUSTOM_PAGES_EDITOR_SELECT)
          .eq('order_id', orderId)
          .order('sort_order')
          .abortSignal(signal),
      ])

      if (signal.aborted || gen !== fetchGenerationRef.current) return

      const batchErr = phRes.error || answersRes.error || cpRes.error
      if (batchErr) throw batchErr

      const cfpRes = { data: cfpPack.data }

      const phraseById = Object.fromEntries(
        (phRes.data || []).map((r: { id: string; phrase_kk: string }) => [r.id, r.phrase_kk]),
      )

      const chaptersHydrated = sorted.map((c) => ({
        ...c,
        fixed_phrase_kk: c.fixed_phrase_id ? phraseById[String(c.fixed_phrase_id)] ?? null : null,
      }))

      const chapterFixedPhotos: Record<string, string> = {}
      const chapterFixedPhraseOverrides: Record<string, string> = {}
      for (const row of cfpRes.data || []) {
        const r = row as {
          chapter_id: string
          photo_path: string | null
          phrase_override_kk: string | null
        }
        if (r.photo_path?.trim()) chapterFixedPhotos[r.chapter_id] = r.photo_path.trim()
        if (r.phrase_override_kk != null && String(r.phrase_override_kk).trim() !== '') {
          chapterFixedPhraseOverrides[r.chapter_id] = String(r.phrase_override_kk).trim()
        }
      }

      const fixedChapterIds = chaptersHydrated
        .filter((c) => c.part_kind !== 'faktiler' && c.fixed_phrase_id)
        .map((c) => c.id)
      const photosBeforeRecovery = { ...chapterFixedPhotos }
      if (fixedChapterIds.length > 0) {
        const recovered = await recoverFixedChapterPhotosFromStorage(
          supabase,
          orderId,
          fixedChapterIds,
          chapterFixedPhotos,
        )
        Object.assign(chapterFixedPhotos, recovered)
        if (signal.aborted || gen !== fetchGenerationRef.current) return
        const repaired = Object.keys(recovered).some(
          (id) => recovered[id] && recovered[id] !== photosBeforeRecovery[id],
        )
        if (repaired) {
          void repairFixedChapterPhotoRows(supabase, orderId, recovered, photosBeforeRecovery).catch(
            (err) => {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[useEditorData] repair fixed chapter photos:', err)
              }
            },
          )
        }
      }

      const answersMap: Record<string, string> = {}
      const answersTyped = (answersRes.data ?? []) as Array<{ question_id: string; text_content: string | null }>
      for (const a of answersTyped) {
        if (a.text_content) answersMap[a.question_id] = a.text_content
      }

      const cpData = cpRes.data

      const typo = normalizeBookTypographyFromOrder(orderData as unknown)

      const catRow = orderRecord.categories as
        | { faktiler_enabled?: boolean; faktiler_example_facts?: string | null }
        | null
        | undefined

      const hasFaktilerChapter = chaptersHydrated.some((c) => c.part_kind === 'faktiler')
      const parsedFacts = parseFaktilerFactsPayload(
        orderRecord.faktiler_facts,
        String(orderRecord.faktiler_text ?? ''),
        String(orderRecord.faktiler_photo_path ?? '')
      )
      const faktiler_facts = ensureFaktilerEditorSlots(parsedFacts, hasFaktilerChapter)

      store.hydrateEditorSession({
        order: orderData as unknown as Order,
        chapters: chaptersHydrated,
        answers: answersMap,
        customPages: (cpData || []) as unknown as CustomPage[],
        algy_soz: String(orderRecord.algy_soz ?? ''),
        hat_text: String(orderRecord.hat_text ?? ''),
        faktiler_facts,
        faktiler_category_enabled: !!(catRow && catRow.faktiler_enabled),
        faktiler_example_facts: String(catRow?.faktiler_example_facts ?? ''),
        activeChapterId: chaptersHydrated.find((c) => c.part_kind !== 'faktiler')?.id ?? chaptersHydrated[0]?.id ?? null,
        answerFontPreset: typo.fontPreset,
        answerTextAlign: typo.textAlign,
        coverTitleFontPreset,
        algyFontPresetOverride: normalizeSectionFontPreset(orderRecord.algy_font_preset),
        hatFontPresetOverride: normalizeSectionFontPreset(orderRecord.hat_font_preset),
        chapterFixedPhotos,
        chapterFixedPhraseOverrides,
        editorSkippedChapterIds,
      })

      autosaveBaselineRef.current = editorAutosaveSnapshot()

      queueMicrotask(() => {
        setTimeout(() => {
          if (gen === fetchGenerationRef.current) autosaveAllowedRef.current = true
        }, 0)
      })
    } catch (err) {
      if (signal.aborted || gen !== fetchGenerationRef.current) return
      const detail = formatSupabaseError(err)
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useEditorData] fetch failed:', detail, err)
      }
      if (isLikelyNetworkOrFetchFailure(err)) {
        showEditorSaveNetworkErrorToast(detail)
      } else {
        showEditorActionErrorToast('Кітап жүктелмеді', detail)
      }
    } finally {
      if (gen === fetchGenerationRef.current) {
        useEditorStore.getState().setLoading(false)
      }
    }
  }, [orderId, supabase])

  const logSaveFailure = useCallback((err: unknown, context: string) => {
    const msg =
      err && typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error
          ? err.message
          : String(err)
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[useEditorData] ${context}:`, msg, err)
    }
  }, [])

  /** Persists editor state. Does not throw (avoids unhandled rejections from debounced autosave). Serialized — overlapping calls wait in order and each run sees the latest store snapshot. */
  const save = useCallback(async (opts?: { manual?: boolean }): Promise<boolean> => {
    let release!: () => void
    const ticket = new Promise<void>((resolve) => {
      release = resolve
    })
    const prev = saveMutexTail.current
    saveMutexTail.current = ticket

    await prev

    setSaving(true)
    let outcome: { ok: boolean; err?: unknown } = { ok: false }
    try {
      outcome = await (async (): Promise<{ ok: boolean; err?: unknown }> => {
        try {
          const {
            algy_soz,
            hat_text,
            faktiler_facts,
            answerFontPreset,
            answerTextAlign,
            coverTitleFontPreset,
            algyFontPresetOverride,
            hatFontPresetOverride,
            chapterFixedPhotos,
            chapterFixedPhraseOverrides,
            editorSkippedChapterIds,
            chapters: chaptersState,
            order: currentOrder,
          } = useEditorStore.getState()
          const unsaved = getUnsavedPairs()
          const flatQs = useEditorStore.getState().getAllQuestionsFlat()
          const trialMode = (currentOrder as Order | null)?.trial_mode === true
          const lockedQuestionIds = trialMode
            ? new Set(flatQs.slice(TRIAL_FREE_QUESTION_COUNT).map((q) => q.id))
            : new Set<string>()

          if (unsaved.length > 0) {
            const rows = unsaved
              .filter(([questionId]) => !lockedQuestionIds.has(questionId))
              .map(([questionId, textContent]) => ({
                order_id: orderId,
                question_id: questionId,
                text_content: textContent || null,
                is_skipped: !textContent,
              }))
            if (rows.length > 0) {
              const { error } = await supabase
                .from('answers')
                .upsert(rows, { onConflict: 'order_id,question_id' })
              if (error) {
                logSaveFailure(error, 'answers upsert')
                return { ok: false, err: error }
              }
            }
          }
          const orderPatch: Record<string, unknown> = {
            algy_soz: algy_soz || null,
            hat_text: hat_text || null,
            faktiler_facts: faktilerFactsForDb(faktiler_facts),
            answer_font_preset: answerFontPreset,
            answer_text_align: answerTextAlign,
            algy_font_preset: algyFontPresetOverride,
            hat_font_preset: hatFontPresetOverride,
            fixed_rectangle_color:
              (currentOrder as Order | null)?.fixed_rectangle_color != null &&
              String((currentOrder as Order).fixed_rectangle_color).trim() !== ''
                ? normalizeFixedRectangleColor((currentOrder as Order).fixed_rectangle_color)
                : null,
          }
          const orderRes = await supabase.from('orders').update(orderPatch).eq('id', orderId)
          if (orderRes.error) {
            logSaveFailure(orderRes.error, 'orders update')
            return { ok: false, err: orderRes.error }
          }

          const bookPersist = await persistOrderBookSettings(supabase, orderId, {
            editorSkippedChapterIds,
            coverTitleFontPreset,
          })
          if (!bookPersist.ok) {
            const { title, detail } = bookSettingsPersistErrorMessage(bookPersist)
            showEditorActionErrorToast(title, detail)
            return { ok: false, err: new Error(bookPersist.kind) }
          }
          const { coverTitleFontPreset: savedCover, editorSkippedChapterIds: savedSkipped } =
            bookPersist.saved

          const { data: existingCfp } = await supabase
            .from('order_chapter_fixed_photos')
            .select('chapter_id, photo_path')
            .eq('order_id', orderId)
          const dbPhotoByChapter: Record<string, string> = {}
          for (const row of existingCfp || []) {
            const r = row as { chapter_id: string; photo_path: string | null }
            if (r.photo_path?.trim()) dbPhotoByChapter[r.chapter_id] = r.photo_path.trim()
          }

          const fixedChapters = chaptersState.filter(
            (c) => c.part_kind !== 'faktiler' && c.fixed_phrase_id,
          )
          const cfpRows = fixedChapters
            .map((ch) => {
              const photo =
                chapterFixedPhotos[ch.id]?.trim() || dbPhotoByChapter[ch.id] || null
              const overrideRaw = chapterFixedPhraseOverrides[ch.id]
              const phrase_override_kk =
                overrideRaw !== undefined
                  ? phraseOverrideForDb(overrideRaw, ch.fixed_phrase_kk)
                  : null
              return {
                order_id: orderId,
                chapter_id: ch.id,
                photo_path: photo,
                phrase_override_kk,
              }
            })
            .filter((row) => row.photo_path || row.phrase_override_kk != null)

          try {
            await upsertOrderChapterFixedPhotos(supabase, cfpRows)
          } catch (cfpErr) {
            logSaveFailure(cfpErr, 'order_chapter_fixed_photos upsert')
            return { ok: false, err: cfpErr }
          }

          if (currentOrder) {
            setOrder({
              ...(currentOrder as object),
              faktiler_facts: faktilerFactsForDb(faktiler_facts),
              answer_font_preset: answerFontPreset,
              answer_text_align: answerTextAlign,
              cover_title_font_preset: savedCover,
              editor_skipped_chapter_ids: savedSkipped,
              algy_font_preset: algyFontPresetOverride,
              hat_font_preset: hatFontPresetOverride,
            } as Order)
          }
          setSavedAnswers({ ...useEditorStore.getState().answers })
          setLastSaved(new Date())
          autosaveBaselineRef.current = editorAutosaveSnapshot()
          return { ok: true }
        } catch (err: unknown) {
          logSaveFailure(err, 'save unexpected')
          return { ok: false, err }
        }
      })()
    } finally {
      setSaving(false)
      release()
    }

    if (!outcome.ok && outcome.err != null && isLikelyNetworkOrFetchFailure(outcome.err)) {
      const detail =
        outcome.err && typeof outcome.err === 'object' && outcome.err !== null && 'message' in outcome.err
          ? String((outcome.err as { message: unknown }).message)
          : outcome.err instanceof Error
            ? outcome.err.message
            : String(outcome.err)
      showEditorSaveNetworkErrorToast(detail.trim() || undefined)
    }

    if (outcome.ok && opts?.manual) {
      showEditorSaveSuccessToast()
    } else if (!outcome.ok && opts?.manual && outcome.err != null && !isLikelyNetworkOrFetchFailure(outcome.err)) {
      const detail =
        outcome.err && typeof outcome.err === 'object' && outcome.err !== null && 'message' in outcome.err
          ? String((outcome.err as { message: unknown }).message)
          : outcome.err instanceof Error
            ? outcome.err.message
            : String(outcome.err)
      showEditorActionErrorToast('Сақтау сәтсіз', detail.trim() || undefined)
    }

    return outcome.ok
  }, [orderId, getUnsavedPairs, supabase, setSavedAnswers, setLastSaved, setSaving, setOrder, logSaveFailure])

  const debouncedSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    // Mutex in `save()` serializes overlapping runs (autosave + manual «Сақтау»).
    saveTimer.current = setTimeout(() => {
      void save().catch((err) => logSaveFailure(err, 'save promise'))
    }, 1500)
  }, [save, logSaveFailure])

  const addCustomPage = useCallback(
    async (type: 'custom_photo' | 'custom_text' | 'custom_poem', afterQuestionId: string) => {
      const storeNow = useEditorStore.getState()
      const questions = storeNow.getAllQuestionsFlat()
      const afterIndex = questions.findIndex((q) => q.id === afterQuestionId)
      if (afterIndex < 0) return
      const sort_order = nextCustomPageSortOrder(storeNow.customPages, afterIndex, questions.length)
      const { error: insertErr } = await supabase.from('custom_pages').insert({
        order_id: orderId,
        page_type: type,
        sort_order,
        overlay_in_book: false,
        qr_in_book: false,
        ...(type === 'custom_poem' ? { poem_stanza_lines: 4 } : {}),
      })
      if (insertErr) {
        showEditorActionErrorToast('Қосымша бет қосылмады', insertErr.message)
        if (process.env.NODE_ENV !== 'production') {
          console.error('[useEditorData] addCustomPage insert:', insertErr)
        }
        return
      }
      const { data: fresh, error: fetchErr } = await supabase
        .from('custom_pages')
        .select(CUSTOM_PAGES_EDITOR_SELECT)
        .eq('order_id', orderId)
        .order('sort_order')
      if (fetchErr) {
        showEditorActionErrorToast('Беттер тізімі жаңартылмады', fetchErr.message)
        if (process.env.NODE_ENV !== 'production') {
          console.error('[useEditorData] addCustomPage refetch:', fetchErr)
        }
        return
      }
      setCustomPages((fresh || []) as unknown as CustomPage[])
    },
    [orderId, supabase, setCustomPages],
  )

  const updateCustomPage = useCallback(
    async (id: string, field: string, value: string | number | boolean | null) => {
      let payload: string | number | boolean | null = value
      if (field === 'overlay_position') {
        payload = normalizeOverlayComposite(String(value)).composite
      } else if (field === 'photo_dpi' || field === 'overlay_shadow_opacity') {
        const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
        payload = Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : 0
      } else if (field === 'poem_stanza_lines') {
        const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
        payload = [4, 5, 6, 7, 8].includes(n) ? n : 4
      } else if (field === 'text_font_preset') {
        payload = normalizeSectionFontPreset(value === null || value === '' ? null : value)
      } else if (field === 'hidden_from_book' || field === 'overlay_in_book' || field === 'qr_in_book') {
        payload = value === true
      } else if (field === 'selected_phrase_id') {
        payload =
          value === null || value === ''
            ? null
            : typeof value === 'string'
              ? value
              : null
      }

      const snapshot = [...useEditorStore.getState().customPages]
      useEditorStore.getState().updateCustomPage(id, { [field]: payload } as Partial<CustomPage>)
      const { error } = await supabase.from('custom_pages').update({ [field]: payload }).eq('id', id)
      if (error) {
        setCustomPages(snapshot)
        if (process.env.NODE_ENV !== 'production') {
          console.error('[useEditorData] updateCustomPage failed:', error.message)
        }
      }
    },
    [supabase, setCustomPages],
  )

  const moveCustomPage = useCallback(
    async (pageId: string, direction: -1 | 1) => {
      const storeNow = useEditorStore.getState()
      const page = storeNow.customPages.find((p) => p.id === pageId)
      if (!page) return
      const flat = storeNow.getAllQuestionsFlat()
      const qi = Math.floor((page.sort_order - 50) / 100)
      if (!Number.isFinite(qi) || qi < 0 || qi >= flat.length) return
      const { low, high } = getQuestionSlotBounds(qi, flat.length)
      const siblings = storeNow.customPages
        .filter((cp) => cp.sort_order >= low && cp.sort_order < high)
        .sort((a, b) => a.sort_order - b.sort_order)
      const idx = siblings.findIndex((p) => p.id === pageId)
      const j = idx + direction
      if (idx < 0 || j < 0 || j >= siblings.length) return
      const a = siblings[idx]
      const b = siblings[j]
      const aSort = a.sort_order
      const bSort = b.sort_order
      const snapshot = [...storeNow.customPages]
      try {
        const { error: e1 } = await supabase.from('custom_pages').update({ sort_order: bSort }).eq('id', a.id)
        if (e1) throw e1
        const { error: e2 } = await supabase.from('custom_pages').update({ sort_order: aSort }).eq('id', b.id)
        if (e2) throw e2
        storeNow.updateCustomPage(a.id, { sort_order: bSort })
        storeNow.updateCustomPage(b.id, { sort_order: aSort })
      } catch (err) {
        setCustomPages(snapshot)
        if (process.env.NODE_ENV !== 'production') {
          console.error('[useEditorData] moveCustomPage failed:', err)
        }
      }
    },
    [supabase, setCustomPages],
  )

  const deleteCustomPage = useCallback(
    async (id: string) => {
      const snapshot = [...useEditorStore.getState().customPages]
      useEditorStore.getState().removeCustomPage(id)
      const { error } = await supabase.from('custom_pages').delete().eq('id', id)
      if (error) {
        setCustomPages(snapshot)
        if (process.env.NODE_ENV !== 'production') {
          console.error('[useEditorData] deleteCustomPage failed:', error.message)
        }
      }
    },
    [supabase, setCustomPages],
  )

  function logUploadErr(context: string, err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof Event !== 'undefined' && err instanceof Event
          ? (err as ErrorEvent).message || err.type || 'unknown event'
          : err && typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err)
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[useEditorData] ${context}:`, msg)
    }
  }

  const uploadPhoto = useCallback(
    async (pageId: string, file: File, slotIndex: number, currentPhotos: string[]) => {
      try {
        const compressed = await prepareBookPhotoForUpload(file)
        const filePath = `${orderId}/custom-${pageId}-${slotIndex}-${Date.now()}.${file.name.split('.').pop()}`
        const { error } = await supabase.storage.from(STORAGE_BUCKET_BOOK_PHOTOS).upload(filePath, compressed, { upsert: true })
        if (error) {
          console.error('[useEditorData] uploadPhoto storage:', error.message)
          void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (custom бет)', error)
          return
        }
        /** Store object key only — display uses signed URL / download; avoids fragile public-URL parsing. */
        const newPhotos = [...currentPhotos]
        newPhotos[slotIndex] = filePath
        await updateCustomPage(pageId, 'photo_path', newPhotos.join('|'))
        const { data: fresh } = await supabase
          .from('custom_pages')
          .select(CUSTOM_PAGES_EDITOR_SELECT)
          .eq('order_id', orderId)
          .order('sort_order')
        setCustomPages((fresh || []) as unknown as CustomPage[])
      } catch (err: unknown) {
        logUploadErr('uploadPhoto', err)
        void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (custom бет)', null, err)
      }
    },
    [orderId, supabase, updateCustomPage, setCustomPages],
  )

  const uploadFaktilerPhoto = useCallback(
    async (slotIndex: number, file: File) => {
      try {
        const compressed = await prepareBookPhotoForUpload(file)
        const filePath = `${orderId}/faktiler-${slotIndex}-${Date.now()}.${file.name.split('.').pop()}`
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET_BOOK_PHOTOS)
          .upload(filePath, compressed, { upsert: true })
        if (error) {
          console.error('[useEditorData] uploadFaktilerPhoto storage:', error.message)
          void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (фактілер)', error)
          return
        }
        useEditorStore.getState().setFaktilerPhotoAt(slotIndex, filePath)
      } catch (err: unknown) {
        logUploadErr('uploadFaktilerPhoto', err)
        void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (фактілер)', null, err)
      }
    },
    [orderId, supabase],
  )

  const uploadFixedChapterPhoto = useCallback(
    async (chapterId: string, file: File) => {
      try {
        const compressed = await prepareBookPhotoForUpload(file)
        const filePath = `${orderId}/fixed-chapter-${chapterId}-${Date.now()}.${file.name.split('.').pop()}`
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET_BOOK_PHOTOS)
          .upload(filePath, compressed, { upsert: true })
        if (error) {
          console.error('[useEditorData] uploadFixedChapterPhoto storage:', error.message)
          void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (тұрақты тарау)', error)
          return
        }
        useEditorStore.getState().setChapterFixedPhotoPath(chapterId, filePath)
        try {
          await upsertOrderChapterFixedPhotoPath(supabase, orderId, chapterId, filePath)
        } catch (dbErr) {
          logSaveFailure(dbErr, 'order_chapter_fixed_photos upsert after upload')
        }
      } catch (err: unknown) {
        logUploadErr('uploadFixedChapterPhoto', err)
        void showStorageUploadAlert(supabase, orderId, 'Фото жүктелмеді (тұрақты тарау)', null, err)
      }
    },
    [orderId, supabase],
  )

  useEffect(() => {
    void fetchData()
    return () => {
      abortControllerRef.current?.abort()
      fetchGenerationRef.current += 1
      autosaveAllowedRef.current = false
      useEditorStore.getState().setLoading(false)
    }
  }, [fetchData])

  const answers = useEditorStore((s) => s.answers)
  const algy_soz = useEditorStore((s) => s.algy_soz)
  const hat_text = useEditorStore((s) => s.hat_text)
  const faktilerFactsJson = useEditorStore((s) => JSON.stringify(s.faktiler_facts))

  const answerFontPreset = useEditorStore((s) => s.answerFontPreset)
  const answerTextAlign = useEditorStore((s) => s.answerTextAlign)
  const coverTitleFontPreset = useEditorStore((s) => s.coverTitleFontPreset)
  const algyFontPresetOverride = useEditorStore((s) => s.algyFontPresetOverride)
  const hatFontPresetOverride = useEditorStore((s) => s.hatFontPresetOverride)
  const chapterFixedPhotosJson = useEditorStore((s) => JSON.stringify(s.chapterFixedPhotos))
  const chapterFixedPhraseOverridesJson = useEditorStore((s) =>
    JSON.stringify(s.chapterFixedPhraseOverrides),
  )
  const editorSkippedChapterIdsJson = useEditorStore((s) =>
    JSON.stringify(s.editorSkippedChapterIds),
  )
  const fixedRectangleColor = useEditorStore((s) => s.order?.fixed_rectangle_color ?? '')

  useEffect(() => {
    if (!autosaveAllowedRef.current) return
    const snap = editorAutosaveSnapshot()
    if (autosaveBaselineRef.current !== null && snap === autosaveBaselineRef.current) {
      return
    }
    debouncedSave()
    return () => clearTimeout(saveTimer.current)
  }, [
    answers,
    algy_soz,
    hat_text,
    faktilerFactsJson,
    answerFontPreset,
    answerTextAlign,
    coverTitleFontPreset,
    algyFontPresetOverride,
    hatFontPresetOverride,
    chapterFixedPhotosJson,
    chapterFixedPhraseOverridesJson,
    editorSkippedChapterIdsJson,
    fixedRectangleColor,
    debouncedSave,
  ])

  const completeOrder = useCallback(async () => {
    const ok = await save()
    if (!ok) return
    await supabase.from('orders').update({ status: 'checking' }).eq('id', orderId)
    const current = useEditorStore.getState().order
    if (current) setOrder({ ...current, status: 'checking' } as Order)
  }, [orderId, save, supabase, setOrder])

  const assignEditor = useCallback(
    async (editorId: string) => {
      await supabase.from('orders').update({ assigned_editor: editorId }).eq('id', orderId)
      const current = useEditorStore.getState().order
      if (current) setOrder({ ...current, assigned_editor: editorId } as Order)
    },
    [orderId, supabase, setOrder],
  )

  const completeEditing = useCallback(async () => {
    try {
      await save()
    } catch {
      /* Save errors here are non-fatal: the order completion still proceeds. */
    }
    const res = await completeEditorOrder(orderId)
    if ('error' in res && res.error) throw new Error(res.error)
    const current = useEditorStore.getState().order
    if (current) setOrder({ ...current, status: 'completed' } as Order)
  }, [orderId, save, setOrder])

  const patchOrder = useCallback(
    async (patch: Partial<Pick<Order, 'book_title' | 'admin_cover_print_path'>>) => {
      if (Object.keys(patch).length === 0) return
      const prev = useEditorStore.getState().order
      const snapshot = prev ? { ...prev } : null
      if (prev) setOrder({ ...prev, ...patch } as Order)
      const { error } = await supabase.from('orders').update(patch).eq('id', orderId)
      if (error && snapshot) {
        setOrder(snapshot as Order)
        logSaveFailure(error, 'patchOrder')
      }
    },
    [orderId, supabase, setOrder, logSaveFailure]
  )

  const uploadAdminCoverPrint = useCallback(
    async (file: File) => {
      try {
        const compressed = await prepareBookPhotoForUpload(file)
        const tailRaw = String(file.name.split('.').pop() || 'jpg').toLowerCase()
        const tail = /^[a-z0-9]+$/.test(tailRaw) ? tailRaw : 'jpg'
        const filePath = `${orderId}/admin-cover-print.${tail}`
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET_BOOK_PHOTOS)
          .upload(filePath, compressed, { upsert: true })
        if (error) {
          logUploadErr('uploadAdminCoverPrint', error)
          void showStorageUploadAlert(supabase, orderId, 'Мұқаба жүктелмеді', error)
          return
        }
        await patchOrder({ admin_cover_print_path: filePath })
      } catch (err: unknown) {
        logUploadErr('uploadAdminCoverPrint', err)
        void showStorageUploadAlert(supabase, orderId, 'Мұқаба жүктелмеді', null, err)
      }
    },
    [orderId, patchOrder, supabase]
  )

  const saveBookInfo = useCallback(
    async (info: {
      book_title: string
      author_name: string
      recipient_name: string
      city?: string
      delivery_address?: string
    }) => {
      await supabase.from('orders').update(info).eq('id', orderId)
      const current = useEditorStore.getState().order
      if (current) setOrder({ ...current, ...info } as Order)
    },
    [orderId, supabase, setOrder],
  )

  return {
    autoSave: save,
    save,
    addCustomPage,
    updateCustomPage,
    moveCustomPage,
    deleteCustomPage,
    uploadPhoto,
    uploadFaktilerPhoto,
    uploadFixedChapterPhoto,
    completeOrder,
    completeEditing,
    assignEditor,
    saveBookInfo,
    patchOrder,
    uploadAdminCoverPrint,
  }
}
