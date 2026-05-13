/**
 * Curated rectangle colors for fixed chapter pages (print-inspired palette).
 * Matches CMYK-inspired swatches; stored value must be one of these hex codes.
 */
export const FIXED_CHAPTER_RECT_PALETTE = [
  { hex: '#2E5078', label: 'Көгілдір' },
  { hex: '#5C2535', label: 'Қызыл қоңыр' },
  { hex: '#1A2E47', label: 'Теңіз көкі' },
  { hex: '#8B4D3D', label: 'Қызыл қоңыр ашық' },
  { hex: '#243E5C', label: 'Көк түйме' },
  { hex: '#C42828', label: 'Қызыл' },
  { hex: '#7A6B52', label: 'Жасыл қоңыр' },
  { hex: '#1E3558', label: 'Индиго' },
] as const

const HEX_SET = new Set(FIXED_CHAPTER_RECT_PALETTE.map((p) => p.hex.toUpperCase()))

function parseRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Snap unknown hex to nearest palette color (for legacy orders). */
export function normalizeFixedRectangleColor(input: string | null | undefined): string {
  const raw = (input || '').trim()
  const upper = raw.startsWith('#') ? raw.slice(1).toUpperCase() : raw.toUpperCase()
  const withHash = `#${upper}`
  if (HEX_SET.has(withHash)) return withHash

  const rgb = parseRgb(raw.startsWith('#') ? raw : `#${raw}`)
  if (!rgb) return FIXED_CHAPTER_RECT_PALETTE[0].hex

  let best: string = FIXED_CHAPTER_RECT_PALETTE[0].hex
  let bestD = Infinity
  for (const p of FIXED_CHAPTER_RECT_PALETTE) {
    const t = parseRgb(p.hex)!
    const d =
      (t[0] - rgb[0]) ** 2 + (t[1] - rgb[1]) ** 2 + (t[2] - rgb[2]) ** 2
    if (d < bestD) {
      bestD = d
      best = p.hex
    }
  }
  return best
}
