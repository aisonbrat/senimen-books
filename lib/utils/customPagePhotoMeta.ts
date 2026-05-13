/**
 * Photo custom pages encode grid slot count in `title_kk`: `count:1|2|4`.
 * Overlay shadow uses DB column `overlay_shadow_opacity` (see migration).
 */

export function getPhotoCountFromTitleKk(title_kk?: string | null): number {
  if (!title_kk) return 1
  const m = title_kk.match(/^count:(\d+)/)
  if (!m) return 1
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 4 ? n : 1
}

/** Normalize persisted title_kk after changing photo grid slots */
export function formatPhotoTitleKkCount(title_kk: string | null | undefined, count: number): string {
  const n = count >= 1 && count <= 4 ? count : 1
  return `count:${n}`
}

/** Prefer DB column; fallback legacy `title_kk` suffix `|sh:N`. */
export function resolveOverlayShadowOpacity(
  cp: { overlay_shadow_opacity?: number | null; title_kk?: string | null } | null | undefined,
): number {
  const raw = cp?.overlay_shadow_opacity
  if (raw != null && Number.isFinite(Number(raw))) {
    return Math.min(100, Math.max(0, Math.round(Number(raw))))
  }
  const m = cp?.title_kk?.match(/\|sh:(\d+)/i)
  if (m) return Math.min(100, Math.max(0, parseInt(m[1], 10)))
  return 45
}
