import type { OverlayVertical } from '@/lib/utils/overlayParts'

/** Horizontal inset from photo edges (mm). */
export const PHOTO_OVERLAY_HORIZONTAL_INSET_MM = 12

/** Extra inset from top/bottom photo edges so overlay copy does not hug the frame (mm). */
export const PHOTO_OVERLAY_VERTICAL_INSET_MM = 22

/** Side padding when overlay band is centered vertically (mm). */
export const PHOTO_OVERLAY_CENTER_BAND_INSET_MM = 14

export function photoOverlayFlexPaddingMm(vertical: OverlayVertical): {
  paddingTopMm: number
  paddingRightMm: number
  paddingBottomMm: number
  paddingLeftMm: number
} {
  const h = PHOTO_OVERLAY_HORIZONTAL_INSET_MM
  const vTop = vertical === 'top' ? PHOTO_OVERLAY_VERTICAL_INSET_MM : PHOTO_OVERLAY_CENTER_BAND_INSET_MM
  const vBottom = vertical === 'bottom' ? PHOTO_OVERLAY_VERTICAL_INSET_MM : PHOTO_OVERLAY_CENTER_BAND_INSET_MM
  return {
    paddingTopMm: vTop,
    paddingRightMm: h,
    paddingBottomMm: vBottom,
    paddingLeftMm: h,
  }
}
