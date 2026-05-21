import type { SupabaseClient } from '@supabase/supabase-js'

export type OrderChapterFixedPhotoRow = {
  chapter_id: string
  photo_path: string | null
  phrase_override_kk?: string | null
}

/** Cached after first query — avoids repeated failed selects on older DBs. */
let phraseOverrideColumnAvailable: boolean | null = null

export function phraseOverrideColumnSupported(): boolean {
  return phraseOverrideColumnAvailable !== false
}

export function isMissingPostgrestColumn(err: unknown, column: string): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; details?: string; hint?: string }
  const blob = [e.message, e.details, e.hint].filter(Boolean).join(' ')
  return (
    e.code === '42703' ||
    e.code === 'PGRST204' ||
    blob.includes(column) ||
    (blob.includes('does not exist') && blob.toLowerCase().includes('phrase_override'))
  )
}

export function formatSupabaseError(err: unknown): string {
  if (!err || typeof err !== 'object') return err instanceof Error ? err.message : String(err ?? '')
  const e = err as { message?: string; details?: string; hint?: string; code?: string }
  const parts = [e.message, e.details, e.hint].map((s) => (s != null ? String(s).trim() : '')).filter(Boolean)
  const base = parts.join(' — ') || 'Unknown database error'
  return e.code ? `${base} (${e.code})` : base
}

async function selectFixedPhotos(
  supabase: SupabaseClient,
  orderId: string,
  withPhrase: boolean,
  signal?: AbortSignal,
) {
  const cols = withPhrase ? 'chapter_id, photo_path, phrase_override_kk' : 'chapter_id, photo_path'
  let q = supabase.from('order_chapter_fixed_photos').select(cols).eq('order_id', orderId)
  if (signal) q = q.abortSignal(signal)
  return q
}

/** Loads per-chapter fixed photos; falls back if `phrase_override_kk` is not migrated yet. */
export async function fetchOrderChapterFixedPhotos(
  supabase: SupabaseClient,
  orderId: string,
  signal?: AbortSignal,
): Promise<{ data: OrderChapterFixedPhotoRow[]; phraseOverrideSupported: boolean }> {
  if (phraseOverrideColumnAvailable === false) {
    const res = await selectFixedPhotos(supabase, orderId, false, signal)
    if (res.error) throw res.error
    return { data: (res.data ?? []) as unknown as OrderChapterFixedPhotoRow[], phraseOverrideSupported: false }
  }

  const res = await selectFixedPhotos(supabase, orderId, true, signal)
  if (!res.error) {
    phraseOverrideColumnAvailable = true
    return { data: (res.data ?? []) as unknown as OrderChapterFixedPhotoRow[], phraseOverrideSupported: true }
  }

  if (isMissingPostgrestColumn(res.error, 'phrase_override_kk')) {
    phraseOverrideColumnAvailable = false
    const fallback = await selectFixedPhotos(supabase, orderId, false, signal)
    if (fallback.error) throw fallback.error
    return { data: (fallback.data ?? []) as unknown as OrderChapterFixedPhotoRow[], phraseOverrideSupported: false }
  }

  throw res.error
}

export type OrderChapterFixedPhotoInsertRow = {
  order_id: string
  chapter_id: string
  photo_path: string | null
  phrase_override_kk?: string | null
}

/** Strips phrase override from rows when the column is not on the database yet. */
export function fixedPhotoRowsForInsert(
  rows: OrderChapterFixedPhotoInsertRow[],
): Record<string, unknown>[] {
  if (phraseOverrideColumnSupported()) return rows
  return rows.map(({ order_id, chapter_id, photo_path }) => ({
    order_id,
    chapter_id,
    photo_path,
  }))
}

/** Upsert by (order_id, chapter_id) — never wipe other chapters' photos. */
export async function upsertOrderChapterFixedPhotos(
  supabase: SupabaseClient,
  rows: OrderChapterFixedPhotoInsertRow[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('order_chapter_fixed_photos')
    .upsert(fixedPhotoRowsForInsert(rows), { onConflict: 'order_id,chapter_id' })
  if (error) throw error
}

export async function upsertOrderChapterFixedPhotoPath(
  supabase: SupabaseClient,
  orderId: string,
  chapterId: string,
  photoPath: string,
): Promise<void> {
  await upsertOrderChapterFixedPhotos(supabase, [
    { order_id: orderId, chapter_id: chapterId, photo_path: photoPath },
  ])
}
