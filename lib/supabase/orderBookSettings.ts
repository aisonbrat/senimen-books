import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_COVER_TITLE_FONT_PRESET,
  normalizeCoverTitleFontPreset,
  type CoverTitleFontPreset,
} from '@/lib/bookLayout'
import {
  parseEditorSkippedChapterIds,
  sanitizeEditorSkippedChapterIds,
} from '@/lib/utils/editorSkippedChapters'
import { isMissingPostgrestColumn } from '@/lib/supabase/orderChapterFixedPhotos'

export const ORDER_BOOK_SETTINGS_SELECT = 'editor_skipped_chapter_ids,cover_title_font_preset'

export function isPostgrestNoRowsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; details?: string }
  const blob = [e.message, e.details].filter(Boolean).join(' ')
  return e.code === 'PGRST116' || blob.includes('single JSON object') || blob.includes('0 rows')
}

export type OrderBookSettings = {
  editorSkippedChapterIds: string[]
  coverTitleFontPreset: CoverTitleFontPreset
}

export function parseBookSettingsFromOrderRow(
  row: Record<string, unknown> | null | undefined,
): OrderBookSettings {
  if (!row) {
    return {
      editorSkippedChapterIds: [],
      coverTitleFontPreset: normalizeCoverTitleFontPreset(null),
    }
  }
  return {
    editorSkippedChapterIds: parseEditorSkippedChapterIds(row.editor_skipped_chapter_ids),
    coverTitleFontPreset: normalizeCoverTitleFontPreset(row.cover_title_font_preset),
  }
}

export function isMissingBookSettingsColumn(err: unknown): boolean {
  return (
    isMissingPostgrestColumn(err, 'editor_skipped_chapter_ids') ||
    isMissingPostgrestColumn(err, 'cover_title_font_preset')
  )
}

function skippedIdsMatch(intended: string[], raw: unknown): boolean {
  const a = [...sanitizeEditorSkippedChapterIds(intended)].sort()
  const b = [...parseEditorSkippedChapterIds(raw)].sort()
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Compare intended preset to DB raw value (null in DB = default 13.5 only). */
function coverPresetMatchesRaw(intended: CoverTitleFontPreset, raw: unknown): boolean {
  const rawStr = raw == null ? '' : String(raw).trim()
  if (!rawStr) {
    return intended === DEFAULT_COVER_TITLE_FONT_PRESET
  }
  return normalizeCoverTitleFontPreset(raw) === intended
}

export type PersistBookSettingsResult =
  | { ok: true; saved: OrderBookSettings }
  | { ok: false; kind: 'missing_columns'; strippedCols: string[] }
  | { ok: false; kind: 'schema_stale'; columns: string[] }
  | { ok: false; kind: 'db_error'; err: unknown }

const MIGRATION_HINT =
  'Supabase SQL Editor-де миграцияларды іске қосыңыз, содан кейін Dashboard → Settings → API → Reload schema (немесе бірнеше минут күтіңіз).'

/**
 * Writes cover title + skipped chapters and returns the row PostgREST actually stored.
 * Uses `.select()` on update so we do not rely on a separate read that may be stale.
 */
export async function persistOrderBookSettings(
  supabase: SupabaseClient,
  orderId: string,
  settings: OrderBookSettings,
): Promise<PersistBookSettingsResult> {
  const editorSkippedChapterIds = sanitizeEditorSkippedChapterIds(settings.editorSkippedChapterIds)
  const coverTitleFontPreset = settings.coverTitleFontPreset

  const fullPatch = {
    cover_title_font_preset: coverTitleFontPreset,
    editor_skipped_chapter_ids: editorSkippedChapterIds,
  }

  /**
   * Update without `.single()` (avoids PGRST116). Select `id` to detect 0-row updates (RLS block).
   */
  const runUpdate = async (patch: Record<string, unknown>): Promise<{ error: unknown | null }> => {
    const { data, error } = await supabase.from('orders').update(patch).eq('id', orderId).select('id')
    if (error) return { error }
    if (!data || data.length === 0) {
      return {
        error: new Error(
          'Orders update matched 0 rows (staff RLS or wrong order id). Run migration 20260652210000_orders_staff_update_with_check.sql.',
        ),
      }
    }
    return { error: null }
  }

  const readRow = async (): Promise<Record<string, unknown> | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_BOOK_SETTINGS_SELECT)
      .eq('id', orderId)
      .maybeSingle()
    if (error) throw error
    return (data as Record<string, unknown> | null) ?? null
  }

  let updateErr: unknown | null = null
  const strippedCols: string[] = []

  updateErr = (await runUpdate(fullPatch)).error
  if (updateErr && isMissingPostgrestColumn(updateErr, 'cover_title_font_preset')) {
    strippedCols.push('cover_title_font_preset')
    updateErr = (await runUpdate({ editor_skipped_chapter_ids: editorSkippedChapterIds })).error
  }
  if (updateErr && isMissingPostgrestColumn(updateErr, 'editor_skipped_chapter_ids')) {
    strippedCols.push('editor_skipped_chapter_ids')
    updateErr = (await runUpdate({ cover_title_font_preset: coverTitleFontPreset })).error
  }

  if (strippedCols.length > 0) {
    return { ok: false, kind: 'missing_columns', strippedCols }
  }

  if (updateErr) {
    return { ok: false, kind: 'db_error', err: updateErr }
  }

  let row: Record<string, unknown> | null = null
  try {
    row = await readRow()
  } catch (readErr) {
    return { ok: false, kind: 'db_error', err: readErr }
  }

  if (!row) {
    return {
      ok: false,
      kind: 'db_error',
      err: new Error(
        'Order row not found after update (editor may lack UPDATE permission on orders — check Staff update RLS policy).',
      ),
    }
  }
  const stale: string[] = []

  if (!coverPresetMatchesRaw(coverTitleFontPreset, row.cover_title_font_preset)) {
    stale.push('cover_title_font_preset')
  }
  if (!skippedIdsMatch(editorSkippedChapterIds, row.editor_skipped_chapter_ids)) {
    stale.push('editor_skipped_chapter_ids')
  }

  if (stale.length > 0) {
    return { ok: false, kind: 'schema_stale', columns: stale }
  }

  return { ok: true, saved: parseBookSettingsFromOrderRow(row) }
}

export function bookSettingsPersistErrorMessage(result: Exclude<PersistBookSettingsResult, { ok: true }>): {
  title: string
  detail: string
} {
  if (result.kind === 'missing_columns') {
    return {
      title: 'Тақырып өлшемі мен «Кітаптан жасыру» сақталмады',
      detail: `Базада бағандар жоқ: ${result.strippedCols.join(', ')}. ${MIGRATION_HINT}`,
    }
  }
  if (result.kind === 'schema_stale') {
    return {
      title: 'Параметрлер сақталмады',
      detail: `API жаңартылмады (${result.columns.join(', ')}). ${MIGRATION_HINT}`,
    }
  }
  if (result.kind === 'db_error' && isPostgrestNoRowsError(result.err)) {
    return {
      title: 'Сақтау сәтсіз',
      detail:
        'Жазба жаңартылмады (0 жол). Редактор рөлі profiles кестесінде editor/admin екенін және «Staff update orders» RLS саясаты бар екенін тексеріңіз.',
    }
  }
  const msg =
    result.err && typeof result.err === 'object' && result.err !== null && 'message' in result.err
      ? String((result.err as { message: unknown }).message)
      : result.err instanceof Error
        ? result.err.message
        : String(result.err ?? '')
  return {
    title: 'Сақтау сәтсіз',
    detail: msg.trim() || MIGRATION_HINT,
  }
}

/** Loads staff book settings; tolerates one column missing (unmigrated DB). */
export async function fetchOrderBookSettings(
  supabase: SupabaseClient,
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderBookSettings> {
  let q = supabase.from('orders').select(ORDER_BOOK_SETTINGS_SELECT).eq('id', orderId)
  if (signal) q = q.abortSignal(signal)
  const combined = await q.maybeSingle()

  if (!combined.error && combined.data) {
    return parseBookSettingsFromOrderRow(combined.data as Record<string, unknown>)
  }

  if (combined.error && !isMissingBookSettingsColumn(combined.error)) {
    throw combined.error
  }

  let editorSkippedChapterIds: string[] = []
  let coverTitleFontPreset = normalizeCoverTitleFontPreset(null)

  let skipQ = supabase.from('orders').select('editor_skipped_chapter_ids').eq('id', orderId)
  if (signal) skipQ = skipQ.abortSignal(signal)
  const skipRes = await skipQ.maybeSingle()
  if (!skipRes.error && skipRes.data) {
    editorSkippedChapterIds = parseEditorSkippedChapterIds(
      (skipRes.data as { editor_skipped_chapter_ids?: unknown }).editor_skipped_chapter_ids,
    )
  } else if (skipRes.error && !isMissingPostgrestColumn(skipRes.error, 'editor_skipped_chapter_ids')) {
    throw skipRes.error
  }

  let coverQ = supabase.from('orders').select('cover_title_font_preset').eq('id', orderId)
  if (signal) coverQ = coverQ.abortSignal(signal)
  const coverRes = await coverQ.maybeSingle()
  if (!coverRes.error && coverRes.data) {
    coverTitleFontPreset = normalizeCoverTitleFontPreset(
      (coverRes.data as { cover_title_font_preset?: unknown }).cover_title_font_preset,
    )
  } else if (coverRes.error && !isMissingPostgrestColumn(coverRes.error, 'cover_title_font_preset')) {
    throw coverRes.error
  }

  return { editorSkippedChapterIds, coverTitleFontPreset }
}
