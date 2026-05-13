import type { SVGProps } from 'react'

/**
 * Icon library — handcrafted set, all 24×24 viewBox, all stroke 1.75 (the same
 * weight as Lucide/Phosphor "regular"), all rounded line-caps + line-joins.
 * One stroke-width across the entire UI is what makes the icon set feel
 * cohesive. The only exception is `IconSparkles`, which uses a partial fill
 * for its inner star — by design.
 *
 * Add icons here only — never inline SVG in components.
 */

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

const STROKE = 1.75

const baseProps = {
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeWidth: STROKE,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconX({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

/** Return one step — document version undo (Word-style). */
export function IconUndo({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M9 18 3 12l6-6" />
      <path d="M3 12h10.5a5.5 5.5 0 0 1 0 11H8" />
    </svg>
  )
}

/** Restore after version undo (Word-style redo). */
export function IconRedo({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M15 18l6-6-6-6" />
      <path d="M21 12H10.5a5.5 5.5 0 0 0 0 11H8" />
    </svg>
  )
}

export function IconChevronLeft({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function IconChevronRight({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function IconChevronDown({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconPlus({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconCamera({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export function IconDocument({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}

export function IconEye({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5Z" />
      <circle cx="12" cy="12.5" r="3.25" />
    </svg>
  )
}

export function IconPencil({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export function IconTrash({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M3 6h18" />
      <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  )
}

export function IconQuotes({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M7 9a4 4 0 1 0 4 4H7V9zM17 9a4 4 0 1 0 4 4h-4V9z" />
    </svg>
  )
}

/**
 * Sparkles — only icon that uses fill, so the inner star reads at small sizes.
 * Override stroke-width slightly lighter to keep the burst from looking bossy.
 */
export function IconSparkles({ className, ...p }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...p}
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <path d="M12 8.5l1.4 2.1L15.5 12l-2.1 1.4L12 15.5l-1.4-2.1L8.5 12l2.1-1.4L12 8.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconRows({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

export function IconCheck({ className, ...p }: IconProps) {
  return (
    <svg {...baseProps} className={className} {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/** Filled circle dot used as a status indicator inside chips. */
export function IconDot({ className, ...p }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...p}>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  )
}
