const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Only valid UUIDs are sent to Postgres `uuid[]` (invalid ids are dropped). */
export function sanitizeEditorSkippedChapterIds(ids: string[] | undefined): string[] {
  const out: string[] = []
  for (const id of ids ?? []) {
    const s = String(id).trim().toLowerCase()
    if (s && UUID_RE.test(s)) out.push(s)
  }
  return [...new Set(out)]
}

/** Normalize `orders.editor_skipped_chapter_ids` from PostgREST (uuid[] or legacy shapes). */
export function parseEditorSkippedChapterIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s || s === '{}') return []
    try {
      const parsed = JSON.parse(s) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id).trim()).filter(Boolean)
      }
    } catch {
      return []
    }
  }
  return []
}

export function editorSkippedChapterIdSet(ids: string[] | undefined): Set<string> {
  return new Set((ids ?? []).map((id) => String(id).trim()).filter(Boolean))
}

export function isChapterSkippedInBook(chapterId: string, skipped: Set<string>): boolean {
  return skipped.has(chapterId)
}
