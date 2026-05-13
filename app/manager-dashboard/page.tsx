'use client'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import {
  managerCreateClient,
  managerGrantBookAccess,
  managerRevokeBookAccess,
  managerDeleteClient,
  managerSetOrderClientAiEnabled,
} from './actions'
import { IconX } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { SiteHeader } from '@/components/shell/SiteHeader'
import { innerPhoneDigitsKeyDown } from '@/components/auth'
import {
  clampPhoneFieldDigitBuffer,
  formatInnerPhoneInputDisplay,
  formatPhoneForDisplay,
} from '@/lib/utils/phone'
import { orderStatusWorkspacePill, orderStatusDotColor, orderStatusLabel, ORDER_STATUS_ORDER } from '@/lib/design/order-status'

interface ClientProfile {
  id: string
  full_name: string | null
  phone: string | null
  role: string
  created_at: string
}
interface OrderRow {
  id: string
  client_id: string
  book_title: string | null
  category_id: string | null
  status: string
  created_at: string
  client_ai_enabled?: boolean
}
interface CategoryRow {
  id: string
  title_kk: string
}

const PW_MIN = 8

type InviteFormState = { full_name: string; phone_digits: string; password: string }
const emptyInviteForm = (): InviteFormState => ({ full_name: '', phone_digits: '', password: '' })

const fieldCls = clsx(
  'w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)]',
  'px-3.5 py-2.5 text-[13px] text-[color:var(--text-primary)] outline-none',
  'transition-[border-color,box-shadow] duration-[var(--transition)] placeholder:text-[color:var(--text-muted)]',
  'focus:border-[color:var(--border-strong)] focus:ring-2 focus:ring-[color:var(--accent-ring)]'
)
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)] mb-1.5'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[460px] rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface)] p-7 shadow-[var(--shadow-xl)]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-[color:var(--text-primary)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Жабу"
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]"
          >
            <IconX className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function UserFormFields({
  form,
  setForm,
  prefix,
}: {
  form: InviteFormState
  setForm: (f: InviteFormState) => void
  prefix: string
}) {
  void prefix
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelCls}>Аты-жөні</label>
        <input
          className={fieldCls}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
          placeholder="Толық атын жазыңыз"
        />
      </div>
      <div>
        <label className={labelCls}>Телефон нөмірі</label>
        <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] transition-[border-color,box-shadow] duration-[var(--transition)] focus-within:border-[color:var(--border-strong)] focus-within:ring-2 focus-within:ring-[color:var(--accent-ring)]">
          <span className="flex shrink-0 items-center pl-3.5 pr-1 text-[13px] font-semibold text-[color:var(--text-primary)]">
            +7
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={13}
            value={formatInnerPhoneInputDisplay(form.phone_digits)}
            onChange={(e) => {
              const raw = clampPhoneFieldDigitBuffer(e.currentTarget.value)
              setForm({ ...form, phone_digits: raw })
            }}
            onKeyDown={(e) =>
              innerPhoneDigitsKeyDown(e, form.phone_digits, (raw) => setForm({ ...form, phone_digits: raw }))
            }
            required
            placeholder="707 000 00 00"
            className="min-w-0 flex-1 bg-transparent py-2.5 pr-3.5 text-[13px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Уақытша құпия сөз</label>
        <input
          className={fieldCls}
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={PW_MIN}
          placeholder="Кем дегенде 8 таңба"
        />
      </div>
    </div>
  )
}

export default function ManagerDashboardPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<ClientProfile[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [giveAccessUser, setGiveAccessUser] = useState<ClientProfile | null>(null)

  const [createForm, setCreateForm] = useState(emptyInviteForm)
  const [accessCategoryId, setAccessCategoryId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [aiUpdatingOrderId, setAiUpdatingOrderId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [profRes, ordRes, catRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }),
        supabase.from('orders').select('id, client_id, book_title, category_id, status, created_at, client_ai_enabled'),
        supabase.from('categories').select('id, title_kk'),
      ])
      const errMsg = profRes.error?.message || ordRes.error?.message || catRes.error?.message || null
      if (errMsg) {
        setLoadError(errMsg); setUsers([]); setOrders([]); setCategories([])
        return
      }
      const rows = (profRes.data as ClientProfile[]) || []
      const clientIds = rows.map((u) => u.id)
      const phoneRes =
        clientIds.length > 0
          ? await supabase.from('profile_phones').select('profile_id, phone').in('profile_id', clientIds)
          : { data: [] as { profile_id: string; phone: string | null }[], error: null }
      if (phoneRes.error) {
        setLoadError(phoneRes.error.message); setUsers([]); setOrders([]); setCategories([])
        return
      }
      const phoneById = new Map<string, string | null>()
      ;(phoneRes.data || []).forEach((r: { profile_id: string; phone: string | null }) => {
        phoneById.set(r.profile_id, r.phone)
      })
      setUsers(rows.map((u) => ({ ...u, phone: phoneById.get(u.id) ?? null })))
      setOrders((ordRes.data as OrderRow[]) || [])
      setCategories((catRes.data as CategoryRow[]) || [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Жүктеу қатесі')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      void fetchAll()
    })
    return () => { cancelled = true }
  }, [router, supabase, fetchAll])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function userOrders(userId: string) {
    return orders.filter((o) => o.client_id === userId)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (createForm.password.length < PW_MIN) {
      setError('Уақытша құпия сөз кем дегенде 8 таңба болуы тиіс')
      return
    }
    startTransition(async () => {
      const res = await managerCreateClient({
        full_name: createForm.full_name,
        phone: createForm.phone_digits,
        password: createForm.password,
      })
      if (res.error) { setError(res.error); return }
      setShowCreate(false)
      setCreateForm(emptyInviteForm())
      void fetchAll()
    })
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`«${name}» клиентін өшіру? Бұл әрекетті қайтару мүмкін емес.`)) return
    startTransition(async () => {
      const res = await managerDeleteClient(userId)
      if (res.error) { setError(res.error); return }
      void fetchAll()
    })
  }

  async function handleDeleteOrder(orderId: string, catName: string) {
    if (!confirm(`«${catName}» кітабын клиенттен алып тастау?`)) return
    startTransition(async () => {
      const res = await managerRevokeBookAccess(orderId)
      if (res.error) { setError(res.error); return }
      void fetchAll()
    })
  }

  async function handleToggleOrderAi(orderId: string, enabled: boolean) {
    setError(null)
    setAiUpdatingOrderId(orderId)
    try {
      const res = await managerSetOrderClientAiEnabled(orderId, enabled)
      if (res.error) { setError(res.error); return }
      await fetchAll()
    } finally {
      setAiUpdatingOrderId(null)
    }
  }

  async function handleGiveAccess(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!giveAccessUser || !accessCategoryId) return
    const alreadyHas = orders.some((o) => o.client_id === giveAccessUser.id && o.category_id === accessCategoryId)
    if (alreadyHas) { setError('Бұл клиентте осы кітап үлгісі бұрыннан бар'); return }
    startTransition(async () => {
      const res = await managerGrantBookAccess({
        client_id: giveAccessUser.id,
        client_name: giveAccessUser.full_name || '',
        category_id: accessCategoryId,
      })
      if (res.error) { setError(res.error); return }
      setGiveAccessUser(null)
      setAccessCategoryId('')
      void fetchAll()
    })
  }

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter((u) => {
      const name = (u.full_name || '').toLowerCase()
      const phone = formatPhoneForDisplay(u.phone || '').replace(/\s/g, '')
      return name.includes(q) || phone.includes(q.replace(/\s/g, ''))
    })
  }, [users, search])

  // Summary counts
  const totalOrders = orders.length
  const activeOrders = orders.filter((o) => o.status === 'filling' || o.status === 'checking').length
  const completedOrders = orders.filter((o) => o.status === 'delivered').length

  if (!user) return null

  return (
    <div className="min-h-screen bg-[color:var(--bg-page)]">
      <SiteHeader
        badge="Менеджер"
        userLabel={user.email ?? ''}
        onLogout={handleLogout}
        profileHref="/manager-dashboard/profile"
      />

      <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-8 md:px-8 md:pt-10">

        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[1.65rem]">
              Клиенттер
            </h1>
            <p className="mt-1 text-[13px] font-medium text-[color:var(--text-muted)]">
              {filteredUsers.length !== users.length
                ? `${filteredUsers.length} / ${users.length} клиент`
                : `${users.length} клиент`}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => { setShowCreate(true); setError(null) }}
          >
            + Клиент қосу
          </Button>
        </div>

        {/* Stats row */}
        {!loading && !loadError && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Клиент', value: users.length },
              { label: 'Белсенді тапсырыс', value: activeOrders },
              { label: 'Жеткізілді', value: completedOrders },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]"
              >
                <div className="text-[22px] font-semibold tabular-nums tracking-tight text-[color:var(--text-primary)]">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-[color:var(--text-muted)]">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search Bento block */}
        <div className="mb-4 rounded-[var(--radius-lg)] bg-[color:var(--surface)] px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Аты-жөні немесе телефон бойынша іздеу…"
            className={clsx(
              'w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)]',
              'px-3.5 py-2 text-[13px] text-[color:var(--text-primary)] outline-none',
              'transition-[border-color,box-shadow] duration-[var(--transition)] placeholder:text-[color:var(--text-muted)]',
              'focus:border-[color:var(--border-strong)] focus:bg-[color:var(--surface)] focus:ring-2 focus:ring-[color:var(--accent-ring)]'
            )}
          />
        </div>

        {loadError ? (
          <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50/80 p-6 shadow-[var(--shadow-xs)]">
            <p className="text-[14px] font-semibold text-red-900">Деректерді жүктеу мүмкін болмады</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{loadError}</p>
            <Button type="button" variant="primary" className="mt-4" onClick={() => void fetchAll()}>
              Қайта көріңіз
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-[var(--radius-lg)] bg-[color:var(--surface)] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]"
                style={{ opacity: 1 - i * 0.18 }}
              >
                <div className="mb-2.5 h-3.5 w-[36%] rounded-md bg-[color:var(--surface-subtle)]" />
                <div className="h-2.5 w-[20%] rounded-md bg-[color:var(--surface-subtle)]" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] px-8 py-16 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
            <p className="text-[14px] font-medium text-[color:var(--text-muted)]">
              {search ? 'Нәтиже табылмады' : 'Әзірше клиент жоқ'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredUsers.map((u) => {
                const uOrders = userOrders(u.id)
                return (
                  <div
                    key={u.id}
                    className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        {u.phone ? (
                          <a
                            href={`tel:${String(u.phone).replace(/\D/g, '')}`}
                            className="font-mono text-[14px] font-semibold text-[color:var(--text-primary)] underline-offset-2 hover:underline"
                          >
                            {formatPhoneForDisplay(u.phone)}
                          </a>
                        ) : (
                          <span className="text-[13px] text-[color:var(--text-muted)]">Телефон жоқ</span>
                        )}
                        {u.full_name?.trim() ? (
                          <div className="mt-0.5 text-[12px] font-medium text-[color:var(--text-secondary)]">
                            {u.full_name.trim()}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--text-muted)]">
                        {new Date(u.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>

                    {uOrders.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {uOrders.map((o) => {
                          const catName = categories.find((c) => c.id === o.category_id)?.title_kk || o.book_title || 'Кітап'
                          return (
                            <div
                              key={o.id}
                              className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--surface-subtle)] px-2.5 py-2 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="size-1.5 shrink-0 rounded-full"
                                  style={{ background: orderStatusDotColor(o.status) }}
                                />
                                <span className="font-semibold text-[color:var(--text-primary)]">{catName}</span>
                                <button
                                  type="button"
                                  aria-label="Жою"
                                  onClick={() => handleDeleteOrder(o.id, catName)}
                                  className="ml-0.5 rounded p-0.5 text-[color:var(--text-muted)] transition-colors hover:text-red-600"
                                >
                                  <IconX className="size-3" />
                                </button>
                              </div>
                              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-[color:var(--text-secondary)]">
                                <input
                                  type="checkbox"
                                  checked={!!o.client_ai_enabled}
                                  disabled={aiUpdatingOrderId === o.id}
                                  onChange={(e) => void handleToggleOrderAi(o.id, e.target.checked)}
                                  className="size-3 accent-[color:var(--accent)]"
                                />
                                AI клиентке
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mb-3 text-[12px] text-[color:var(--text-muted)]">Кітап жоқ</p>
                    )}

                    <div className="flex gap-2 border-t border-[color:var(--border)] pt-3">
                      <button
                        type="button"
                        onClick={() => { setGiveAccessUser(u); setAccessCategoryId(''); setError(null) }}
                        className="flex-1 rounded-[var(--radius-md)] bg-[color:var(--surface-subtle)] py-2 text-[12px] font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]"
                      >
                        Қолжеткізу
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.full_name || u.phone || 'клиент')}
                        className="flex-1 rounded-[var(--radius-md)] bg-red-50 py-2 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        Өшіру
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--surface)] shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)] md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
                      {['Клиент', 'Тіркелді', 'Кітаптары', ''].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => {
                      const uOrders = userOrders(u.id)
                      return (
                        <tr
                          key={u.id}
                          className={clsx(
                            'transition-colors duration-[var(--transition)] hover:bg-[color:var(--surface-subtle)]/60',
                            i < filteredUsers.length - 1 && 'border-b border-[color:var(--border)]'
                          )}
                        >
                          <td className="px-5 py-4">
                            {u.phone ? (
                              <a
                                href={`tel:${String(u.phone).replace(/\D/g, '')}`}
                                className="font-mono text-[13px] font-semibold text-[color:var(--text-primary)] underline-offset-2 hover:underline"
                              >
                                {formatPhoneForDisplay(u.phone)}
                              </a>
                            ) : (
                              <span className="text-[13px] text-[color:var(--text-muted)]">—</span>
                            )}
                            {u.full_name?.trim() ? (
                              <div className="mt-0.5 text-[11px] font-medium text-[color:var(--text-secondary)]">
                                {u.full_name.trim()}
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-[11px] tabular-nums text-[color:var(--text-muted)]">
                            {new Date(u.created_at).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-5 py-4">
                            {uOrders.length === 0 ? (
                              <span className="text-[12px] text-[color:var(--text-muted)]">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {uOrders.map((o) => {
                                  const catName = categories.find((c) => c.id === o.category_id)?.title_kk || o.book_title || 'Кітап'
                                  return (
                                    <div
                                      key={o.id}
                                      className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--surface-subtle)] px-2.5 py-2 text-[11px]"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="size-1.5 shrink-0 rounded-full"
                                          style={{ background: orderStatusDotColor(o.status) }}
                                        />
                                        <span className="font-semibold text-[color:var(--text-primary)]">{catName}</span>
                                        <button
                                          type="button"
                                          aria-label="Жою"
                                          onClick={() => handleDeleteOrder(o.id, catName)}
                                          className="ml-0.5 rounded p-0.5 text-[color:var(--text-muted)] transition-colors hover:text-red-600"
                                        >
                                          <IconX className="size-3" />
                                        </button>
                                      </div>
                                      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-[color:var(--text-secondary)]">
                                        <input
                                          type="checkbox"
                                          checked={!!o.client_ai_enabled}
                                          disabled={aiUpdatingOrderId === o.id}
                                          onChange={(e) => void handleToggleOrderAi(o.id, e.target.checked)}
                                          className="size-3 accent-[color:var(--accent)]"
                                        />
                                        AI клиентке
                                      </label>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => { setGiveAccessUser(u); setAccessCategoryId(''); setError(null) }}
                                className="whitespace-nowrap rounded-[var(--radius-md)] bg-[color:var(--surface-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]"
                              >
                                Қолжеткізу беру
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.full_name || u.phone || 'клиент')}
                                className="whitespace-nowrap rounded-[var(--radius-md)] bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100"
                              >
                                Өшіру
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Create client modal */}
      {showCreate && (
        <Modal title="Клиент қосу" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateUser} className="flex flex-col gap-5">
            <UserFormFields form={createForm} setForm={setCreateForm} prefix="c" />
            {error && (
              <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900">
                {error}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
                Болдырмау
              </Button>
              <Button type="submit" variant="primary" disabled={isPending} className="flex-[1.5]">
                {isPending ? 'Қосылуда…' : 'Қосу'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Grant access modal */}
      {giveAccessUser && (
        <Modal
          title={`Қолжеткізу — ${giveAccessUser.full_name || formatPhoneForDisplay(giveAccessUser.phone || '')}`}
          onClose={() => setGiveAccessUser(null)}
        >
          <form onSubmit={handleGiveAccess} className="flex flex-col gap-5">
            <div>
              <label className={labelCls}>Кітап үлгісі</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const sel = accessCategoryId === cat.id
                  const alreadyHas = orders.some((o) => o.client_id === giveAccessUser?.id && o.category_id === cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={alreadyHas}
                      onClick={() => !alreadyHas && setAccessCategoryId(sel ? '' : cat.id)}
                      className={clsx(
                        'rounded-[var(--radius-md)] px-3.5 py-2 text-[13px] font-semibold transition-all duration-[var(--transition)]',
                        sel
                          ? 'bg-[color:var(--text-primary)] text-white shadow-[var(--shadow-sm)]'
                          : alreadyHas
                            ? 'cursor-default bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)] opacity-50'
                            : 'bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]'
                      )}
                    >
                      {cat.title_kk}
                      {alreadyHas && <span className="ml-1.5 opacity-60">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-[color:var(--text-muted)]">
              Кітап атауы, автор және алушы — клиенттің өзі толтырады.
            </p>
            {error && (
              <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900">
                {error}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setGiveAccessUser(null)}>
                Болдырмау
              </Button>
              <Button type="submit" variant="primary" disabled={isPending || !accessCategoryId} className="flex-[1.5]">
                {isPending ? 'Берілуде…' : 'Қолжеткізу беру'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
