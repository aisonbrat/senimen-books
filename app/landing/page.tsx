'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Injected keyframes ─────────────────────────────────────────────────────
const STYLES = `
@keyframes lFadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lScale {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes lMarquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.l-badge  { animation: lFadeUp 0.8s 0s    cubic-bezier(0.22,1,0.36,1) both; }
.l-h1     { animation: lFadeUp 0.9s 0.1s  cubic-bezier(0.22,1,0.36,1) both; }
.l-desc   { animation: lFadeUp 0.8s 0.28s cubic-bezier(0.22,1,0.36,1) both; }
.l-cta    { animation: lFadeUp 0.8s 0.42s cubic-bezier(0.22,1,0.36,1) both; }
.l-stats  { animation: lFadeUp 0.8s 0.55s cubic-bezier(0.22,1,0.36,1) both; }
.l-img    { animation: lScale  1.0s 0.15s cubic-bezier(0.22,1,0.36,1) both; }
.l-marquee { animation: lMarquee 32s linear infinite; white-space: nowrap; }
`

// ── Scroll-reveal hook ─────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, v }
}

function R({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, v } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'none' : 'translateY(22px)',
        transition: `opacity 0.7s ${delay}ms cubic-bezier(0.22,1,0.36,1), transform 0.7s ${delay}ms cubic-bezier(0.22,1,0.36,1)`,
      }}
    >
      {children}
    </div>
  )
}

// ── FAQ accordion item ─────────────────────────────────────────────────────
function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[color:var(--border)] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-start justify-between gap-4 py-5 text-left focus-visible:outline-none"
      >
        <span className="text-[14px] font-semibold leading-snug text-[color:var(--text-primary)] md:text-[15px]">
          {q}
        </span>
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] text-[16px] leading-none text-[color:var(--accent)]"
          style={{ transition: 'transform .28s cubic-bezier(0.4,0,0.2,1)', transform: open ? 'rotate(45deg)' : 'none' }}
        >
          +
        </span>
      </button>
      <div style={{ maxHeight: open ? '520px' : 0, overflow: 'hidden', transition: 'max-height .42s cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="pb-5 text-[13px] leading-relaxed text-[color:var(--text-secondary)] md:text-[14px]">{a}</div>
      </div>
    </div>
  )
}

type TrialCategory = { id: string; title_kk: string; description_kk: string | null }

// ── Landing page ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [trialOffers, setTrialOffers] = useState<TrialCategory[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Fetch trial categories (public anon read)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [trialRes, catRes] = await Promise.all([
        supabase.from('trial_global_categories').select('category_id'),
        supabase.from('categories').select('id, title_kk, description_kk, is_active').order('sort_order'),
      ])
      if (cancelled || trialRes.error || catRes.error) return
      const byId = new Map(
        (catRes.data ?? [])
          .filter((c: any) => c.is_active !== false)
          .map((c: any) => [c.id, c])
      )
      const offers: TrialCategory[] = []
      for (const row of trialRes.data ?? []) {
        const c = byId.get((row as any).category_id) as any
        if (c) offers.push({ id: c.id, title_kk: c.title_kk, description_kk: c.description_kk ?? null })
      }
      if (!cancelled) setTrialOffers(offers)
    })()
    return () => { cancelled = true }
  }, [supabase])

  const WA    = 'https://wa.me/77067074748'
  const LOGIN = '/auth/login'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ────────────────────────────────────────────────────── NAV */}
      <nav
        className={[
          'fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-5 transition-all duration-300 md:px-10',
          scrolled
            ? 'border-b border-[color:var(--border)] bg-white/94 shadow-[0_1px_20px_rgba(15,23,42,0.06)] backdrop-blur-md'
            : 'bg-transparent',
        ].join(' ')}
      >
        <a href="/" className="shrink-0">
          <img src="/logo.svg" alt="Senimen Books" className="h-6 w-auto" />
        </a>
        <div className="hidden items-center gap-6 md:flex">
          {[['#why','Не үшін?'],['#how','Қалай?'],['#products','Бағалар'],['#faq','ЖҚС']].map(([h, l]) => (
            <a key={h} href={h} className="text-[13px] font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--accent)]">
              {l}
            </a>
          ))}
        </div>
        <a
          href={LOGIN}
          className="rounded-xl border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-4 py-2 text-[13px] font-semibold text-[color:var(--accent)] transition-all hover:bg-[color:var(--accent-muted)]"
        >
          Кіру
        </a>
      </nav>

      <main className="overflow-x-hidden">

        {/* ──────────────────────────────────────────────────── HERO */}
        <section className="relative min-h-screen bg-[#FAFAF8] pt-16">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 px-5 pb-16 pt-12 md:min-h-[calc(100vh-4rem)] md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:px-10 md:pb-20 md:pt-16 lg:gap-14">

            {/* Left: text */}
            <div className="flex flex-col justify-center">
              <div
                className="l-badge mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-3.5 py-1.5"
                style={{ opacity: 0 }}
              >
                <span className="size-1.5 rounded-full bg-[color:var(--accent)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[color:var(--accent)]">
                  Персоналды кітаптар баспасы
                </span>
              </div>

              <h1
                className="l-h1 font-['Cormorant'] text-[3.2rem] font-semibold leading-[1.06] tracking-[-0.02em] text-[color:var(--text-primary)] md:text-[4rem] lg:text-[4.8rem]"
                style={{ opacity: 0 }}
              >
                Кітаптың<br />
                авторы — <em className="not-italic text-[color:var(--accent)]">Сіз.</em>
                <br />
                Басты<br className="hidden md:block" /> кейіпкері — <em className="not-italic text-[color:var(--accent)]">Ол.</em>
              </h1>

              <p
                className="l-desc mt-6 max-w-lg text-[16px] leading-[1.72] text-[color:var(--text-secondary)]"
                style={{ opacity: 0 }}
              >
                Біз сіздің махаббат хикаяңызды кәсіби редакцияланған,
                эстетикалық кітапқа айналдырамыз.
                Сүйіктіңізге арналған ең ерекше сыйлық.
              </p>

              <div
                className="l-cta mt-8 flex flex-wrap gap-3"
                style={{ opacity: 0 }}
              >
                <a
                  href={WA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[color:var(--accent)] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_18px_rgba(115,22,22,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--accent-hover)] hover:shadow-[0_8px_28px_rgba(115,22,22,0.34)]"
                >
                  WhatsApp-қа жазу
                </a>
                <a
                  href={LOGIN}
                  className="rounded-xl border border-[color:var(--border)] bg-white px-6 py-3.5 text-[15px] font-semibold text-[color:var(--text-primary)] shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent-ring)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.1)]"
                >
                  Кіру
                </a>
              </div>

              <div
                className="l-stats mt-10 flex flex-wrap gap-x-8 gap-y-3"
                style={{ opacity: 0 }}
              >
                {[['100+', 'сұрақ'], ['40', 'сурет дейін'], ['7–14', 'күнде дайын']].map(([n, l]) => (
                  <div key={l} className="flex items-baseline gap-1.5">
                    <span className="font-['Cormorant'] text-[2.4rem] font-semibold tabular-nums leading-none text-[color:var(--text-primary)]">
                      {n}
                    </span>
                    <span className="text-[12px] text-[color:var(--text-muted)]">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: real book photo */}
            <div className="l-img flex items-stretch" style={{ opacity: 0 }}>
              <div className="relative w-full overflow-hidden rounded-3xl shadow-[0_12px_56px_rgba(15,23,42,0.18)]">
                <img
                  src="/landing/book-open-illus.jpg"
                  alt="Кітаптың ішінен"
                  className="h-full min-h-[400px] w-full object-cover object-[20%_center]"
                />
                {/* Subtle gradient at bottom */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────── MARQUEE STRIP */}
        <section className="overflow-hidden border-y border-[color:var(--border)] bg-white py-4">
          <div className="flex">
            <div className="l-marquee flex shrink-0 items-center" style={{ willChange: 'transform' }}>
              {[...Array(2)].map((_, k) => (
                <span key={k} className="flex shrink-0 items-center">
                  {[
                    '100+ кітап жасалды',
                    'Бүкіл Қазақстан бойынша жеткізу',
                    '7–14 күнде дайын',
                    '40 сурет дейін',
                    'Кәсіби редакция және дизайн',
                    'Авторлық верстка',
                    'Сенімен кітаптар',
                  ].map((t, i) => (
                    <span key={i} className="flex shrink-0 items-center gap-5 px-8 text-[13px] font-medium text-[color:var(--text-secondary)]">
                      {t}
                      <span className="size-1 shrink-0 rounded-full bg-[color:var(--accent-ring)]" aria-hidden />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────────────── BOOK INTERIOR SHOWCASE */}
        <section className="bg-[#F9FAFB] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <R className="mb-12">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                Кітаптың іші
              </span>
              <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[2.6rem]">
                Сапасын сезіңіз
              </h2>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
                Әрбір бет — редактордың қолымен өңделген, дизайнердің жүрегімен жасалған.
              </p>
            </R>

            {/* Bento grid — real photography */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:grid-rows-2">

              {/* Tall left — book-open-redspread */}
              <R delay={0} className="md:col-span-5 md:row-span-2">
                <div className="relative min-h-[360px] overflow-hidden rounded-3xl shadow-[0_4px_28px_rgba(15,23,42,0.13)] md:h-full">
                  <img
                    src="/landing/book-open-redspread.jpg"
                    alt="Кітап беті"
                    className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </R>

              {/* Wide top-right — couple photo spread */}
              <R delay={80} className="md:col-span-7">
                <div className="relative h-[260px] overflow-hidden rounded-3xl shadow-[0_2px_16px_rgba(15,23,42,0.09)]">
                  <img
                    src="/landing/book-open-couple.jpg"
                    alt="Фотобет"
                    className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </R>

              {/* Bottom-right two cells */}
              <R delay={140} className="md:col-span-4">
                <div className="relative h-[220px] overflow-hidden rounded-3xl shadow-[0_2px_16px_rgba(15,23,42,0.09)]">
                  <img
                    src="/landing/book-open-text.jpg"
                    alt="Кітап ішіндегі мәтін"
                    className="h-full w-full object-cover object-[center_25%] transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </R>

              <R delay={200} className="md:col-span-3">
                <div className="relative h-[220px] overflow-hidden rounded-3xl shadow-[0_2px_16px_rgba(15,23,42,0.09)]">
                  <img
                    src="/landing/book-open-dark.jpg"
                    alt="Иллюстрациялы бет"
                    className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </R>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────── WHY — 3 cards */}
        <section id="why" className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <R className="mb-12">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                Не үшін?
              </span>
              <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold text-[color:var(--text-primary)] md:text-[2.6rem]">
                Неліктен кітап жазу керек?
              </h2>
            </R>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  n: '01',
                  title: 'Естеліктерді уақыттан сақтап қалу',
                  desc: 'Өмірдің ең мағыналы сәттерін мәңгіге кітап бетіне сіңіріңіз. Жылдар өтсе де ешкім алып кете алмайды.',
                },
                {
                  n: '02',
                  title: 'Жақыныңызға өзінің бағалы екенін сезіндіру',
                  desc: 'Дүниедегі ең ерекше сыйлық — назар. Кітап сіздің уақытыңыздың, жүрегіңіздің айқын белгісі.',
                },
                {
                  n: '03',
                  title: 'Тілмен айта алмағанды сөзбен жеткіз',
                  desc: 'Кейде сезімдер сөзге сыймайды. Бірақ кітап бетінде — мәңгі тұрады.',
                },
              ].map((c, i) => (
                <R key={c.n} delay={i * 80}>
                  <div className="group h-full rounded-3xl border border-[color:var(--border)] bg-[#F9FAFB] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent-ring)] hover:bg-white hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
                    <span className="font-['Cormorant'] text-[3.2rem] font-semibold leading-none text-[color:var(--border-strong)] transition-colors group-hover:text-[color:var(--accent-ring)]">
                      {c.n}
                    </span>
                    <h3 className="mt-4 text-[16px] font-semibold leading-snug text-[color:var(--text-primary)]">
                      {c.title}
                    </h3>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                      {c.desc}
                    </p>
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────── HOW IT WORKS */}
        <section id="how" className="bg-[#F9FAFB] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <R className="mb-14 text-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                Процесс
              </span>
              <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold text-[color:var(--text-primary)] md:text-[2.6rem]">
                Қалай жасалады?
              </h2>
              <p className="mt-3 text-[14px] text-[color:var(--text-muted)]">
                Төрт қадам — ғұмырлық кітап.
              </p>
            </R>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: '01', t: 'Менеджерге жазыңыз', d: 'WhatsApp арқылы хабарлас. Менеджер барлығын түсіндіреді және сізді жүйеге қосады.' },
                { n: '02', t: 'Сұрақтарға жауап беріңіз', d: '100+ сұраққа жауап беріп, 40 сурет дейін жүктейсіз. Ыңғайлы, өз уақытыңызда.' },
                { n: '03', t: 'Редакция және дизайн', d: 'Редакторлар мәтінді өңдейді. Дизайнерлер кітап версткасын жасайды. Макетті бекітесіз.' },
                { n: '04', t: 'Басып шығару және жеткізу', d: '7–14 жұмыс күні ішінде дайын. Бүкіл Қазақстан бойынша жеткіземіз.' },
              ].map((s, i) => (
                <R key={s.n} delay={i * 80}>
                  <div className="group h-full rounded-3xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(15,23,42,0.10)]">
                    <span className="font-['Cormorant'] text-[3.2rem] font-semibold leading-none text-[color:var(--border-strong)] transition-colors group-hover:text-[color:var(--accent-ring)]">
                      {s.n}
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold leading-snug text-[color:var(--text-primary)]">
                      {s.t}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                      {s.d}
                    </p>
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────────────── FREE TRIAL BOOKS */}
        {trialOffers.length > 0 && (
          <section className="bg-white py-20 md:py-28">
            <div className="mx-auto max-w-7xl px-5 md:px-10">
              <R className="mb-12">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                      Тегін
                    </span>
                    <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold text-[color:var(--text-primary)] md:text-[2.6rem]">
                      Тегін жазып көруге болады
                    </h2>
                    <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
                      Тіркелгеннен кейін төмендегі үлгілер бойынша алғашқы 6 сұрақ тегін ашылады.
                      Кітапты жазып көріп, форматты сезіңіз.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-2xl border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-4 py-2 text-[13px] font-bold uppercase tracking-[0.1em] text-[color:var(--accent)]">
                    Тегін
                  </span>
                </div>
              </R>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trialOffers.map((offer, i) => (
                  <R key={offer.id} delay={i * 60}>
                    <a
                      href={LOGIN}
                      className="group flex h-full flex-col justify-between rounded-2xl border border-[color:var(--border)] bg-[#F9FAFB] px-5 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent-ring)] hover:bg-white hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold leading-snug text-[color:var(--text-primary)]">
                          {offer.title_kk}
                        </p>
                        {offer.description_kk && (
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-[color:var(--text-muted)]">
                            {offer.description_kk}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="rounded-lg border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--accent)]">
                          Тегін · 6 сұрақ
                        </span>
                        <span className="text-[13px] font-semibold text-[color:var(--accent)] transition-transform group-hover:translate-x-0.5">
                          Бастау →
                        </span>
                      </div>
                    </a>
                  </R>
                ))}
              </div>

              <R delay={80}>
                <p className="mt-6 text-center text-[12px] text-[color:var(--text-muted)]">
                  Толық кітап үшін менеджерге{' '}
                  <a href={WA} target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent)] underline underline-offset-2">
                    WhatsApp арқылы
                  </a>{' '}
                  хабарласыңыз.
                </p>
              </R>
            </div>
          </section>
        )}

        {/* ───────────────────────────────────── BOOK COLLECTION */}
        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <R className="mb-10">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                Жасалған кітаптар
              </span>
              <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold text-[color:var(--text-primary)] md:text-[2.6rem]">
                100+ кітап жасалды
              </h2>
            </R>

            {/* Two large photos */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <R delay={0}>
                <div className="overflow-hidden rounded-3xl shadow-[0_4px_28px_rgba(15,23,42,0.12)]">
                  <img
                    src="/landing/books-stack.jpg"
                    alt="Кітаптар жинағы"
                    className="h-[420px] w-full object-cover object-center transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </R>
              <R delay={100}>
                <div className="overflow-hidden rounded-3xl shadow-[0_4px_28px_rgba(15,23,42,0.12)]">
                  <img
                    src="/landing/books-fan.jpg"
                    alt="Кітаптар қабаты"
                    className="h-[420px] w-full object-cover object-center transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </R>
            </div>

            {/* 4 book cover photos from existing CDN */}
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                'https://static.tildacdn.pro/tild3364-3739-4035-b739-326334323038/425188394.jpg',
                'https://static.tildacdn.pro/tild6334-3531-4533-a437-613162323466/425188395.jpg',
                'https://static.tildacdn.pro/tild3430-6564-4335-b332-353533353433/425188396.jpg',
                'https://static.tildacdn.pro/tild3733-3934-4463-b737-643664633634/425188397.jpg',
              ].map((src, i) => (
                <R key={src} delay={i * 60}>
                  <div className="overflow-hidden rounded-2xl shadow-[0_1px_4px_rgba(15,23,42,0.07)]">
                    <img
                      src={src}
                      alt={`Кітап мұқабасы ${i + 1}`}
                      className="aspect-[3/4] w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
                    />
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────────────── PRODUCTS + PRICING */}
        <section id="products" className="bg-[#F9FAFB] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <R className="mb-12">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                Бағалар
              </span>
              <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold text-[color:var(--text-primary)] md:text-[2.6rem]">
                Кітаптар түрлері
              </h2>
            </R>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* ── Product 1: memoir ── */}
              <R delay={0}>
                <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_36px_rgba(15,23,42,0.10)]">
                  <div className="pointer-events-none absolute right-0 top-0 size-28 overflow-hidden rounded-bl-[40px] rounded-tr-3xl bg-[color:var(--accent-surface)]" />
                  <div className="relative flex-1">
                    <span className="inline-flex rounded-xl border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--accent)]">
                      Негізгі өнім
                    </span>
                    <h3 className="mt-5 font-['Cormorant'] text-[2rem] font-semibold leading-tight text-[color:var(--text-primary)]">
                      Махаббат хикаясы кітабы
                    </h3>

                    {/* Price */}
                    <div className="mt-4 flex items-baseline gap-3">
                      <span className="font-['Cormorant'] text-[2.6rem] font-semibold tabular-nums leading-none text-[color:var(--text-primary)]">
                        35 500 ₸
                      </span>
                      <span className="text-[16px] font-medium text-[color:var(--text-muted)] line-through decoration-[color:var(--accent)] decoration-2">
                        44 000 ₸
                      </span>
                    </div>

                    <p className="mt-4 text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
                      Сіз сұрақтарға жауап бересіз — біздің редакторлар мен
                      дизайнерлер ғашықтық хикаяңызды шынайы кітапқа айналдырады.
                    </p>

                    <ul className="mt-6 space-y-3">
                      {[
                        '100+ жеке сұрақ',
                        '40 сурет дейін',
                        'Кәсіби редакция',
                        'Авторлық дизайн верстка',
                        'Дайын макетті онлайн бекіту',
                        'Бүкіл Қазақстан бойынша жеткізу',
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-3 text-[13px] text-[color:var(--text-secondary)]">
                          <span className="h-px w-4 shrink-0 bg-[color:var(--accent)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href={WA}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--accent)] px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[color:var(--accent-hover)] hover:shadow-[0_4px_16px_rgba(115,22,22,0.25)]"
                    >
                      Тапсырыс беру
                    </a>
                    <a
                      href={LOGIN}
                      className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-6 py-3 text-[14px] font-semibold text-[color:var(--text-secondary)] transition-all hover:border-[color:var(--accent-ring)]"
                    >
                      Кіру
                    </a>
                  </div>
                </div>
              </R>

              {/* ── Product 2: Mahabbat jibi ── */}
              <R delay={120}>
                <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[color:var(--text-primary)] p-8 shadow-[0_4px_28px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-1">
                  <div className="pointer-events-none absolute right-0 top-0 size-28 overflow-hidden rounded-bl-[40px] rounded-tr-3xl bg-white/5" />
                  <div className="relative flex-1">
                    <span className="inline-flex rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">
                      Фотокітап
                    </span>
                    <h3 className="mt-5 font-['Cormorant'] text-[2rem] font-semibold leading-tight text-white">
                      «Махаббат жібі»<br />фотокітабы
                    </h3>

                    {/* Price */}
                    <div className="mt-4 flex items-baseline gap-3">
                      <span className="font-['Cormorant'] text-[2.6rem] font-semibold tabular-nums leading-none text-white">
                        26 500 ₸
                      </span>
                      <span className="text-[16px] font-medium text-white/40 line-through">
                        33 000 ₸
                      </span>
                    </div>

                    <p className="mt-4 text-[14px] leading-relaxed text-white/65">
                      20 беттен тұратын қатты бетті фотокітап.
                      Тек суреттеріңізді жіберіңіз — мәтін жазудың қажеті жоқ.
                    </p>

                    <ul className="mt-6 space-y-3">
                      {[
                        '30 сапалы сурет',
                        'Сүйікті музыкаңызға QR сілтеме беті',
                        'Алғаш кездескен күнгі аспан картасы',
                        'Жүрекжарды хат беті',
                        'Мәтін жазу қажет емес',
                        '5–7 жұмыс күнінде дайын',
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-3 text-[13px] text-white/70">
                          <span className="h-px w-4 shrink-0 bg-white/35" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-8">
                    <a
                      href={WA}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[14px] font-semibold text-[color:var(--text-primary)] transition-all hover:bg-white/92"
                    >
                      Тапсырыс беру
                    </a>
                  </div>
                </div>
              </R>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────── FAQ */}
        <section id="faq" className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-2xl px-5 md:px-10">
            <R className="mb-10">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
                Сұрақтар
              </span>
              <h2 className="mt-2 font-['Cormorant'] text-[2rem] font-semibold text-[color:var(--text-primary)] md:text-[2.6rem]">
                Жиі қойылатын сұрақтар
              </h2>
            </R>
            <R delay={60}>
              <div className="rounded-3xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_24px_rgba(15,23,42,0.08)] md:p-8">
                <FAQ
                  q="Сұрақтарға жауап беру қанша уақытты алады? Барлық сұраққа жауап беру қажет пе?"
                  a="Барлық сұраққа жауап беру қажет емес. Сіздерге қатысты, сізге ұнаған сұрақтарға жауап берсеңіз болады. Кем дегенде 80–100 сұраққа жауап берілуі керек."
                />
                <FAQ
                  q="Кітапты қалай жазамын?"
                  a={
                    <span>
                      Біздің нөмірге хабарлассаңыз, менеджер сізге барлығын түсіндіреді. Төлемнен кейін{' '}
                      <a href={LOGIN} className="text-[color:var(--accent)] underline underline-offset-2">
                        сайтқа
                      </a>{' '}
                      тіркелесіз. Сұрақтарға жауап беріп, суреттерді жүктейсіз. Редакторлар мәтінді өңдейді,
                      дизайнерлер версткасын жасайды — дайын макетті бекітесіз де басып шығаруға жібереміз.
                    </span>
                  }
                />
                <FAQ
                  q="Кітап қанша уақытта дайын болады?"
                  a="Сіз сұрақтарға жауап беріп болған соң 7–14 жұмыс күні ішінде дайын болады."
                />
                <FAQ
                  q="Кітапқа неше сурет қосуға болады?"
                  a="Кітапқа 40 суретке дейін қосуға болады."
                />
                <FAQ
                  q="Қазақстанның басқа қалаларына жеткізу бар ма?"
                  a="Иә, бүкіл Қазақстан бойынша курьерлік қызмет арқылы жеткіземіз. Алматыда дайын болған күні, басқа қалаларға 2–5 жұмыс күні."
                />
                <FAQ
                  q="«Махаббат жібі» фотокітабы қанша күнде дайын болады?"
                  a="5–7 жұмыс күні ішінде дайын болады."
                />
                <FAQ
                  q="Кітап орамасымен беріледі ме?"
                  a="Иә, сыйлық орамасымен беруге болады. Менеджерге хабарласқанда айтуды ұмытпаңыз."
                />
              </div>
            </R>
          </div>
        </section>

        {/* ─────────────────────────────────────────── FINAL CTA */}
        <section className="relative overflow-hidden bg-[color:var(--text-primary)] py-24 md:py-36">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/landing/book-open-redspread.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.08,
            }}
          />
          <div className="relative mx-auto max-w-2xl px-5 text-center md:px-10">
            <R>
              <p className="font-['Cormorant'] italic tracking-[0.1em] text-white/40">Сенімен · Кітаптар</p>
              <h2 className="mt-3 font-['Cormorant'] text-[2.6rem] font-semibold leading-tight text-white md:text-[3.8rem]">
                Қош келдің, жазушы.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-white/60">
                Жақыныңызға арналған кітап жасауды бүгін бастаңыз.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <a
                  href={WA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--accent)] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_4px_20px_rgba(115,22,22,0.45)] transition-all hover:-translate-y-0.5 hover:bg-[color:var(--accent-hover)]"
                >
                  WhatsApp-қа жазу
                </a>
                <a
                  href={LOGIN}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/22 bg-white/10 px-7 py-4 text-[15px] font-semibold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/38 hover:bg-white/16"
                >
                  Кіру →
                </a>
              </div>
            </R>
          </div>
        </section>

        {/* ──────────────────────────────────────────── FOOTER */}
        <footer className="border-t border-[color:var(--border)] bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-7 md:px-10">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Senimen Books" className="h-5 w-auto" />
              <span className="text-[12px] text-[color:var(--text-muted)]">Барлық құқықтар сақталған ©</span>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              {[['#why','Не үшін?'],['#how','Қалай?'],['#products','Бағалар'],['#faq','ЖҚС'],['/privacy','Құпиялылық']].map(([h, l]) => (
                <a key={h} href={h} className="text-[12px] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-secondary)]">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </footer>

      </main>
    </>
  )
}
