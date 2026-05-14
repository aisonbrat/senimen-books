'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { Order } from '@/lib/types'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'

interface Props {
  order: Pick<Order, 'admin_cover_print_path'> | null
  disabled?: boolean
  uploadAdminCoverPrint: (file: File) => void | Promise<void>
  /** Nested in unified settings strip — strips outer chrome. */
  embedded?: boolean
}

/** Print-only jacket art for admin/production — never composited into preview spreads or export PDF. */
export function ClientCoverPrintPanel({
  order,
  disabled,
  uploadAdminCoverPrint,
  embedded = false,
}: Props) {
  const [busy, setBusy] = useState(false)
  const path = String(order?.admin_cover_print_path ?? '').trim()

  const intro = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        Басты бет мұқабасы (техникалық баспа)
      </p>
      <p className="mt-1.5 max-w-[60ch] text-[11px] font-medium leading-relaxed text-[color:var(--text-secondary)]">
        Бұл файл <strong className="font-semibold text-[color:var(--text-primary)]">алдын ала көруге және PDF экспортқа кірмейді</strong> — тек
        менеджер тапсырыс бойынша мұқаба файлын және беттер PDF-ті бөлек жүктеп алады.
      </p>
    </>
  )

  const body = (
    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex shrink-0 items-center justify-center gap-4 sm:justify-start">
        {path ? (
          <SignedBookPhotoImg
            storageRef={path}
            alt=""
            className="size-24 rounded-[var(--radius-md)] object-cover shadow-[var(--shadow-xs)] ring-1 ring-[color:var(--border)]"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--surface-subtle)] text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] ring-1 ring-[color:var(--border)]">
            Жоқ
          </div>
        )}
      </div>
      <label className={clsx('flex flex-1 flex-col gap-2 sm:max-w-xs', disabled && 'cursor-not-allowed opacity-50')}>
        <span className="text-[11px] font-semibold text-[color:var(--text-secondary)]">
          Файл таңдау (JPEG / PNG …)
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || busy}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f || disabled) return
            setBusy(true)
            try {
              await uploadAdminCoverPrint(f)
            } finally {
              setBusy(false)
              e.target.value = ''
            }
          }}
        />
        <span
          className={clsx(
            'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-4 text-[12px] font-semibold text-white shadow-[var(--shadow-xs)] transition-[filter,opacity] touch-manipulation',
            disabled ? 'bg-[color:var(--text-muted)]' : 'bg-[color:var(--accent)] hover:brightness-105'
          )}
        >
          {busy ? 'Жүктелуде…' : path.trim() ? 'Мұқабаны ауыстыру' : 'Мұқабаны қосу'}
        </span>
      </label>
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>{intro}</div>
        {body}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-xs)]">
      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3">
        {intro}
      </div>
      <div className="px-4 py-4">{body}</div>
    </div>
  )
}
