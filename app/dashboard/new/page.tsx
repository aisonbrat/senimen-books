'use client'

import { useState, useTransition, useEffect, Suspense, useRef, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import {
  fetchNewBookFormPrefill,
  getStoredNewBookSkipDefaults,
  persistNewBookClientDefaults,
  type NewBookClientDefaults,
} from '@/lib/client/newBookClientDefaults'

const DEFAULT_NEW_BOOK_TITLE = 'Жаңа кітап'

const fieldCls = clsx(
  'w-full rounded-xl border border-[color:var(--border)] bg-[#F9FAFB]',
  'px-3.5 py-3 text-[14px] text-[color:var(--text-primary)] outline-none',
  'transition-[border-color,background-color,box-shadow] duration-[var(--transition)] placeholder:text-[color:var(--text-muted)]',
  'focus:border-[color:var(--accent)] focus:bg-white focus:ring-2 focus:ring-[color:var(--accent-ring)]'
)
const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)] mb-2'

function NewBookPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')?.trim() ?? ''

  const [step, setStep] = useState<'pick' | 'form'>('pick')
  const [categories, setCategories] = useState<any[]>([])
  const [trialCategoryIds, setTrialCategoryIds] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<any>(null)
  const [clientDefaults, setClientDefaults] = useState<NewBookClientDefaults | null>(null)
  const [formHints, setFormHints] = useState<Partial<NewBookClientDefaults>>({})
  const [profileAuthorHint, setProfileAuthorHint] = useState('')
  const [dataReady, setDataReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState({ author_name: '', book_title: '', recipient_name: '', delivery_address: '' })
  const supabase = createClient()
  const insertGuardRef = useRef<string | null>(null)
  const urlLayoutDoneRef = useRef<string | null>(null)

  const selfServeCategories = useMemo(
    () => categories.filter((c: any) => trialCategoryIds.has(String(c.id))),
    [categories, trialCategoryIds]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }
        if (cancelled) return
        const [catRes, trialRes, profRes] = await Promise.all([
          supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
          supabase.from('trial_global_categories').select('category_id'),
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        ])
        if (cancelled) return
        setCategories(catRes.data || [])
        if (!trialRes.error && trialRes.data) {
          setTrialCategoryIds(new Set(trialRes.data.map((r: { category_id: string }) => String(r.category_id))))
        }
        setProfileAuthorHint(typeof profRes.data?.full_name === 'string' ? profRes.data.full_name.trim() : '')
        const skip = getStoredNewBookSkipDefaults(user.id)
        const hints = (await fetchNewBookFormPrefill(supabase, user.id)) ?? {}
        if (cancelled) return
        setClientDefaults(skip)
        setFormHints(hints)
        setUserId(user.id)
        setDataReady(true)
      } catch {
        if (!cancelled) { setCategories([]); setDataReady(true) }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openFormForCategory = useCallback(
    (cat: any, base: Partial<NewBookClientDefaults> & { book_title?: string }) => {
      setSelectedCategory(cat)
      setDraft({
        author_name: base.author_name ?? clientDefaults?.author_name ?? formHints.author_name ?? profileAuthorHint ?? '',
        book_title: base.book_title != null && String(base.book_title).trim() ? String(base.book_title).trim() : DEFAULT_NEW_BOOK_TITLE,
        recipient_name: base.recipient_name ?? clientDefaults?.recipient_name ?? formHints.recipient_name ?? '',
        delivery_address: base.delivery_address ?? clientDefaults?.delivery_address ?? formHints.delivery_address ?? '',
      })
      setStep('form')
      setError(null)
    },
    [clientDefaults, formHints, profileAuthorHint]
  )

  const createOrderForCategory = useCallback(
    (cat: any, values: NewBookClientDefaults & { book_title: string }) => {
      if (!userId || !cat?.id) return
      const guardKey = `${userId}:${cat.id}`
      if (insertGuardRef.current === guardKey) return
      insertGuardRef.current = guardKey
      setCreating(true)
      setError(null)
      startTransition(async () => {
        try {
          const { data: auth } = await supabase.auth.getUser()
          const authedUser = auth?.user
          if (!authedUser) { insertGuardRef.current = null; router.push('/auth/login'); return }
          if (!trialCategoryIds.has(String(cat.id))) {
            setError('Бұл үлгіге қолжетімділік жоқ.')
            insertGuardRef.current = null
            return
          }
          const { data: existingFilling } = await supabase
            .from('orders').select('id').eq('client_id', authedUser.id).eq('category_id', cat.id).eq('status', 'filling')
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (existingFilling?.id) {
            router.push(`/dashboard/editor/${existingFilling.id}`)
            insertGuardRef.current = null
            setCreating(false)
            return
          }
          const { data, error: insErr } = await supabase.from('orders')
            .insert({
              client_id: authedUser.id,
              category_id: cat.id,
              author_name: values.author_name.trim(),
              book_title: values.book_title.trim(),
              recipient_name: values.recipient_name.trim() || 'Алушы',
              delivery_address: values.delivery_address.trim(),
              status: 'filling',
              answer_text_align: 'left',
            })
            .select().single()
          if (insErr) {
            setError(insErr.message)
            insertGuardRef.current = null
            setSelectedCategory(cat)
            setDraft({ author_name: values.author_name.trim(), book_title: values.book_title.trim(), recipient_name: values.recipient_name.trim() || 'Алушы', delivery_address: values.delivery_address.trim() })
            setStep('form')
            return
          }
          persistNewBookClientDefaults(authedUser.id, { author_name: values.author_name.trim(), delivery_address: values.delivery_address.trim(), recipient_name: values.recipient_name.trim() || 'Алушы' })
          router.push(`/dashboard/editor/${data.id}`)
        } finally { setCreating(false) }
      })
    },
    [router, supabase, trialCategoryIds, userId]
  )

  useEffect(() => {
    if (!dataReady || !userId || !categories.length) return
    if (!categoryParam) { urlLayoutDoneRef.current = null; insertGuardRef.current = null; setStep('pick'); setSelectedCategory(null); return }
    const cat = categories.find((c: any) => String(c.id) === categoryParam)
    const allowed = cat && trialCategoryIds.has(String(cat.id))
    if (!allowed) { router.replace('/dashboard/new', { scroll: false }); return }
    const marker = `${categoryParam}:${clientDefaults ? 'd' : 'n'}`
    if (urlLayoutDoneRef.current === marker) return
    urlLayoutDoneRef.current = marker
    if (clientDefaults) { createOrderForCategory(cat, { ...clientDefaults, book_title: DEFAULT_NEW_BOOK_TITLE }); return }
    openFormForCategory(cat, { book_title: DEFAULT_NEW_BOOK_TITLE })
  }, [dataReady, userId, categories, trialCategoryIds, categoryParam, clientDefaults, router, createOrderForCategory, openFormForCategory])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    if (!selectedCategory?.id) { setError('Үлгі таңдалмаған.'); return }
    if (!trialCategoryIds.has(String(selectedCategory.id))) { setError('Бұл үлгіге қолжетімділік жоқ.'); return }
    const { author_name, book_title, recipient_name, delivery_address } = draft
    if (!author_name.trim() || !book_title.trim() || !recipient_name.trim() || !delivery_address.trim()) { setError('Барлық өрістерді толтырыңыз.'); return }
    createOrderForCategory(selectedCategory, { author_name: author_name.trim(), book_title: book_title.trim(), recipient_name: recipient_name.trim(), delivery_address: delivery_address.trim() })
  }

  const busy = creating || isPending

  return (
    <div className="min-h-screen bg-[#F9FAFB]">

      {/* Header */}
      <div className="border-b border-[color:var(--border)] bg-white">
        <div className="mx-auto flex h-14 max-w-[560px] items-center justify-between px-5">
          <Image src="/logo.svg" alt="Сенімен" width={120} height={30} priority unoptimized className="h-7 w-auto" />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (step === 'form') { setStep('pick'); setSelectedCategory(null); router.replace('/dashboard/new', { scroll: false }) }
              else router.push('/dashboard')
            }}
            className="text-[13px] font-semibold text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--accent)] disabled:opacity-50"
          >
            ← Артқа
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {(busy || !dataReady) && (
        <div className="fixed inset-0 top-14 z-20 flex items-center justify-center bg-[#F9FAFB]/90">
          <div className="rounded-2xl bg-white px-7 py-5 shadow-[var(--shadow-lg)]">
            <p className="text-[14px] font-semibold text-[color:var(--text-secondary)]">
              {!dataReady ? 'Жүктелуде…' : 'Кітабыңыз дайындалуда…'}
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[560px] px-5 py-10 md:py-14">

        {/* ─── Step: Pick category ──────────────────────────────────── */}
        {step === 'pick' && categoryParam === '' && (
          <>
            <div className="mb-7">
              <h1 className="text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
                Үлгіні таңдаңыз
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-muted)]">
                Тек тегін кезең үлгілерін өз бетіңізге бастай аласыз. Басқа түрлер үшін менеджер рұқсат береді.
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="rounded-2xl bg-white px-8 py-14 text-center shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]">
                <p className="text-[14px] font-medium text-[color:var(--text-muted)]">Үлгілер әлі жасалмаған</p>
                <p className="mt-1.5 text-[12px] text-[color:var(--text-muted)]">Админ үлгі қосқаннан кейін қол жетімді болады</p>
              </div>
            ) : selfServeCategories.length === 0 ? (
              <div className="rounded-2xl bg-white px-7 py-10 text-center shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]">
                <p className="text-[15px] font-semibold text-[color:var(--text-primary)]">
                  Тегін кезеңге арналған үлгі жоқ
                </p>
                <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-[color:var(--text-muted)]">
                  Басқа түрдегі кітапты менеджер немесе админ рұқсат бергеннен кейін бастай аласыз.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {selfServeCategories.map((cat: any) => {
                  const sel = selectedCategory?.id === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError(null)
                        if (clientDefaults && userId) createOrderForCategory(cat, { ...clientDefaults, book_title: DEFAULT_NEW_BOOK_TITLE })
                        else openFormForCategory(cat, { book_title: DEFAULT_NEW_BOOK_TITLE })
                      }}
                      className={clsx(
                        'flex w-full items-center justify-between gap-4 rounded-2xl bg-white px-5 py-5 text-left',
                        'shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)]',
                        'transition-[transform,box-shadow,ring] duration-200',
                        sel
                          ? 'ring-2 ring-[color:var(--accent)]'
                          : 'hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(15,23,42,0.1)]',
                        busy && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-[color:var(--text-primary)]">{cat.title_kk}</span>
                          <span className="inline-flex rounded-lg bg-[color:var(--accent-surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--accent)]">
                            Тегін кезең
                          </span>
                        </div>
                        {cat.description_kk && (
                          <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">{cat.description_kk}</p>
                        )}
                      </div>
                      <span className={clsx('text-[16px] font-semibold transition-colors', sel ? 'text-[color:var(--accent)]' : 'text-[color:var(--text-muted)]')}>
                        →
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ─── Step: Form ───────────────────────────────────────────── */}
        {step === 'form' && selectedCategory && (
          <>
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <h1 className="text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
                Кітап туралы
              </h1>
              <span className="rounded-xl bg-[color:var(--accent-surface)] px-3 py-1 text-[12px] font-semibold text-[color:var(--accent)]">
                {selectedCategory?.title_kk}
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="rounded-2xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)] md:p-8">
                <div className="flex flex-col gap-5">
                  <div>
                    <label className={labelCls}>Автордың аты-жөні</label>
                    <input className={fieldCls} name="author_name" type="text" required value={draft.author_name} onChange={(e) => setDraft((d) => ({ ...d, author_name: e.target.value }))} placeholder="Сіздің атыңыз" />
                  </div>
                  <div>
                    <label className={labelCls}>Кітаптың атауы</label>
                    <input className={fieldCls} name="book_title" type="text" required value={draft.book_title} onChange={(e) => setDraft((d) => ({ ...d, book_title: e.target.value }))} placeholder="Мысалы: Ата-анаға арналған естеліктер" />
                  </div>
                  <div>
                    <label className={labelCls}>Кімге арналған</label>
                    <input className={fieldCls} name="recipient_name" type="text" required value={draft.recipient_name} onChange={(e) => setDraft((d) => ({ ...d, recipient_name: e.target.value }))} placeholder="Алушының аты" />
                  </div>
                  <div>
                    <label className={labelCls}>Жеткізу мекенжайы</label>
                    <textarea className={clsx(fieldCls, 'min-h-[88px] resize-y')} name="delivery_address" required value={draft.delivery_address} onChange={(e) => setDraft((d) => ({ ...d, delivery_address: e.target.value }))} placeholder="Қала, көше, үй нөмірі" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900">
                  {error}
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  className="flex-1"
                  onClick={() => { setStep('pick'); setSelectedCategory(null); router.replace('/dashboard/new', { scroll: false }) }}
                >
                  ← Артқа
                </Button>
                <Button type="submit" variant="primary" disabled={busy} className="flex-[2]">
                  {busy ? 'Сақталуда…' : 'Кітап жасау →'}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function NewBookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
          <p className="text-[13px] font-semibold text-[color:var(--text-muted)]">Жүктелуде…</p>
        </div>
      }
    >
      <NewBookPageInner />
    </Suspense>
  )
}
