'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useEditorStore } from '@/lib/store/editorStore'
import {
  COVER_TITLE_FONT_PRESETS,
  type CoverTitleFontPreset,
} from '@/lib/bookLayout'

const PRESET_LABELS: Record<CoverTitleFontPreset, string> = {
  '11': '11',
  '13.5': '13.5',
  '15': '15',
  '17': '17',
  '20': '20',
}

interface Props {
  disabled?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
  embedded?: boolean
}

export function CoverTitleTypographyBar({
  disabled,
  collapsible,
  defaultCollapsed,
  embedded,
}: Props) {
  const preset = useEditorStore((s) => s.coverTitleFontPreset)
  const setCoverTitleFontPreset = useEditorStore((s) => s.setCoverTitleFontPreset)
  const [open, setOpen] = useState(collapsible ? defaultCollapsed === false : true)

  const control = (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        Мұқаба тақырыбы (мм)
      </p>
      <SegmentedControl
        fullWidth
        value={preset}
        onChange={(v) => {
          if (disabled || !(COVER_TITLE_FONT_PRESETS as readonly string[]).includes(v)) return
          setCoverTitleFontPreset(v as CoverTitleFontPreset)
        }}
        options={COVER_TITLE_FONT_PRESETS.map((px) => ({
          value: px,
          label: PRESET_LABELS[px],
        }))}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
        Бірінші беттегі негізгі тақырып өлшемі. Алдын ала қарау мен PDF бірдей (PDF алдында «Сақтау» немесе экспорт батырмасын басыңыз).
      </p>
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Мұқаба тақырыбы
        </span>
        {control}
      </div>
    )
  }

  if (!collapsible) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 sm:px-4">
        {control}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-xs)]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left sm:px-4"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Мұқаба тақырыбы (өлшем)
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-[color:var(--accent)]">
          {open ? 'Жасыру' : 'Көрсету'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-4 sm:px-4">
          {control}
        </div>
      ) : null}
    </div>
  )
}
