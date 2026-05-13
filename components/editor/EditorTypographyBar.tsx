'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useEditorStore } from '@/lib/store/editorStore'
import type { AnswerTextAlign } from '@/lib/bookLayout'
import { GLOBAL_FONT_PRESETS, type AnswerFontPreset } from '@/lib/bookLayout'

const GLOBAL_LABELS: Record<AnswerFontPreset, string> = {
  '14': '14',
  '16': '16',
  '18': '18',
  '20': '20',
  '22': '22',
}

interface Props {
  onChanged?: () => void
  disabled?: boolean
  /** Collapsible panel (e.g. mobile) to save vertical space */
  collapsible?: boolean
  /** When collapsible: start collapsed */
  defaultCollapsed?: boolean
  /**
   * Inside `EditorDashboardSettingsDeck`: strip outer borders and collapse toggle;
   * show section label only.
   */
  embedded?: boolean
}

export function EditorTypographyBar({
  onChanged,
  disabled,
  collapsible,
  defaultCollapsed,
  embedded,
}: Props) {
  const preset = useEditorStore((s) => s.answerFontPreset)
  const align = useEditorStore((s) => s.answerTextAlign)
  const setAnswerTypography = useEditorStore((s) => s.setAnswerTypography)

  const [open, setOpen] = useState(collapsible ? defaultCollapsed === false : true)

  const typographyCols = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          Мәтін өлшемі
        </p>
        <SegmentedControl
          fullWidth
          value={preset}
          onChange={(v) => {
            if (disabled || !(GLOBAL_FONT_PRESETS as readonly string[]).includes(v)) return
            setAnswerTypography({ preset: v as AnswerFontPreset })
            onChanged?.()
          }}
          options={GLOBAL_FONT_PRESETS.map((px) => ({
            value: px,
            label: GLOBAL_LABELS[px],
          }))}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          Туралау
        </p>
        <SegmentedControl
          fullWidth
          value={align}
          onChange={(v) => {
            if (disabled || (v !== 'justify' && v !== 'left')) return
            setAnswerTypography({ align: v as AnswerTextAlign })
            onChanged?.()
          }}
          options={[
            { value: 'justify', label: 'Екі жақтан' },
            { value: 'left', label: 'Солға' },
          ]}
        />
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Мәтін баптаулары (өлшем · туралау)
        </p>
        {typographyCols}
      </div>
    )
  }

  if (!collapsible) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
        {typographyCols}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] shadow-[var(--shadow-xs)]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-60 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Мәтін баптаулары (өлшем · туралау)
        </span>
        <span className="text-[11px] font-semibold leading-snug text-[color:var(--accent)] sm:text-right">
          {open ? 'Жасыру' : 'Көрсету'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[color:var(--border)] px-2 pb-3 pt-2 sm:px-3">
          <div className="px-1">{typographyCols}</div>
        </div>
      ) : null}
    </div>
  )
}
