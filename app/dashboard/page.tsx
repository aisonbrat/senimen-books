'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { SiteHeader } from '@/components/shell/SiteHeader'
import { RenameBookModal } from '@/components/client/RenameBookModal'
import { orderStatusLabel, orderStatusWorkspacePill, orderStatusDotColor } from '@/lib/design/order-status'
import { ORDERS_DASHBOARD_CLIENT_SELECT } from '@/lib/supabase/querySelects'

type TrialOfferCategory = {
  id: string
  title_kk: string
  description_kk: string | null
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [trialOffers, setTrialOffers] = useState<TrialOfferCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; book_title: string } | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        const authedUser = authData?.user
        if (authErr || !authedUser) {
          if (!cancelled) router.push('/auth/login')
          return
        }
        if (!cancelled) setUser(authedUser)

        const [profRes, phoneRes, ordRes, catRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', authedUser.id).single(),
          supabase.from('profile_phones').select('phone').eq('profile_id', authedUser.id).maybeSingle(),
          supabase.from('orders').select(ORDERS_DASHBOARD_CLIENT_SELECT).eq('client_id', authedUser.id).order('created_at', { ascending: false }),
          supabase.from('categories').select('id, title_kk, description_kk, is_active').order('sort_order'),
        ])
        if (cancelled) return

        const errMsg = profRes.error?.message || phoneRes.error?.message || ordRes.error?.message || catRes.error?.message || null
        if (errMsg) { setLoadError(errMsg); setProfile(null); setOrders([]); setCategories({}); setTrialOffers([]); return }

        setProfile({ ...(profRes.data as object), phone: phoneRes.data?.phone ?? null })
        setOrders(ordRes.data || [])
        const catMap: Record<string, string> = {}
        catRes.data?.forEach((c: any) => { catMap[c.id] = c.title_kk })
        setCategories(catMap)

        const trialIdsRes = await supabase.from('trial_global_categories').select('category_id')
        if (cancelled) return

        const offers: TrialOfferCategory[] = []
        if (!trialIdsRes.error && trialIdsRes.data?.length && catRes.data?.length) {
          const cats = catRes.data as { id: string; title_kk: string; description_kk: string | null; is_active: boolean | null }[]
          const trialOrder = trialIdsRes.data.map((r: { category_id: string }) => r.category_id)
          const byId = new Map(cats.filter((c) => c.is_active !== false).map((c) => [c.id, c]))
          for (const id of trialOrder) {
            const c = byId.get(id)
            if (c) offers.push({ id: c.id, title_kk: c.title_kk, description_kk: c.description_kk ?? null })
          }
        }
        setTrialOffers(offers)
      } catch (e) {
        if (!cancelled) { setLoadError(e instanceof Error ? e.message : 'Жүктеу қатесі'); setOrders([]); setCategories({}); setTrialOffers([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (!user) return null

  const displayName = profile?.full_name || profile?.phone || user.email

  // Stats
  const filling = orders.filter((o) => o.status === 'filling').length
  const inProgress = orders.filter((o) => ['checking', 'design', 'printing'].includes(o.status)).length
  const delivered = orders.filter((o) => o.status === 'delivered').length

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader userLabel={displayName} onLogout={handleLogout} profileHref="/dashboard/profile" />

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 md:px-8 md:pt-10">

        {/* ─── Header ───────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[1.65rem]">
              Менің кітаптарым
            </h1>
            {displayName && (
              <p className="mt-0.5 text-[13px] font-medium text-[color:var(--text-muted)]">{displayName}</p>
            )}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/dashboard/new')}>
            + Жаңа кітап
          </Button>
        </div>

        {/* ─── Stats row ────────────────────────────────────────────── */}
        {!loading && !loadError && orders.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Барлығы', value: orders.length },
              { label: 'Өңделуде', value: inProgress },
              { label: 'Жеткізілді', value: delivered },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white px-4 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]"
              >
                <div className="text-[24px] font-semibold tabular-nums tracking-tight text-[color:var(--text-primary)]">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-[color:var(--text-muted)]">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Trial offers ─────────────────────────────────────────── */}
        {!loading && trialOffers.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)] md:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[color:var(--text-primary)]">Тегін кезең үлгілері</h2>
                <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">
                  Тіркеліп «Бастау» батырмасын басыңыз — алдымен 6 сұрақ тегін ашылады.
                </p>
              </div>
              <span className="shrink-0 rounded-xl bg-[color:var(--accent-surface)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--accent)]">
                Тегін
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {trialOffers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/new?category=${encodeURIComponent(c.id)}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-[color:var(--border)] bg-[#F9FAFB] px-4 py-3.5 text-left transition-[border-color,background-color] hover:border-[color:var(--accent-ring)] hover:bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[color:var(--text-primary)]">{c.title_kk}</div>
                    {c.description_kk && (
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-[color:var(--text-muted)]">{c.description_kk}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-[color:var(--accent)]">Бастау →</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-[color:var(--text-muted)]">
              Басқа үлгілер үшін менеджерге жазыңыз.
            </p>
          </div>
        )}

        {/* ─── Orders ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]"
                style={{ opacity: 1 - i * 0.22 }}
              >
                <div className="mb-3 h-4 w-[42%] rounded-lg bg-[#F3F4F6]" />
                <div className="h-3 w-[28%] rounded-lg bg-[#F3F4F6]" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-[14px] font-semibold text-red-900">Деректерді жүктеу мүмкін болмады</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{loadError}</p>
            <Button type="button" variant="primary" className="mt-5" onClick={() => window.location.reload()}>
              Қайта көріңіз
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl bg-white px-8 py-16 text-center shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]">
            <h2 className="font-serif-display text-[1.2rem] font-semibold text-[color:var(--text-primary)]">
              Сізде әлі кітап жоқ
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-[color:var(--text-muted)]">
              {trialOffers.length > 0
                ? 'Жоғарыдағы тегін үлгілердің бірін таңдап кітап құрыңыз.'
                : 'Менеджерге хабарласыңыз — рұқсат бергеннен кейін кітап ашылады.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => {
              const canEdit = order.status === 'filling'
              return (
                <li key={order.id}>
                  <div
                    className={clsx(
                      'group flex overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]',
                      'transition-[transform,box-shadow] duration-200',
                      canEdit && 'hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(15,23,42,0.1)]'
                    )}
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => canEdit && router.push(`/dashboard/editor/${order.id}`)}
                      className={clsx(
                        'flex min-w-0 flex-1 items-start gap-4 p-5 text-left',
                        canEdit ? 'cursor-pointer' : 'cursor-default'
                      )}
                    >
                      {/* Status dot */}
                      <div
                        className="mt-1 size-2.5 shrink-0 rounded-full"
                        style={{ background: orderStatusDotColor(order.status) }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">
                            {order.book_title}
                          </span>
                          {order.category_id && categories[order.category_id] && (
                            <span className="inline-flex shrink-0 rounded-lg border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                              {categories[order.category_id]}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12px] font-medium text-[color:var(--text-muted)]">
                          {order.recipient_name} · {order.author_name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <span className={orderStatusWorkspacePill(order.status)}>
                          {orderStatusLabel(order.status)}
                        </span>
                        {canEdit && (
                          <span className="text-[13px] font-semibold text-[color:var(--accent)] transition-transform group-hover:translate-x-0.5">
                            Ашу →
                          </span>
                        )}
                      </div>
                    </button>

                    {canEdit && (
                      <div className="flex shrink-0 flex-col justify-center border-l border-[color:var(--border)] bg-[#F9FAFB] px-3 sm:px-4">
                        <button
                          type="button"
                          className="whitespace-normal text-center text-[11px] font-semibold leading-snug text-[color:var(--accent)] underline-offset-2 transition-colors hover:underline"
                          onClick={() => setRenameTarget({ id: order.id, book_title: order.book_title })}
                        >
                          Атауын<br />өзгерту
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && !loadError && filling > 0 && (
          <p className="mt-5 text-center text-[12px] text-[color:var(--text-muted)]">
            {filling} кітап толтырылуды күтуде — ашып жалғастырыңыз.
          </p>
        )}
      </main>

      <RenameBookModal
        open={!!renameTarget}
        orderId={renameTarget?.id ?? ''}
        initialTitle={renameTarget?.book_title ?? ''}
        onClose={() => setRenameTarget(null)}
        onSaved={(id, newTitle) => setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, book_title: newTitle } : o)))}
      />
    </div>
  )
}
