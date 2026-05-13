import type { OverlayVertical } from '@/lib/utils/overlayParts'

/** Vertical bands where overlay headline may sit (same as overlay composite). */
export type QrVertical = OverlayVertical

/** Two tiers only — both larger than the former “орта” (~30 mm). */
export const QR_SIZE_LABELS = { lg: 'Ірі', xl: 'Ең ірі' } as const
export type QrSizeKey = keyof typeof QR_SIZE_LABELS

/** mm — outer placement box on page (white padding added around bitmap separately). */
export const QR_SIZE_MM: Record<QrSizeKey, number> = { lg: 36, xl: 46 }

/** Extra quiet zone inside the placement box (preview + PDF). */
export const QR_INTERIOR_PADDING_MM = 2.8

/** Rounded corners on the white plate behind the QR (preview + PDF). */
export const QR_BACKGROUND_RADIUS_MM = 2

/** Map DB values to lg | xl. Legacy sm/md → lg; runs against DB migrated so old largest `lg` → xl. */
export function normalizeQrSizeKey(raw: string | null | undefined): QrSizeKey {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (s === 'xl') return 'xl'
  if (s === 'lg') return 'lg'
  if (s === 'sm' || s === 'md') return 'lg'
  return 'lg'
}

/** When QR occupies `qrBand`, overlay text may use only these bands. */
export function allowedOverlayVerticalsWhenQrSet(qrBand: QrVertical): OverlayVertical[] {
  if (qrBand === 'top') return ['center', 'bottom']
  if (qrBand === 'center') return ['top', 'bottom']
  return ['top', 'center']
}

/** If overlay is at `textBand`, QR may only use these bands. */
export function allowedQrVerticalsWhenOverlayAt(textBand: OverlayVertical): QrVertical[] {
  if (textBand === 'top') return ['center', 'bottom']
  if (textBand === 'center') return ['top', 'bottom']
  return ['top', 'center']
}

export function pickFallbackOverlayVertical(wanted: OverlayVertical, allowed: OverlayVertical[]): OverlayVertical {
  if (allowed.includes(wanted)) return wanted
  return allowed[0] ?? 'center'
}

export function pickFallbackQrVertical(wanted: QrVertical, allowed: QrVertical[]): QrVertical {
  if (allowed.includes(wanted)) return wanted
  return allowed[0] ?? 'center'
}
