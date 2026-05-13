/** Default bottom band for fixed chapter pages (dark brown). */
export const DEFAULT_FIXED_RECT_COLOR = '#4A2C2A'

/** Parse #RRGGBB (or RRGGBB) to RGB 0–255; invalid input falls back to default. */
export function parseCssHexColor(input: string | null | undefined): [number, number, number] {
  const raw = (input || '').trim()
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  if (hex.length === 6 && /^[0-9a-fA-F]+$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  const d = DEFAULT_FIXED_RECT_COLOR.slice(1)
  return [parseInt(d.slice(0, 2), 16), parseInt(d.slice(2, 4), 16), parseInt(d.slice(4, 6), 16)]
}

export function normalizeHexColor(input: string | null | undefined): string {
  const raw = (input || '').trim()
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  if (hex.length === 6 && /^[0-9a-fA-F]+$/i.test(hex)) {
    return `#${hex.toUpperCase()}`
  }
  return DEFAULT_FIXED_RECT_COLOR
}
