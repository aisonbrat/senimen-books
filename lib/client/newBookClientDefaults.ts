export type NewBookClientDefaults = {
  author_name: string
  delivery_address: string
  recipient_name: string
}

const STORAGE_VER = 'v1'

function storageKey(userId: string) {
  return `senimen:newbook:defaults:${STORAGE_VER}:${userId}`
}

/** Skip the «Кітап туралы» form only after a prior successful completion on this device (localStorage). */
export function getStoredNewBookSkipDefaults(userId: string): NewBookClientDefaults | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NewBookClientDefaults>
    const author = typeof parsed.author_name === 'string' ? parsed.author_name.trim() : ''
    const addr = typeof parsed.delivery_address === 'string' ? parsed.delivery_address.trim() : ''
    if (!author || !addr) return null
    const rec =
      typeof parsed.recipient_name === 'string' && parsed.recipient_name.trim()
        ? parsed.recipient_name.trim()
        : 'Алушы'
    return { author_name: author, delivery_address: addr, recipient_name: rec }
  } catch {
    return null
  }
}

/**
 * Pre-fill the manual form only: last order hints + optional localStorage snippet.
 * Does not enable auto-skip and does not write to localStorage when reading orders.
 */
export async function fetchNewBookFormPrefill(
  supabase: { from: (t: string) => any },
  userId: string
): Promise<Partial<NewBookClientDefaults> | null> {
  const merged: Partial<NewBookClientDefaults> = {}

  const stored = getStoredNewBookSkipDefaults(userId)
  if (stored) {
    Object.assign(merged, stored)
  }

  const { data, error } = await supabase
    .from('orders')
    .select('author_name, delivery_address, recipient_name')
    .eq('client_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!error && data) {
    const a = String(data.author_name ?? '').trim()
    const d = String(data.delivery_address ?? '').trim()
    const r = String(data.recipient_name ?? '').trim()
    if (a && !merged.author_name) merged.author_name = a
    if (d && !merged.delivery_address) merged.delivery_address = d
    if (r && !merged.recipient_name) merged.recipient_name = r
  }

  return Object.keys(merged).length ? merged : null
}

export function persistNewBookClientDefaults(userId: string, d: NewBookClientDefaults) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(d))
  } catch {
    /* quota / private mode */
  }
}
