import type { SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'

type StorageLikeError = {
  message?: string
  statusCode?: string | number
  error?: string
}

export function formatStorageLikeError(e: StorageLikeError | null | undefined): string {
  if (!e) return 'Белгісіз қате'
  if (!e.message && !e.error) return 'Белгісіз қате'
  const msg = e.message || ''
  const rest = e.statusCode != null ? ` [HTTP ${e.statusCode}]` : ''
  const extra = 'error' in e && e.error ? ` (${String(e.error)})` : ''
  return `${msg}${rest}${extra}`.trim()
}

/**
 * Shows why Storage upload failed (quota/RLS/auth/bucket) so we are not blind in production.
 */
export async function showStorageUploadAlert(
  supabase: SupabaseClient,
  orderId: string,
  shortLabel: string,
  storageError: StorageLikeError | null,
  caught?: unknown
): Promise<void> {
  if (typeof window === 'undefined') return

  const lines: string[] = [shortLabel, formatStorageLikeError(storageError)]
  if (caught != null) {
    const c = caught instanceof Error ? caught.message : String(caught)
    if (c && c !== formatStorageLikeError(storageError)) lines.push(`Код: ${c}`)
  }

  const { data: auth } = await supabase.auth.getSession()
  lines.push(auth.session ? 'Сессия: кіру бар' : 'Сессия: кіру жоқ (қайта кіріңіз)')

  const em = (storageError?.message || '').toLowerCase()
  if (em.includes('quota') || em.includes('exceed') || (em.includes('space') && em.includes('storage'))) {
    lines.push('Болжам: жоба диск шегі толық — Dashboard → Project Settings → Usage.')
  }

  const denied =
    storageError?.statusCode === 403 ||
    storageError?.statusCode === '403' ||
    /policy|rls|permission|denied|not authorized|jwt/i.test(storageError?.message || '')
  if (denied) {
    lines.push(
      '403 болса: Postgres storage.objects саясатында bucket_id — UUID (storage.buckets.id). Салыстыру: bucket_id in (select id from storage.buckets where name = \'book-photos\') және public.user_can_read_book_photos_object(name). JS клиентте .from() үшін шелек атауы: book-photos.'
    )
  }

  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET_BOOK_PHOTOS).list(orderId, {
    limit: 1,
  })
  if (listErr) {
    lines.push(`Ордер қалтасын оқу: ${listErr.message}`)
  } else {
    lines.push('Ордер қалтасын оқу сынағы: OK')
  }

  window.alert(lines.join('\n\n'))
}
