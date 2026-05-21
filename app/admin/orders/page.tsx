'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { downloadBookPhotoBlob, getDisplayableUrl } from '@/lib/storage/bookPhotos'
import { runClientBookPdfExport } from '@/lib/client/runClientBookPdfExport'
import { normalizeBookTypographyFromOrder } from '@/lib/utils/buildPreviewPages'
import {
  PDF_EXPORT_JPEG_LABEL,
  PDF_EXPORT_PNG_LABEL,
  type ExportOrderInput,
  type PdfClientPhotoMode,
} from '@/lib/utils/pdfExport'
import { formatPhoneForDisplay } from '@/lib/utils/phone'
import {
  formatOrderProgressLabel,
  formatOrderProgressPercent,
  type OrderProgress,
} from '@/lib/admin/orderBookProgress'
import { fetchOrderBookProgressMap } from '@/lib/admin/fetchOrderBookProgress'
import { fetchOrderChapterFixedPhotos } from '@/lib/supabase/orderChapterFixedPhotos'
import { parseEditorSkippedChapterIds } from '@/lib/utils/editorSkippedChapters'
import { normalizeCoverTitleFontPreset } from '@/lib/bookLayout'
import { recoverFixedChapterPhotosFromStorage } from '@/lib/storage/recoverFixedChapterPhotos'
import {
  adminDeleteOrder,
  adminFetchOrderProgressMap,
  adminSetOrderClientAiEnabled,
  adminUpdateOrderStatus,
} from './actions'
import { Button } from '@/components/ui/Button'
import {
  ORDER_STATUS_ORDER,
  orderStatusLabel,
  orderStatusWorkspacePill,
  orderStatusDotColor,
} from '@/lib/design/order-status'
import type { CustomPage } from '@/lib/types'
import {
  ANSWERS_TEXT_ONLY_SELECT,
  CUSTOM_PAGES_EDITOR_SELECT,
  ORDERS_ADMIN_LIST_SELECT,
} from '@/lib/supabase/querySelects'

/* eslint-disable @typescript-eslint/no-explicit-any -- nested PostgREST / PDF helper shapes */

async function fetchOrderData(orderId: string, categoryId: string) {
  const supabase = createClient()
  const { data: chaptersData } = await supabase
    .from('chapters')
    .select('*, questions(*)')
    .eq('category_id', categoryId)
    .order('sort_order')
  let chapters = (chaptersData || []).map((ch: any) => ({
    ...ch,
    part_kind: ch.part_kind === 'faktiler' ? 'faktiler' : 'standard',
    questions: (ch.questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  }))

  const fpIds = chapters.flatMap((c: any) => (c.fixed_phrase_id ? [c.fixed_phrase_id] : []))
  let phraseById: Record<string, string> = {}
  if (fpIds.length > 0) {
    const { data: phRows } = await supabase.from('category_phrases').select('id, phrase_kk').in('id', fpIds)
    phraseById = Object.fromEntries((phRows || []).map((r: any) => [r.id, r.phrase_kk]))
  }
  chapters = chapters.map((ch: any) => ({
    ...ch,
    fixed_phrase_kk: ch.fixed_phrase_id ? phraseById[String(ch.fixed_phrase_id)] ?? null : null,
  }))

  const { data: skipRow } = await supabase
    .from('orders')
    .select('editor_skipped_chapter_ids, cover_title_font_preset')
    .eq('id', orderId)
    .maybeSingle()
  const editorSkippedChapterIds = parseEditorSkippedChapterIds(
    (skipRow as { editor_skipped_chapter_ids?: unknown } | null)?.editor_skipped_chapter_ids,
  )
  const coverTitleFontPreset = normalizeCoverTitleFontPreset(
    (skipRow as { cover_title_font_preset?: unknown } | null)?.cover_title_font_preset,
  )

  const { data: cfpRows } = await fetchOrderChapterFixedPhotos(supabase, orderId)
  const chapterFixedPhotos: Record<string, string> = {}
  const chapterFixedPhraseOverrides: Record<string, string> = {}
  for (const row of cfpRows || []) {
    const r = row as {
      chapter_id: string
      photo_path: string | null
      phrase_override_kk: string | null
    }
    if (r.photo_path?.trim()) chapterFixedPhotos[r.chapter_id] = r.photo_path.trim()
    if (r.phrase_override_kk != null) {
      chapterFixedPhraseOverrides[r.chapter_id] = String(r.phrase_override_kk).trim()
    }
  }

  const fixedChapterIds = chapters
    .filter((c: { fixed_phrase_id?: string | null; part_kind?: string }) =>
      c.part_kind !== 'faktiler' && c.fixed_phrase_id,
    )
    .map((c: { id: string }) => c.id)
  if (fixedChapterIds.length > 0) {
    const recovered = await recoverFixedChapterPhotosFromStorage(
      supabase,
      orderId,
      fixedChapterIds,
      chapterFixedPhotos,
    )
    Object.assign(chapterFixedPhotos, recovered)
  }

  let pdf_colophon_template_kk: string | null = null
  if (categoryId) {
    const { data: catTpl } = await supabase
      .from('categories')
      .select('pdf_colophon_template_kk')
      .eq('id', categoryId)
      .maybeSingle()
    pdf_colophon_template_kk =
      (catTpl as { pdf_colophon_template_kk?: string | null } | null)?.pdf_colophon_template_kk ?? null
  }

  const allQuestions = chapters.flatMap((c: any) =>
    c.part_kind === 'faktiler' ? [] : c.questions || []
  )
  const { data: answersData } = await supabase
    .from('answers')
    .select(ANSWERS_TEXT_ONLY_SELECT)
    .eq('order_id', orderId)
  const answers: Record<string, string> = {}
  answersData?.forEach((a: any) => {
    if (a.text_content) answers[a.question_id] = a.text_content
  })
  const { data: cpData } = await supabase
    .from('custom_pages')
    .select(CUSTOM_PAGES_EDITOR_SELECT)
    .eq('order_id', orderId)
    .order('sort_order')
  const customPages = (cpData || []) as unknown as CustomPage[]
  const nQ = allQuestions.length
  const allPages: any[] = []
  allQuestions.forEach((q: any, idx: number) => {
    allPages.push({ type: 'question', data: q })
    const nextIdx = idx + 1 < nQ ? idx + 1 : 9999
    const low = idx * 100 + 50
    const high = nextIdx * 100 + 50
    customPages
      .filter((cp: any) => cp.sort_order >= low && cp.sort_order < high)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .forEach((cp: any) => allPages.push({ type: 'custom', data: cp }))
  })
  return {
    allPages,
    answers,
    chapters,
    customPages,
    chapterFixedPhotos,
    chapterFixedPhraseOverrides,
    editorSkippedChapterIds,
    coverTitleFontPreset,
    pdf_colophon_template_kk,
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

const ADMIN_ORDERS_PAGE_SIZE = 100

function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Local calendar month (matches previous client-side month pill). */
function localMonthBoundsIso(yyyyMm: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null
  const start = new Date(y, mo - 1, 1, 0, 0, 0, 0)
  const end = new Date(y, mo, 0, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * When the search box looks like a phone query, narrow orders by matching profile_phones.
 * Returns null if this is not a phone-style search (use text ilike instead).
 */
async function resolveProfileIdsByPhoneDigits(
  supabase: ReturnType<typeof createClient>,
  rawSearch: string,
): Promise<string[] | null> {
  const trimmed = rawSearch.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 4) return null
  if (!/^[\d\s\-+()]+$/.test(trimmed)) return null
  const { data, error } = await supabase.from('profile_phones').select('profile_id').ilike('phone', `%${digits}%`)
  if (error) return null
  return [...new Set((data || []).map((r: { profile_id: string }) => r.profile_id))].slice(0, 400)
}

/** Admin list + PDF export row (aligned with ORDERS_ADMIN_LIST_SELECT). */
type AdminOrderListRow = {
  id: string
  client_id?: string | null
  category_id?: string | null
  author_name?: string | null
  book_title?: string | null
  recipient_name?: string | null
  delivery_address?: string | null
  status: string
  assigned_editor?: string | null
  editor_id?: string | null
  created_at: string
  updated_at?: string
  submitted_at?: string | null
  completed_at?: string | null
  client_ai_enabled?: boolean
  trial_mode?: boolean | null
  admin_cover_print_path?: string | null
  faktiler_text?: string | null
  faktiler_photo_path?: string | null
  faktiler_facts?: unknown
  answer_font_preset?: string | null
  answer_text_align?: string | null
  algy_font_preset?: string | null
  hat_font_preset?: string | null
  cover_title_font_preset?: string | null
  fixed_rectangle_color?: string | null
  algy_soz?: string | null
  hat_text?: string | null
}

function OrderProgressDisplay({ progress }: { progress?: OrderProgress }) {
  if (!progress || progress.total <= 0) {
    return <span className="text-[11px] font-medium text-[color:var(--text-muted)]">—</span>
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] font-semibold tabular-nums text-[color:var(--text-primary)]">
        {formatOrderProgressLabel(progress)}
      </span>
      <span className="text-[10px] font-medium tabular-nums text-[color:var(--text-muted)]">
        {formatOrderProgressPercent(progress)}
      </span>
    </div>
  )
}

const selectCls = clsx(
  'rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)]',
  'px-2 py-1.5 text-[12px] text-[color:var(--text-primary)] shadow-[var(--shadow-xs)] outline-none',
  'transition-[border-color,box-shadow] duration-[var(--transition)]',
  'focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]'
)

function PDFButton({ order }: { order: AdminOrderListRow }) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  async function handleExport(photoMode: PdfClientPhotoMode) {
    if (exporting) return
    setExporting(true)
    setProgress({ current: 0, total: 0 })
    try {
      const {
        answers,
        chapters,
        customPages,
        chapterFixedPhotos,
        chapterFixedPhraseOverrides,
        editorSkippedChapterIds,
        coverTitleFontPreset,
        pdf_colophon_template_kk,
      } = await fetchOrderData(
        order.id,
        String(order.category_id ?? ''),
      )
      const pdfOrder: ExportOrderInput = {
        book_title: order.book_title ?? '',
        author_name: order.author_name ?? undefined,
        recipient_name: order.recipient_name ?? undefined,
        category_id: order.category_id,
        completed_at: order.completed_at,
        submitted_at: order.submitted_at,
        updated_at: order.updated_at,
        pdf_colophon_template_kk,
        algy_soz: order.algy_soz ?? undefined,
        hat_text: order.hat_text ?? undefined,
        faktiler_text: order.faktiler_text,
        faktiler_photo_path: order.faktiler_photo_path,
        faktiler_facts: order.faktiler_facts,
        answer_font_preset: order.answer_font_preset ?? undefined,
        answer_text_align: order.answer_text_align ?? undefined,
        cover_title_font_preset: order.cover_title_font_preset ?? undefined,
        algy_font_preset: order.algy_font_preset,
        hat_font_preset: order.hat_font_preset,
        fixed_rectangle_color: order.fixed_rectangle_color,
      }

      await runClientBookPdfExport({
        order: pdfOrder,
        chapters,
        answers,
        customPages,
        chapterFixedPhotos,
        chapterFixedPhraseOverrides,
        editorSkippedChapterIds,
        coverTitleFontPreset,
        typography: normalizeBookTypographyFromOrder(pdfOrder),
        photoMode,
        onProgress: (c, t) => setProgress({ current: c, total: t }),
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[PDF Export]', error)
      const message = error instanceof Error ? error.message : 'PDF export failed'
      window.alert(message)
    } finally {
      setExporting(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const progressLabel =
    exporting && progress.total > 0 ? `${progress.current}/${progress.total}` : exporting ? '…' : null

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        title={PDF_EXPORT_PNG_LABEL}
        onClick={() => void handleExport('png')}
        disabled={exporting}
      >
        {progressLabel ?? 'PDF PNG'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        title={PDF_EXPORT_JPEG_LABEL}
        onClick={() => void handleExport('jpeg')}
        disabled={exporting}
      >
        {exporting ? progressLabel : 'PDF JPEG'}
      </Button>
    </div>
  )
}

function AdminCoverDownloadButton({ order }: { order: { id: string; admin_cover_print_path?: string | null } }) {
  const path = String(order.admin_cover_print_path ?? '').trim()
  const [busy, setBusy] = useState(false)
  if (!path) return <span className="text-[11px] font-medium text-[color:var(--text-muted)]">—</span>

  async function download() {
    setBusy(true)
    try {
      const supabase = createClient()
      let blob: Blob | null = null
      const displayUrl = await getDisplayableUrl(supabase, path, { httpOnly: true })
      if (displayUrl) {
        const res = await fetch(displayUrl)
        if (res.ok) blob = await res.blob()
      }
      if (!blob) blob = await downloadBookPhotoBlob(supabase, path)
      if (!blob) return
      const tail = path.split('.').pop() || 'jpg'
      const ext = /^[a-z0-9]+$/i.test(tail) ? tail : 'jpg'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `muka-${order.id.slice(0, 8)}.${ext}`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void download()} disabled={busy}>
      {busy ? '…' : 'Мұқаба'}
    </Button>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListRow[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [editors, setEditors] = useState<Record<string, string>>({})
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [sortKey, setSortKey] = useState<'created_desc' | 'created_asc' | 'title_asc'>('created_desc')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [aiUpdatingId, setAiUpdatingId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; bookTitle: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [totalMatching, setTotalMatching] = useState<number | null>(null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ all: 0 })
  const [progressByOrderId, setProgressByOrderId] = useState<Record<string, OrderProgress>>({})

  const ordersRef = useRef(orders)
  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchStatusCounts = useCallback(async () => {
    const supabase = createClient()
    const head = () => supabase.from('orders').select('id', { count: 'exact', head: true })
    const allRes = await head()
    if (allRes.error) return
    const perStatus = await Promise.all(
      ORDER_STATUS_ORDER.map((s) => {
        if (s === 'filling') {
          return head().eq('status', s).eq('trial_mode', false)
        }
        return head().eq('status', s)
      }),
    )
    if (perStatus.some((r) => r.error)) return
    const byStatus = Object.fromEntries(
      ORDER_STATUS_ORDER.map((s, i) => [s, perStatus[i].count ?? 0]),
    ) as Record<string, number>
    setStatusCounts({ ...byStatus, all: allRes.count ?? 0 })
  }, [])

  const mergeProfilesForRows = useCallback(
    async (supabase: ReturnType<typeof createClient>, rows: AdminOrderListRow[], append: boolean) => {
      const idSet = new Set<string>()
      for (const o of rows) {
        if (o.client_id) idSet.add(o.client_id)
        const ed = o.assigned_editor ?? o.editor_id
        if (ed) idSet.add(ed)
      }
      const ids = [...idSet]
      if (ids.length === 0) {
        if (!append) {
          setEditors({})
          setClientPhones({})
        }
        return
      }
      const { data: profs, error: pe } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      const { data: phoneRows, error: phe } = await supabase
        .from('profile_phones')
        .select('profile_id, phone')
        .in('profile_id', ids)
      if (pe || phe) {
        if (pe) setLoadError(pe.message)
        if (phe) setLoadError(phe.message)
        return
      }
      const profileMap: Record<string, string> = {}
      const phoneMap: Record<string, string> = {}
      profs?.forEach((p: { id: string; full_name: string | null }) => {
        profileMap[p.id] = p.full_name || ''
      })
      phoneRows?.forEach((row: { profile_id: string; phone: string | null }) => {
        if (row.phone) phoneMap[row.profile_id] = formatPhoneForDisplay(String(row.phone)) || String(row.phone)
      })
      if (append) {
        setEditors((prev) => ({ ...prev, ...profileMap }))
        setClientPhones((prev) => ({ ...prev, ...phoneMap }))
      } else {
        setEditors(profileMap)
        setClientPhones(phoneMap)
      }
    },
    [],
  )

  const fetchOrdersPage = useCallback(
    async (append: boolean, options?: { preserveRowsWhileLoading?: boolean }) => {
      const supabase = createClient()
      const offset = append ? ordersRef.current.length : 0

      if (append) {
        setLoadingMore(true)
      } else if (options?.preserveRowsWhileLoading) {
        setRefreshing(true)
      } else {
        setOrders([])
        setProgressByOrderId({})
        setTotalMatching(null)
        setLoading(true)
      }

      setLoadError(null)
      try {
        const phoneIds = await resolveProfileIdsByPhoneDigits(supabase, debouncedSearch)

        let q = supabase.from('orders').select(ORDERS_ADMIN_LIST_SELECT, { count: 'exact' })
        if (filter !== 'all') {
          q = q.eq('status', filter)
          if (filter === 'filling') {
            q = q.eq('trial_mode', false)
          }
        }
        const mb = monthFilter ? localMonthBoundsIso(monthFilter) : null
        if (mb) q = q.gte('created_at', mb.start).lte('created_at', mb.end)

        if (phoneIds !== null) {
          if (phoneIds.length === 0) {
            if (!append) {
              setOrders([])
              setTotalMatching(0)
            }
            return
          }
          q = q.in('client_id', phoneIds)
        } else if (debouncedSearch) {
          const esc = escapeIlike(debouncedSearch)
          q = q.or(`book_title.ilike.%${esc}%,author_name.ilike.%${esc}%,recipient_name.ilike.%${esc}%`)
        }

        if (sortKey === 'title_asc') {
          q = q.order('book_title', { ascending: true }).order('id', { ascending: true })
        } else {
          q = q
            .order('created_at', { ascending: sortKey === 'created_asc' })
            .order('id', { ascending: sortKey === 'created_asc' })
        }

        const [ordRes, catRes] = await Promise.all([
          q.range(offset, offset + ADMIN_ORDERS_PAGE_SIZE - 1),
          append
            ? Promise.resolve({ data: null as unknown[] | null, error: null })
            : supabase.from('categories').select('id, title_kk'),
        ])

        const errMsg = ordRes.error?.message || catRes.error?.message || null
        if (errMsg) {
          setLoadError(errMsg)
          if (!append) {
            setOrders([])
            setCategories({})
            setEditors({})
            setClientPhones({})
          }
          return
        }

        const rows = (ordRes.data || []) as unknown as AdminOrderListRow[]
        setTotalMatching(typeof ordRes.count === 'number' ? ordRes.count : offset + rows.length)

        if (append) setOrders((prev) => [...prev, ...rows])
        else setOrders(rows)

        if (!append && catRes.data) {
          const catRows = (catRes.data || []) as { id: string; title_kk: string }[]
          const catMap: Record<string, string> = {}
          catRows.forEach((c) => {
            catMap[c.id] = c.title_kk
          })
          setCategories(catMap)
        }

        await mergeProfilesForRows(supabase, rows, append)

        const progressInput = rows.map((o) => ({ id: o.id, category_id: o.category_id }))
        let progressRes = await fetchOrderBookProgressMap(supabase, progressInput)
        if (progressRes.error) {
          progressRes = await adminFetchOrderProgressMap(progressInput)
        }
        if (progressRes.error) {
          console.warn('[admin/orders] progress:', progressRes.error)
          setMutationError((prev) => prev ?? `Прогресс жүктелмеді: ${progressRes.error}`)
        }
        if (append) {
          setProgressByOrderId((prev) => ({ ...prev, ...progressRes.progress }))
        } else {
          setProgressByOrderId(progressRes.progress)
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Жүктеу қатесі')
        if (!append) {
          setOrders([])
          setCategories({})
          setEditors({})
          setClientPhones({})
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [debouncedSearch, filter, monthFilter, sortKey, mergeProfilesForRows],
  )

  const reloadListAndCounts = useCallback(async () => {
    await Promise.all([fetchStatusCounts(), fetchOrdersPage(false, { preserveRowsWhileLoading: true })])
  }, [fetchStatusCounts, fetchOrdersPage])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await fetchStatusCounts()
      if (cancelled) return
      await fetchOrdersPage(false)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchStatusCounts, fetchOrdersPage, filter, monthFilter, debouncedSearch, sortKey])

  const monthOptions = useMemo(() => {
    const KK_MONTHS = [
      'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
      'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан',
    ]
    const out: { value: string; label: string }[] = []
    const start = new Date(2026, 4, 1)
    for (let i = 0; i < 48; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${d.getFullYear()} ж. ${KK_MONTHS[d.getMonth()]}`
      out.push({ value, label })
    }
    return out
  }, [])

  async function updateStatus(orderId: string, newStatus: string) {
    setMutationError(null); setUpdatingId(orderId)
    try {
      const res = await adminUpdateOrderStatus(orderId, newStatus)
      if ('error' in res && res.error) { setMutationError(res.error); return }
      await reloadListAndCounts()
    } finally { setUpdatingId(null) }
  }

  async function resetToChecking(orderId: string) {
    setMutationError(null); setUpdatingId(orderId)
    try {
      const res = await adminUpdateOrderStatus(orderId, 'checking')
      if ('error' in res && res.error) { setMutationError(res.error); return }
      await reloadListAndCounts()
    } finally { setUpdatingId(null) }
  }

  async function resetToFilling(orderId: string) {
    setMutationError(null); setUpdatingId(orderId)
    try {
      const res = await adminUpdateOrderStatus(orderId, 'filling')
      if ('error' in res && res.error) { setMutationError(res.error); return }
      await reloadListAndCounts()
    } finally { setUpdatingId(null) }
  }

  async function toggleClientAi(orderId: string, next: boolean) {
    setMutationError(null); setAiUpdatingId(orderId)
    try {
      const res = await adminSetOrderClientAiEnabled(orderId, next)
      if ('error' in res && res.error) { setMutationError(res.error); return }
      await reloadListAndCounts()
    } finally { setAiUpdatingId(null) }
  }

  function confirmDeleteOrder() {
    if (!deleteDialog) return
    const orderId = deleteDialog.id
    setDeleteError(null)
    startDeleteTransition(async () => {
      const res = await adminDeleteOrder(orderId)
      if ('error' in res && res.error) {
        setDeleteError(res.error)
        return
      }
      setDeleteDialog(null)
      await reloadListAndCounts()
    })
  }

  const hasMore = totalMatching !== null && orders.length < totalMatching

  const isFiltered = searchInput.trim() || monthFilter || filter !== 'all'

  const statsPending = (statusCounts.filling ?? 0) + (statusCounts.checking ?? 0)
  const statsCompleted = statusCounts.completed ?? 0
  const statsDelivered = statusCounts.delivered ?? 0

  return (
    <div className="px-4 py-6 md:px-10 md:py-8">
      <header className="mb-6">
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[1.65rem]">
          Тапсырыстар
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[color:var(--text-muted)]">
          {refreshing ? (
            <span className="text-[color:var(--accent)]">Жаңартылуда…</span>
          ) : totalMatching !== null ? (
            <>
              {orders.length} / {totalMatching} көрсетілуде
              {isFiltered ? <span className="text-[color:var(--text-muted)]"> (сүзгі)</span> : null}
            </>
          ) : (
            <>Жүктелуде…</>
          )}
        </p>
      </header>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      {!loading && !loadError && statusCounts.all > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Барлығы', value: statusCounts.all },
            { label: 'Күтуде', value: statsPending },
            { label: 'Аяқталды', value: statsCompleted },
            { label: 'Жеткізілді', value: statsDelivered },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white px-4 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]"
            >
              <div className="text-[24px] font-semibold tabular-nums tracking-tight text-[color:var(--text-primary)]">
                {s.value}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-[color:var(--text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {mutationError && (
        <div className="mb-5 rounded-[var(--radius-md)] border border-red-200 bg-red-50/90 px-4 py-3 text-[13px] font-medium text-red-900">
          {mutationError}
        </div>
      )}

      {/* ── Filter Bento Block ─────────────────────────────────────────── */}
      <div className="mb-6 rounded-[var(--radius-lg)] bg-[color:var(--surface)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">

        {/* Search */}
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Кітап, автор, алушы немесе телефон бойынша іздеу…"
          className={clsx(
            'mb-4 w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)]',
            'px-3.5 py-2 text-[13px] text-[color:var(--text-primary)] outline-none',
            'transition-[border-color,box-shadow] duration-[var(--transition)] placeholder:text-[color:var(--text-muted)]',
            'focus:border-[color:var(--border-strong)] focus:bg-[color:var(--surface)] focus:ring-2 focus:ring-[color:var(--accent-ring)]'
          )}
        />

        {/* Status filter pills */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(['all', ...ORDER_STATUS_ORDER] as const).map((s) => {
            const active = filter === s
            const cnt = statusCounts[s] ?? 0
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-semibold transition-all duration-[var(--transition)]',
                  active
                    ? 'bg-[color:var(--text-primary)] text-white shadow-[var(--shadow-sm)]'
                    : 'bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]'
                )}
              >
                {s !== 'all' && (
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: active ? 'currentColor' : orderStatusDotColor(s) }}
                  />
                )}
                {s === 'all' ? 'Барлығы' : orderStatusLabel(s)}
                {s === 'filling' ? (
                  <span
                    className={clsx(
                      'hidden text-[10px] font-medium sm:inline',
                      active ? 'text-white/75' : 'text-[color:var(--text-muted)]'
                    )}
                    title="Тегін нұсқадағы тапсырыстар осы сүзгіде көрсетілмейді"
                  >
                    (толық)
                  </span>
                ) : null}
                <span className={clsx('tabular-nums text-[11px]', active ? 'opacity-60' : 'text-[color:var(--text-muted)]')}>
                  {cnt}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-[color:var(--text-muted)]">
          «Толтырылуда» сүзгісі тек{' '}
          <strong className="font-semibold text-[color:var(--text-secondary)]">толық қолжетімділік</strong>
          берілген тапсырыстарды көрсетеді. Тегін нұсқадағы тапсырыстарды{' '}
          <strong className="font-semibold text-[color:var(--text-secondary)]">Тегін кезең</strong> бетінен бақылаңыз;
          жалпы кестеде олар <strong className="font-semibold text-[color:var(--text-secondary)]">«Тегін нұсқа»</strong>{' '}
          белгісімен анықталады.
        </p>

        {/* Month + sort row */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-muted)]">Ай</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className={clsx(selectCls, 'min-w-[160px]')}
          >
            <option value="">Барлық айлар</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <span className="hidden h-4 w-px bg-[color:var(--border)] sm:block" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-muted)]">Сұрыптау</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className={clsx(selectCls, 'min-w-[180px]')}
          >
            <option value="created_desc">Күні (жаңасы бірінші)</option>
            <option value="created_asc">Күні (ескісі бірінші)</option>
            <option value="title_asc">Кітап атауы (А–Я)</option>
          </select>
          {isFiltered && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setFilter('all'); setMonthFilter('') }}
              className="ml-auto text-[12px] font-semibold text-[color:var(--text-muted)] underline-offset-2 transition-colors hover:text-[color:var(--accent)] hover:underline"
            >
              Тазалау ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-xs)]"
              style={{ opacity: 1 - i * 0.18 }}
            >
              <div className="mb-2 h-3.5 w-[38%] rounded-md bg-[color:var(--surface-subtle)]" />
              <div className="h-2.5 w-[22%] rounded-md bg-[color:var(--surface-subtle)]" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50/80 p-6">
          <p className="text-[14px] font-semibold text-red-900">Тапсырыстарды жүктеу мүмкін болмады</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{loadError}</p>
          <Button type="button" variant="primary" className="mt-4" onClick={() => void reloadListAndCounts()}>Қайта көріңіз</Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] px-8 py-14 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
          <p className="text-[13px] font-medium text-[color:var(--text-muted)]">
            {isFiltered ? 'Сүзгі бойынша тапсырыс табылмады' : 'Тапсырыстар жоқ'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => {
              const eid = order.assigned_editor ?? order.editor_id
              const editorName = eid ? editors[eid] : ''
              return (
                <div
                  key={order.id}
                  className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]"
                >
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div className="text-[14px] font-semibold leading-snug text-[color:var(--text-primary)]">
                      {order.book_title}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {order.trial_mode ? (
                        <span className="rounded-[var(--radius-sm)] bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200">
                          Тегін нұсқа
                        </span>
                      ) : null}
                      <span className={orderStatusWorkspacePill(order.status)}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                  {order.category_id && categories[order.category_id] ? (
                    <span className="mb-2 inline-flex rounded-[var(--radius-sm)] border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                      {categories[order.category_id]}
                    </span>
                  ) : null}
                  <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1.5 text-[12px]">
                    <dt className="text-[color:var(--text-muted)]">Автор</dt>
                    <dd className="text-[color:var(--text-secondary)]">{order.author_name || '—'}</dd>
                    <dt className="text-[color:var(--text-muted)]">Алушы</dt>
                    <dd className="text-[color:var(--text-secondary)]">{order.recipient_name || '—'}</dd>
                    <dt className="text-[color:var(--text-muted)]">Телефон</dt>
                    <dd className="font-mono text-[color:var(--text-secondary)]">
                      {order.client_id && clientPhones[order.client_id] ? clientPhones[order.client_id] : '—'}
                    </dd>
                    <dt className="text-[color:var(--text-muted)]">Редактор</dt>
                    <dd className="text-[color:var(--text-secondary)]">{editorName || '—'}</dd>
                    <dt className="text-[color:var(--text-muted)]">Күні</dt>
                    <dd className="tabular-nums text-[color:var(--text-muted)]">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </dd>
                    <dt className="text-[color:var(--text-muted)]">Прогресс</dt>
                    <dd>
                      <OrderProgressDisplay progress={progressByOrderId[order.id]} />
                    </dd>
                  </dl>
                  <div className="mt-3.5 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-[color:var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={!!order.client_ai_enabled}
                        disabled={aiUpdatingId === order.id}
                        onChange={(e) => void toggleClientAi(order.id, e.target.checked)}
                        className="size-4 accent-[color:var(--accent)]"
                      />
                      Клиентке AI
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={selectCls}
                      >
                        {ORDER_STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>{orderStatusLabel(s)}</option>
                        ))}
                      </select>
                      <PDFButton order={order} />
                      <AdminCoverDownloadButton order={order} />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isDeletePending}
                        className="border-red-200 bg-red-50/90 text-red-800 hover:border-red-300 hover:bg-red-100"
                        onClick={() => {
                          setDeleteError(null)
                          setDeleteDialog({
                            id: order.id,
                            bookTitle: (order.book_title || '').trim() || 'Тапсырыс',
                          })
                        }}
                      >
                        Жою
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--surface)] shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] border-collapse">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
                    {['Кітап', 'Түрі', 'Нұсқа', 'Прогресс', 'Автор', 'Алушы', 'Телефон', 'Мекенжай', 'Редактор', 'Күні', 'Статус', 'Өзгерту', 'AI', 'PDF · Мұқаба', 'Жою'].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => (
                    <tr
                      key={order.id}
                      className={clsx(
                        'transition-colors duration-[var(--transition)] hover:bg-[color:var(--surface-subtle)]/60',
                        i < orders.length - 1 && 'border-b border-[color:var(--border)]'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-semibold text-[color:var(--text-primary)]">
                          {order.book_title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {order.category_id && categories[order.category_id] ? (
                          <span className="inline-flex whitespace-nowrap rounded-[var(--radius-sm)] border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                            {categories[order.category_id]}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {order.trial_mode ? (
                          <span
                            className="inline-flex whitespace-nowrap rounded-[var(--radius-sm)] bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-200"
                            title="Тегін кезең — толық қолжетімділік әлі берілмеген"
                          >
                            Тегін нұсқа
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-[color:var(--text-muted)]">Толық</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <OrderProgressDisplay progress={progressByOrderId[order.id]} />
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[color:var(--text-secondary)]">{order.author_name}</td>
                      <td className="px-4 py-3 text-[13px] text-[color:var(--text-secondary)]">{order.recipient_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-[color:var(--text-secondary)]">
                        {order.client_id && clientPhones[order.client_id] ? clientPhones[order.client_id] : <span className="text-[color:var(--text-muted)]">—</span>}
                      </td>
                      <td className="max-w-[180px] px-4 py-3 text-[12px] text-[color:var(--text-muted)]">
                        <div className="truncate">{order.delivery_address}</div>
                      </td>
                      <td className="max-w-[130px] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">
                        {(() => {
                          const eid = order.assigned_editor ?? order.editor_id
                          const name = eid ? editors[eid] : ''
                          return name ? <span className="font-medium">{name}</span> : <span className="text-[color:var(--text-muted)]">—</span>
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] tabular-nums text-[color:var(--text-muted)]">
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={orderStatusWorkspacePill(order.status)}>
                          {orderStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={order.status}
                            disabled={updatingId === order.id}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            className={selectCls}
                          >
                            {ORDER_STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>{orderStatusLabel(s)}</option>
                            ))}
                          </select>
                          {(order.status === 'completed' || order.status === 'checking') && (
                            <Button
                              type="button" variant="secondary" size="sm"
                              disabled={updatingId === order.id}
                              onClick={() => resetToChecking(order.id)}
                              className="border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
                            >
                              → Тексеруде
                            </Button>
                          )}
                          {order.status !== 'filling' && (
                            <Button
                              type="button" variant="secondary" size="sm"
                              disabled={updatingId === order.id}
                              onClick={() => resetToFilling(order.id)}
                              className="border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] text-[color:var(--accent)] hover:bg-[color:var(--accent-muted)]"
                            >
                              → Толтыруда
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={!!order.client_ai_enabled}
                            disabled={aiUpdatingId === order.id}
                            onChange={(e) => void toggleClientAi(order.id, e.target.checked)}
                            className="size-4 shrink-0 accent-[color:var(--accent)]"
                          />
                          <span className="max-w-[5rem] leading-snug">AI</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <PDFButton order={order} />
                          <AdminCoverDownloadButton order={order} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isDeletePending}
                          className="border-red-200 bg-red-50/90 text-red-800 hover:border-red-300 hover:bg-red-100"
                          onClick={() => {
                            setDeleteError(null)
                            setDeleteDialog({
                              id: order.id,
                              bookTitle: (order.book_title || '').trim() || 'Тапсырыс',
                            })
                          }}
                        >
                          Жою
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!loading && hasMore && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={loadingMore}
                onClick={() => void fetchOrdersPage(true)}
              >
                {loadingMore
                  ? 'Жүктелуде…'
                  : `Тағы жүктеу (${Math.min(ADMIN_ORDERS_PAGE_SIZE, (totalMatching ?? 0) - orders.length)})`}
              </Button>
              <p className="text-center text-[11px] font-medium text-[color:var(--text-muted)]">
                Алғашқы бет {ADMIN_ORDERS_PAGE_SIZE} жазбаға шектеледі; қалғанын осы батырма арқылы қосыңыз.
              </p>
            </div>
          )}
        </>
      )}

      {deleteDialog ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-delete-order-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-xl)]">
            <h2
              id="admin-delete-order-title"
              className="text-[1.05rem] font-semibold tracking-tight text-[color:var(--text-primary)]"
            >
              Тапсырысты жою
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
              <span className="font-semibold text-[color:var(--text-primary)]">«{deleteDialog.bookTitle}»</span>{' '}
              тапсырысын мүлдем жойғыңыз келе ме? Жауаптар мен файлдар қоса жойылуы мүмкін; әрекетті қайтару қиын.
            </p>
            {deleteError ? (
              <p className="mt-3 rounded-[var(--radius-md)] border border-red-200 bg-red-50/90 px-3 py-2 text-[12px] font-medium text-red-900">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-w-[120px]"
                disabled={isDeletePending}
                onClick={() => {
                  if (!isDeletePending) {
                    setDeleteError(null)
                    setDeleteDialog(null)
                  }
                }}
              >
                Болдырмау
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-w-[120px] bg-red-600 hover:bg-red-700"
                disabled={isDeletePending}
                onClick={() => void confirmDeleteOrder()}
              >
                {isDeletePending ? 'Жойылуда…' : 'Иә, жою'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
