/** Effective band text for a fixed chapter page in preview/PDF. */
export function resolveOrderFixedPhrase(
  chapterId: string,
  catalogPhrase: string | null | undefined,
  overrides: Record<string, string> | undefined,
): string {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, chapterId)) {
    return String(overrides[chapterId] ?? '').trim()
  }
  return String(catalogPhrase ?? '').trim()
}

/** DB column: null when override matches catalog (or both empty). */
export function phraseOverrideForDb(
  overrideRaw: string | undefined,
  catalogPhrase: string | null | undefined,
): string | null {
  const o = String(overrideRaw ?? '').trim()
  const c = String(catalogPhrase ?? '').trim()
  if (o === c) return null
  return o || null
}
