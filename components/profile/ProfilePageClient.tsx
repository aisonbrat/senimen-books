'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { orderStatusLabel } from '@/lib/design/order-status'
import { RenameBookModal } from '@/components/client/RenameBookModal'

const ROLE_KK: Record<string, string> = {
  client: 'Клиент',
  editor: 'Редактор',
  admin: 'Админ',
  manager: 'Менеджер',
  designer: 'Дизайнер',
}

type BookRow = {
  id: string
  book_title: string
  category_id: string | null
  status: string
}

export function ProfilePageClient() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [role, setRole] = useState<string>('client')
  const [books, setBooks] = useState<BookRow[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})

  const [currentPassword, setCurrentPassword] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; book_title: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      const uid = authData?.user?.id
      if (authErr || !uid) {
        setLoadError('Кіру қажет')
        return
      }
      const { data: prof, error: perr } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', uid)
        .maybeSingle()
      const { data: phoneRow, error: phErr } = await supabase
        .from('profile_phones')
        .select('phone')
        .eq('profile_id', uid)
        .maybeSingle()
      if (perr || phErr) {
        setLoadError(perr?.message || phErr?.message || 'Жүктеу қатесі')
        return
      }
      setFullName(prof?.full_name ?? null)
      setPhone(phoneRow?.phone != null ? String(phoneRow.phone) : null)
      setRole(String(prof?.role ?? 'client'))

      if (String(prof?.role ?? 'client') === 'client') {
        const [ordRes, catRes] = await Promise.all([
          supabase.from('orders').select('id, book_title, category_id, status').eq('client_id', uid).order('created_at', { ascending: false }),
          supabase.from('categories').select('id, title_kk'),
        ])
        if (ordRes.error) {
          setLoadError(ordRes.error.message)
          return
        }
        setBooks((ordRes.data as BookRow[]) || [])
        const cm: Record<string, string> = {}
        catRes.data?.forEach((c: { id: string; title_kk: string }) => {
          cm[c.id] = c.title_kk
        })
        setCategories(cm)
      } else {
        setBooks([])
        setCategories({})
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (!currentPassword.trim()) {
      setErr('Қазіргі құпия сөзді енгізіңіз')
      return
    }
    if (pw1.length < 8) {
      setErr('Жаңа құпия сөз кем дегенде 8 таңба болуы тиіс')
      return
    }
    if (pw1 !== pw2) {
      setErr('Құпия сөздер сәйкес келмейді')
      return
    }
    setBusy(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const email = authData?.user?.email
      if (!email) {
        setErr('Пошта табылмады. Қолдауға хабарласыңыз.')
        return
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signErr) {
        setErr('Қазіргі құпия сөз дұрыс емес')
        return
      }
      const { error } = await supabase.auth.updateUser({ password: pw1 })
      if (error) setErr(error.message)
      else {
        setMsg('Құпия сөз жаңартылды.')
        setCurrentPassword('')
        setPw1('')
        setPw2('')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <p className="text-center text-[13px] font-medium text-[color:var(--text-muted)]">Жүктелуде…</p>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50/90 px-4 py-3 text-[13px] font-medium text-red-900">
        {loadError}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <Card padding="md" className="shadow-[var(--shadow-xs)]">
        <h2 className="font-serif-display text-[1.1rem] font-semibold text-[color:var(--text-primary)]">
          Жеке ақпарат
        </h2>
        <p className="mt-1 text-[12px] font-medium text-[color:var(--text-muted)]">
          Тек құпия сөзді өзгертуге болады. Басқа өрістерді өзгерту үшін әкімшіге хабарласыңыз.
        </p>
        <dl className="mt-5 space-y-3 text-[13px]">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 font-semibold text-[color:var(--text-muted)]">Рөл</dt>
            <dd className="text-[color:var(--text-primary)]">{ROLE_KK[role] ?? role}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 font-semibold text-[color:var(--text-muted)]">Аты-жөні</dt>
            <dd className="text-[color:var(--text-primary)]">{fullName?.trim() || '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 font-semibold text-[color:var(--text-muted)]">Телефон</dt>
            <dd className="font-mono text-[color:var(--text-primary)]">{phone?.trim() || '—'}</dd>
          </div>
        </dl>
      </Card>

      {role === 'client' && books.length > 0 ? (
        <Card padding="md" className="shadow-[var(--shadow-xs)]">
          <h2 className="font-serif-display text-[1.1rem] font-semibold text-[color:var(--text-primary)]">
            Кітаптарым
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {books.map((b) => {
              const canRename = b.status === 'filling'
              return (
                <li
                  key={b.id}
                  className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-[13px]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[color:var(--text-primary)]">{b.book_title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-medium text-[color:var(--text-muted)]">
                        {b.category_id && categories[b.category_id] ? (
                          <span className="rounded-[var(--radius-sm)] bg-[color:var(--accent-surface)] px-2 py-0.5 text-[color:var(--accent)]">
                            {categories[b.category_id]}
                          </span>
                        ) : null}
                        <span>{orderStatusLabel(b.status)}</span>
                      </div>
                    </div>
                    {canRename ? (
                      <button
                        type="button"
                        className="shrink-0 text-[11px] font-semibold text-[color:var(--accent)] underline decoration-[color:var(--accent)] underline-offset-2 hover:no-underline"
                        onClick={() => setRenameTarget({ id: b.id, book_title: b.book_title })}
                      >
                        Атауын өзгерту
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <Card padding="md" className="shadow-[var(--shadow-xs)]">
        <h2 className="font-serif-display text-[1.1rem] font-semibold text-[color:var(--text-primary)]">
          Құпия сөзді өзгерту
        </h2>
        {msg ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[13px] font-medium text-emerald-900">
            {msg}
          </p>
        ) : null}
        {err ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-red-200 bg-red-50/90 px-3 py-2 text-[13px] font-medium text-red-900">
            {err}
          </p>
        ) : null}
        <form className="mt-4 flex flex-col gap-3" onSubmit={changePassword}>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Қазіргі құпия сөз
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-[14px] outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Жаңа құпия сөз
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-[14px] outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
              minLength={8}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Қайталау
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-[14px] outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
              minLength={8}
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full sm:w-auto">
            {busy ? 'Сақталуда…' : 'Сақтау'}
          </Button>
        </form>
      </Card>

      <RenameBookModal
        open={!!renameTarget}
        orderId={renameTarget?.id ?? ''}
        initialTitle={renameTarget?.book_title ?? ''}
        onClose={() => setRenameTarget(null)}
        onSaved={(orderId, newTitle) => {
          setBooks((prev) => prev.map((b) => (b.id === orderId ? { ...b, book_title: newTitle } : b)))
        }}
      />
    </div>
  )
}
