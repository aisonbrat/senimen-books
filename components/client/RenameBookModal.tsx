'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

type Props = {
  open: boolean
  orderId: string
  initialTitle: string
  onClose: () => void
  /** Called after successful save with trimmed title */
  onSaved: (orderId: string, newTitle: string) => void
}

export function RenameBookModal({ open, orderId, initialTitle, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setErr(null)
    }
  }, [open, initialTitle])

  if (!open) return null

  async function save() {
    const t = title.trim()
    if (!t) {
      setErr('Кітап атауын енгізіңіз')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('orders').update({ book_title: t }).eq('id', orderId)
      if (error) {
        setErr(error.message)
        return
      }
      onSaved(orderId, t)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-book-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rename-book-title" className="font-serif-display text-[1.15rem] font-semibold text-[color:var(--text-primary)]">
          Кітап атауын өзгерту
        </h2>
        <p className="mt-1 text-[12px] font-medium text-[color:var(--text-muted)]">
          Тек сіздің тізіміңізде көрінеді. Кітап түрі жақтағы белгі өзгермейді.
        </p>
        {err ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-red-200 bg-red-50/90 px-3 py-2 text-[12px] font-medium text-red-900">
            {err}
          </p>
        ) : null}
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            Жаңа атау
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-[14px] outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
            maxLength={200}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Сақталуда…' : 'Сақтау'}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Болдырмау
          </Button>
        </div>
      </div>
    </div>
  )
}
