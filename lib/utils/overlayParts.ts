/** Shared overlay UI ↔ preview ↔ PDF (vertical anchor + background style). */
export type OverlayBgType = 'none' | 'gradient' | 'solid'
export type OverlayVertical = 'top' | 'center' | 'bottom'

export function normalizeOverlayComposite(raw?: string | null): {
  vertical: OverlayVertical
  bg: OverlayBgType
  composite: string
} {
  const fallback = 'bottom:gradient'
  const s = (raw || fallback).trim()
  const parts = s.split(':')
  const v0 = (parts[0] || 'bottom').toLowerCase()
  const vertical = (['top', 'center', 'bottom'].includes(v0) ? v0 : 'bottom') as OverlayVertical
  const g0 = (parts[1] || 'gradient').toLowerCase()
  const bg = (['none', 'gradient', 'solid'].includes(g0) ? g0 : 'gradient') as OverlayBgType
  return { vertical, bg, composite: `${vertical}:${bg}` }
}
