'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { SiteHeader } from '@/components/shell/SiteHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { IconChevronRight } from '@/components/ui/icons'
import {
  ORDER_STATUS_ORDER,
  orderStatusLabel,
  orderStatusWorkspacePill,
  orderStatusDotColor,
} from '@/lib/design/order-status'
import type { Order } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export default function EditorDashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [actorRole, setActorRole] = useState<string | null>(null)
  const [roleReady, setRoleReady] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | (typeof ORDER_STATUS_ORDER)[number]>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      if (cancelled) return
      setUser(user)
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (cancelled) return
      const r = prof?.role != null ? String(prof.role).toLowerCase() : ''
      setActorRole(r || null)
      setRoleReady(true)
      const { data: ordRows, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (cancelled) return
      setOrders(error ? [] : (ordRows as Order[] | null) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [router, supabase])

  function orderHasClientAi(o: Order) {
    return (o as { client_ai_enabled?: boolean | null }).client_ai_enabled === true
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const filtered = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  )

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length }
    ORDER_STATUS_ORDER.forEach((s) => { counts[s] = orders.filter((o) => o.status === s).length })
    return counts
  }, [orders])

  // Checking orders bubble up — editable ones first
  const sortedFiltered = useMemo(() => {
    if (filter !== 'all') return filtered
    return [...filtered].sort((a, b) => {
      const aEditable = a.status === 'checking' ? 0 : 1
      const bEditable = b.status === 'checking' ? 0 : 1
      if (aEditable !== bEditable) return aEditable - bEditable
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered, filter])

  if (!user) return null

  return (
    <div className="min-h-screen bg-[color:var(--bg-page)]">
      <SiteHeader
        badge="Редактор"
        userLabel={user.email ?? ''}
        onLogout={handleLogout}
        profileHref="/editor-dashboard/profile"
      />

      <main className="mx-auto max-w-4xl px-4 pb-20 pt-8 md:px-8 md:pt-10">

        {/* Page header */}
        <header className="mb-6">
          <h1 className="text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[1.65rem]">
            Тапсырыстар
          </h1>
          <p className="mt-1 text-[13px] font-medium text-[color:var(--text-muted)]">
            {orders.length} тапсырыс
          </p>
        </header>

        {/* Filter Bento block */}
        <div className="mb-5 rounded-[var(--radius-lg)] bg-[color:var(--surface)] px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...ORDER_STATUS_ORDER] as const).map((s) => {
              const active = filter === s
              const cnt = statusCounts[s] ?? 0
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] font-semibold',
                    'transition-all duration-[var(--transition)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
                    active
                      ? 'bg-[color:var(--text-primary)] text-white shadow-[var(--shadow-sm)]'
                      : 'bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)] hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]'
                  )}
                >
                  {s !== 'all' && (
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: active ? 'rgba(255,255,255,0.6)' : orderStatusDotColor(s) }}
                    />
                  )}
                  {s === 'all' ? 'Барлығы' : orderStatusLabel(s)}
                  <span className={clsx('tabular-nums text-[10.5px]', active ? 'opacity-60' : 'text-[color:var(--text-muted)]')}>
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]"
                style={{ opacity: 1 - i * 0.2 }}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <Skeleton width="46%" height={14} />
                  <Skeleton width={80} height={22} shape="pill" />
                </div>
                <Skeleton width="32%" height={11} />
              </div>
            ))}
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[color:var(--surface)] px-8 py-16 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]">
            <p className="text-[14px] font-medium text-[color:var(--text-muted)]">Тапсырыстар жоқ</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedFiltered.map((order) => {
              const clientAi = orderHasClientAi(order)
              const isEditorUser = actorRole === 'editor'
              const isEditable = roleReady && order.status === 'checking' && !(isEditorUser && clientAi)
              const isDone = order.status === 'delivered' || order.status === 'completed'
              const isUrgent = order.status === 'checking' && isEditable
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => isEditable && router.push(`/editor-dashboard/editor/${order.id}`)}
                    className={clsx(
                      'group w-full rounded-[var(--radius-lg)] bg-[color:var(--surface)] text-left',
                      'shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_16px_rgba(15,23,42,0.06)]',
                      'transition-[transform,box-shadow] duration-[var(--transition)]',
                      isEditable && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]',
                      !isEditable && !isDone && 'cursor-default opacity-50',
                      !isEditable && isDone && 'cursor-default'
                    )}
                  >
                    {/* Urgent indicator strip */}
                    {isUrgent && (
                      <div className="h-0.5 rounded-t-[var(--radius-lg)] bg-amber-400" />
                    )}

                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[color:var(--text-primary)]">
                            {order.book_title}
                          </span>
                          {isEditorUser && clientAi ? (
                            <span className="rounded-[var(--radius-sm)] bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-200">
                              Клиент AI
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[color:var(--text-muted)]">
                          <span>{order.recipient_name}</span>
                          <span aria-hidden className="text-[color:var(--border-strong)]">·</span>
                          <span>{order.author_name}</span>
                          <span aria-hidden className="text-[color:var(--border-strong)]">·</span>
                          <span className="tabular-nums">{new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={orderStatusWorkspacePill(order.status)}>
                          <span
                            className="mr-1.5 inline-block size-1.5 rounded-full"
                            style={{ background: orderStatusDotColor(order.status) }}
                          />
                          {orderStatusLabel(order.status)}
                        </span>
                        {isEditable && (
                          <IconChevronRight className="size-4 shrink-0 text-[color:var(--text-muted)] transition-[color,transform] duration-[var(--transition)] group-hover:translate-x-0.5 group-hover:text-[color:var(--accent)]" />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
