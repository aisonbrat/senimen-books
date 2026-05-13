'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  adminAddGlobalTrialCategory,
  adminGrantFullBookAccess,
  adminDeleteOrder,
  adminRemoveGlobalTrialCategory,
} from '@/app/admin/users/actions'
import { Button } from '@/components/ui/Button'
import { formatPhoneForDisplay } from '@/lib/utils/phone'
import { orderStatusLabel, orderStatusPillClass } from '@/lib/design/order-status'

type TrialOfferRow = { category_id: string; created_at: string }

type TrialOrderRow = {
  id: string
  client_id: string
  book_title: string
  category_id: string | null
  status: string
  trial_mode: boolean | null
  trial_whatsapp_clicked_at: string | null
  created_at: string
}

export default function AdminTrialBooksPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [categoriesFetchErr, setCategoriesFetchErr] = useState<string | null>(null)
  const [trialTableErr, setTrialTableErr] = useState<string | null>(null)
  const [ordersFetchErr, setOrdersFetchErr] = useState<string | null>(null)
  const [trialOrders, setTrialOrders] = useState<TrialOrderRow[]>([])
  const [globalTrial, setGlobalTrial] = useState<TrialOfferRow[]>([])
  const [categories, setCategories] = useState<{ id: string; title_kk: string }[]>([])
  const [pickCatToAdd, setPickCatToAdd] = useState('')
  const [pending, startTransition] = useTransition()

  async function reload() {
    setLoading(true)
    setCategoriesFetchErr(null)
    setTrialTableErr(null)
    setOrdersFetchErr(null)
    try {
      const [catRes, ordRes, trialCatRes] = await Promise.all([
        supabase.from('categories').select('id, title_kk').order('sort_order'),
        supabase
          .from('orders')
          .select(
            'id, client_id, book_title, category_id, status, trial_mode, trial_whatsapp_clicked_at, created_at'
          )
          .order('created_at', { ascending: false }),
        supabase.from('trial_global_categories').select('category_id, created_at').order('created_at'),
      ])

      if (catRes.error) {
        setCategoriesFetchErr(catRes.error.message)
        setCategories([])
      } else {
        setCategories(catRes.data || [])
      }

      if (ordRes.error) {
        setOrdersFetchErr(ordRes.error.message)
        setTrialOrders([])
      } else {
        const all = (ordRes.data || []) as TrialOrderRow[]
        setTrialOrders(all.filter((o) => o.trial_mode === true))
      }

      if (trialCatRes.error) {
        setTrialTableErr(trialCatRes.error.message)
        setGlobalTrial([])
      } else {
        setGlobalTrial((trialCatRes.data || []) as TrialOfferRow[])
      }

      const offered =
        trialCatRes.error || !trialCatRes.data
          ? new Set<string>()
          : new Set((trialCatRes.data as TrialOfferRow[]).map((r) => r.category_id))

      if (!catRes.error && catRes.data?.length) {
        const list = catRes.data
        const firstAvailable = list.find((c) => !offered.has(c.id))?.id ?? list[0]?.id ?? ''
        setPickCatToAdd((prev) => {
          const p = prev || ''
          if (p && !offered.has(p)) return p
          return firstAvailable
        })
      }
    } catch (e) {
      setTrialTableErr(e instanceof Error ? e.message : 'Жүктеу қатесі')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [])

  function catTitle(id: string | null) {
    if (!id) return '—'
    return categories.find((c) => c.id === id)?.title_kk || id.slice(0, 8)
  }

  const offeredIds = useMemo(() => {
    if (trialTableErr || loading) return null
    return new Set(globalTrial.map((t) => t.category_id))
  }, [globalTrial, trialTableErr, loading])
  const addableCategories = useMemo(() => {
    if (!offeredIds) return []
    return categories.filter((c) => !offeredIds.has(c.id))
  }, [categories, offeredIds])

  const selectDisabled =
    loading ||
    !!categoriesFetchErr ||
    categories.length === 0 ||
    !!trialTableErr ||
    addableCategories.length === 0
  const addTrialDisabled =
    pending ||
    !!trialTableErr ||
    !!categoriesFetchErr ||
    !pickCatToAdd ||
    addableCategories.length === 0

  const [clientInfoById, setClientInfoById] = useState<
    Record<string, { fullName: string; phone: string }>
  >({})

  useEffect(() => {
    async function fetchClients() {
      const ids = trialOrders.map((o) => o.client_id).filter(Boolean)
      if (!ids.length) {
        setClientInfoById({})
        return
      }
      const unique = [...new Set(ids)]
      const [{ data: profRows }, { data: phoneRows }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', unique),
        supabase.from('profile_phones').select('profile_id, phone').in('profile_id', unique),
      ])
      const phoneById = new Map<string, string | null>()
      ;(phoneRows || []).forEach((r: { profile_id: string; phone: string | null }) => {
        phoneById.set(r.profile_id, r.phone)
      })
      const m: Record<string, { fullName: string; phone: string }> = {}
      ;(profRows || []).forEach((p: { id: string; full_name: string | null }) => {
        const raw = phoneById.get(p.id)
        m[p.id] = {
          fullName: (p.full_name ?? '').trim(),
          phone: formatPhoneForDisplay(raw ?? '') || String(raw ?? '').trim(),
        }
      })
      setClientInfoById(m)
    }
    void fetchClients()
  }, [trialOrders, supabase])

  function clientCell(id: string) {
    const info = clientInfoById[id]
    const name = info?.fullName?.trim() || '—'
    const phone = info?.phone?.trim() || '—'
    return (
      <div>
        <div className="font-semibold text-[color:var(--text-primary)]">{name}</div>
        <div className="mt-0.5 font-mono text-[12px] text-[color:var(--text-muted)]">{phone}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 md:px-10 md:pt-12">
      <h1 className="font-serif-display text-[1.65rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
        Тегін кезең кітаптары
      </h1>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[color:var(--text-muted)]">
        Әкімші тек кітап <strong className="font-semibold text-[color:var(--text-secondary)]">түрін</strong>{' '}
        қосады — сол үлгі бойынша жаңа тапсырыс жасаған клиенттер автоматты түрде тегін кезеңде болады (
        алдымен 6 сұрақ). Әр түр бір рет қана тізімде болады. Толық қол жеткізу немесе өшіру нақты клиенттік
        тапсырыс үшін төмендегі кестеде жасалады.
      </p>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[color:var(--text-muted)]">
        <strong className="font-semibold text-[color:var(--text-secondary)]">Кітап үлгілері</strong>{' '}
        (тармақтар, сұрақтар, мәтіндер): мәзірден{' '}
        <Link
          href="/admin/templates"
          className="font-semibold text-[color:var(--accent)] underline decoration-[color:var(--accent)] underline-offset-[3px] hover:no-underline"
        >
          Үлгілер →
        </Link>
        . Телефонда астындағы <strong className="font-semibold text-[color:var(--text-secondary)]">«Мәзір»</strong>{' '}
        түймесі сол жақ панельді ашады.
      </p>

      {(categoriesFetchErr || trialTableErr || ordersFetchErr) && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-900">
          {categoriesFetchErr ? <p><strong className="font-semibold">Категориялар:</strong> {categoriesFetchErr}</p> : null}
          {trialTableErr ? (
            <p className={categoriesFetchErr ? 'mt-2' : ''}>
              <strong className="font-semibold">trial_global_categories:</strong> {trialTableErr}
              {/permission denied for table/i.test(trialTableErr) ? (
                <span className="mt-1 block text-[12px] text-red-950/85">
                  Supabase соңғы миграцияны қолданыңыз (жобада `20260629103000_trial_global_categories_grants.sql` файлындағы GRANT-тар)
                  немесе SQL Editor‑да келесі жолдарды бір рет орындаңыз:
                  grant select, insert, update, delete on public.trial_global_categories to authenticated; grant all on public.trial_global_categories to service_role;
                </span>
              ) : null}
            </p>
          ) : null}
          {ordersFetchErr ? (
            <p className={categoriesFetchErr || trialTableErr ? 'mt-2' : ''}>
              <strong className="font-semibold">Тапсырыстар:</strong> {ordersFetchErr}
            </p>
          ) : null}
        </div>
      )}
      <section className="mt-10 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-xs)]">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Қол жетімді тегін үлгілер
        </h2>
        <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">
          Мұндағы әр үлгі бойынша клиент өзі жаңа кітап құрғанда триггер автоматты trial қосады.
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <label className="block min-w-[220px] flex-1 text-[12px] font-semibold text-[color:var(--text-secondary)]">
            Кітап түрін қосу
            <select
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-[13px] text-[color:var(--text-primary)]"
              value={pickCatToAdd}
              onChange={(e) => setPickCatToAdd(e.target.value)}
              disabled={selectDisabled}
            >
              {loading ? (
                <option value="">Жүктелуде...</option>
              ) : categoriesFetchErr ? (
                <option value="">Категориялар жүктелмеді</option>
              ) : categories.length === 0 ? (
                <option value="">Алдымен «Үлгілер» бөлімінде кем деген бір категория құрыңыз</option>
              ) : trialTableErr ? (
                <option value="">trial тізімі жүктелмеді — жоғарыдағы қатені түзетіңіз</option>
              ) : addableCategories.length === 0 ? (
                <option value="">Барлық қолжетімді түрлер тізімге қосылған</option>
              ) : (
                addableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title_kk}
                  </option>
                ))
              )}
            </select>
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={addTrialDisabled}
            onClick={() => {
              startTransition(async () => {
                const res = await adminAddGlobalTrialCategory(pickCatToAdd)
                if (res.error) {
                  alert(res.error)
                  return
                }
                await reload()
              })
            }}
          >
            Үлгіні қосу
          </Button>
        </div>

        {loading ? (
          <p className="mt-6 text-[13px] text-[color:var(--text-muted)]">Жүктелуде...</p>
        ) : trialTableErr ? (
          <p className="mt-6 text-[13px] font-medium text-red-700">Тізім көрсетілмейді: trial_global_categories қолжетімді емес.</p>
        ) : globalTrial.length === 0 ? (
          <p className="mt-6 text-[13px] text-[color:var(--text-muted)]">Әлі тегін үлгі түрі қосылған жоқ.</p>
        ) : (
          <ul className="mt-6 divide-y divide-[color:var(--border)] rounded-[var(--radius-md)] border border-[color:var(--border)]">
            {globalTrial.map((t) => (
              <li
                key={t.category_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]"
              >
                <div>
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {catTitle(t.category_id)}
                  </div>
                  <div className="text-[11px] text-[color:var(--text-muted)]">
                    Қосылды:{' '}
                    {new Date(t.created_at).toLocaleString('kk-KZ', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm('Бұл үлгі тізімінен шығарылсын ба? Жаңа тапсырыс trial алмайды.')) return
                    startTransition(async () => {
                      const res = await adminRemoveGlobalTrialCategory(t.category_id)
                      if (res.error) {
                        alert(res.error)
                        return
                      }
                      await reload()
                    })
                  }}
                >
                  Өшіру
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
          Белсенді тегін тапсырыстар ({trialOrders.length})
        </h2>
        {loading ? (
          <p className="text-[13px] text-[color:var(--text-muted)]">Жүктелуде...</p>
        ) : ordersFetchErr ? (
          <p className="text-[13px] font-medium text-red-700">{ordersFetchErr}</p>
        ) : trialOrders.length === 0 ? (
          <p className="text-[13px] text-[color:var(--text-muted)]">Әлі trial тапсырыс жоқ.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-xs)]">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Клиент (аты · телефон)</th>
                  <th className="px-4 py-3">Кітап атауы</th>
                  <th className="px-4 py-3">Түрі</th>
                  <th className="px-4 py-3">Күйі</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Әрекет</th>
                </tr>
              </thead>
              <tbody>
                {trialOrders.map((o) => (
                  <tr key={o.id} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="px-4 py-3 align-top">{clientCell(o.client_id)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[color:var(--text-secondary)]">
                      {o.book_title}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {o.category_id ? (
                        <span className="inline-flex max-w-[220px] whitespace-normal break-words rounded-[var(--radius-sm)] border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-0.5 text-[11px] font-semibold leading-snug text-[color:var(--accent)]">
                          {catTitle(o.category_id)}
                        </span>
                      ) : (
                        <span className="text-[color:var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={orderStatusPillClass(o.status)}>{orderStatusLabel(o.status)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {o.trial_whatsapp_clicked_at ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                          WhatsApp ·{' '}
                          {new Date(o.trial_whatsapp_clicked_at).toLocaleDateString('kk-KZ', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[color:var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={pending}
                          onClick={() => {
                            if (
                              !confirm(
                                'Клиентке толық кітапқа қол жеткізу берілсін бе? (trial_mode өшіріледі)'
                              )
                            )
                              return
                            startTransition(async () => {
                              const res = await adminGrantFullBookAccess(o.id)
                              if (res.error) {
                                alert(res.error)
                                return
                              }
                              await reload()
                            })
                          }}
                        >
                          Толық қол жеткізу
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm('Бұл тапсырыс өшірілсін бе?')) return
                            startTransition(async () => {
                              const res = await adminDeleteOrder(o.id)
                              if (res.error) {
                                alert(res.error)
                                return
                              }
                              await reload()
                            })
                          }}
                        >
                          Өшіру
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
