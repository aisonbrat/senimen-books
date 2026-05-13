import { clsx } from 'clsx'
import type { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional explicit height (e.g. 14, "1rem"). Defaults to 12px. */
  height?: number | string
  /** Optional explicit width (e.g. 120, "60%"). Defaults to 100%. */
  width?: number | string
  /** Use circle for avatar-style placeholders. */
  shape?: 'rect' | 'pill' | 'circle'
}

/**
 * Skeleton placeholder — token-driven, GPU-friendly shimmer using the surface
 * subtle background. Use this everywhere instead of ad-hoc `animate-pulse`
 * divs to keep loading states consistent across the app.
 */
export function Skeleton({
  height = 12,
  width = '100%',
  shape = 'rect',
  className,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={clsx(
        'skeleton-shimmer',
        shape === 'rect' && 'rounded-[var(--radius-sm)]',
        shape === 'pill' && 'rounded-full',
        shape === 'circle' && 'rounded-full aspect-square',
        className
      )}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
        ...style,
      }}
      {...props}
    />
  )
}
