import type { SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'
import type { OrderChapterFixedPhotoInsertRow } from '@/lib/supabase/orderChapterFixedPhotos'
import { upsertOrderChapterFixedPhotos } from '@/lib/supabase/orderChapterFixedPhotos'

const FIXED_CHAPTER_FILE_RE = /^fixed-chapter-([0-9a-f-]{36})-/i

/**
 * When DB rows lost `photo_path` (e.g. old delete-all save), re-link from Storage objects
 * under `{orderId}/fixed-chapter-{chapterId}-*`.
 */
export async function recoverFixedChapterPhotosFromStorage(
  supabase: SupabaseClient,
  orderId: string,
  chapterIds: string[],
  existing: Record<string, string>,
): Promise<Record<string, string>> {
  const merged = { ...existing }
  const missing = chapterIds.filter((id) => !merged[id]?.trim())
  if (missing.length === 0) return merged

  const { data: files, error } = await supabase.storage
    .from(STORAGE_BUCKET_BOOK_PHOTOS)
    .list(orderId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })

  if (error || !files?.length) return merged

  const latestByChapter = new Map<string, string>()
  for (const file of files) {
    const name = file.name?.trim()
    if (!name) continue
    const m = name.match(FIXED_CHAPTER_FILE_RE)
    if (!m) continue
    const chapterId = m[1]
    if (!missing.includes(chapterId) || latestByChapter.has(chapterId)) continue
    latestByChapter.set(chapterId, `${orderId}/${name}`)
  }

  for (const [chapterId, path] of latestByChapter) {
    merged[chapterId] = path
  }

  return merged
}

/** Persist recovered storage paths back to `order_chapter_fixed_photos`. */
export async function repairFixedChapterPhotoRows(
  supabase: SupabaseClient,
  orderId: string,
  photos: Record<string, string>,
  previous: Record<string, string>,
): Promise<void> {
  const rows: OrderChapterFixedPhotoInsertRow[] = []
  for (const [chapterId, path] of Object.entries(photos)) {
    if (!path.trim() || previous[chapterId]?.trim() === path.trim()) continue
    rows.push({ order_id: orderId, chapter_id: chapterId, photo_path: path.trim() })
  }
  if (rows.length === 0) return
  await upsertOrderChapterFixedPhotos(supabase, rows)
}
