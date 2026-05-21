'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  ADMIN_ORDERS_COLUMN_PRESETS,
  ADMIN_ORDERS_TABLE_COLUMNS,
  type AdminOrdersColumnId,
  type AdminOrdersColumnPresetId,
} from '@/lib/admin/adminOrdersTablePrefs'

type Props = {
  visibleColumns: Set<AdminOrdersColumnId>
  tableCompact: boolean
  onVisibleColumnsChange: (next: Set<AdminOrdersColumnId>) => void
  onTableCompactChange: (compact: boolean) => void
}

export function AdminOrdersTableControls({
  visibleColumns,
  tableCompact,
  onVisibleColumnsChange,
  onTableCompactChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const hideable = ADMIN_ORDERS_TABLE_COLUMNS.filter((c) => c.hideable)
  const hiddenCount = hideable.filter((c) => !visibleColumns.has(c.id)).length

  function toggleColumn(id: AdminOrdersColumnId, checked: boolean) {
    const next = new Set(visibleColumns)
    if (checked) next.add(id)
    else next.delete(id)
    onVisibleColumnsChange(next)
  }

  function applyPreset(preset: AdminOrdersColumnPresetId) {
    onVisibleColumnsChange(new Set(ADMIN_ORDERS_COLUMN_PRESETS[preset].columns))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 md:ml-auto">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--text-secondary)] shadow-[var(--shadow-xs)]">
        <input
          type="checkbox"
          checked={tableCompact}
          onChange={(e) => onTableCompactChange(e.target.checked)}
          className="size-3.5 accent-[color:var(--accent)]"
        />
        Қысқа көрініс
      </label>

      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            'inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-[12px] font-semibold shadow-[var(--shadow-xs)] transition-colors',
            open
              ? 'border-[color:var(--accent)] bg-[color:var(--accent-surface)] text-[color:var(--accent)]'
              : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]',
          )}
          aria-expanded={open}
        >
          Бағандар
          {hiddenCount > 0 ? (
            <span className="rounded-full bg-[color:var(--text-primary)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
              −{hiddenCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <div
            className="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,280px)] rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-md)]"
            role="dialog"
            aria-label="Кесте бағандары"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
              Көрсетілетін бағандар
            </p>
            <div className="mb-3 flex flex-wrap gap-1">
              {(Object.keys(ADMIN_ORDERS_COLUMN_PRESETS) as AdminOrdersColumnPresetId[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="rounded-[var(--radius-sm)] bg-[color:var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]"
                >
                  {ADMIN_ORDERS_COLUMN_PRESETS[key].label}
                </button>
              ))}
            </div>
            <ul className="max-h-[240px] space-y-1 overflow-y-auto pr-1">
              {hideable.map((col) => (
                <li key={col.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--surface-subtle)]">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.id)}
                      onChange={(e) => toggleColumn(col.id, e.target.checked)}
                      className="size-3.5 accent-[color:var(--accent)]"
                    />
                    {col.label}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-[color:var(--border)] pt-2 text-[10px] leading-relaxed text-[color:var(--text-muted)]">
              «Кітап» және «Жою» әрқашан көрінеді. Таңдау браузерде сақталады.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
