'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type TrialCategory = { id: string; title_kk: string; description_kk: string | null }

// ─── Injected keyframes + cinematic styles ────────────────────────────────────
const STYLES = `
/* Keyframes */
@keyframes revealUp {
  from { clip-path: inset(0 0 100% 0); opacity: 0; }
  to   { clip-path: inset(0 0   0% 0); opacity: 1; }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.90) translateY(24px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes grain {
  0%,100% { transform: translate(0,   0); }
  20%     { transform: translate(-2%, -2%); }
  40%     { transform: translate( 2%,  1%); }
  60%     { transform: translate(-1%,  2%); }
  80%     { transform: translate( 1%, -1%); }
}
@keyframes float {
  0%,100% { transform: translateY(0px); }
  50%     { transform: translateY(-10px); }
}
@keyframes pulseDot {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: 0.5; transform: scale(0.7); }
}

/* Hero text – line-by-line clip reveal */
.hero-line            { overflow: hidden; display: block; }
.hero-line-inner      { display: block; will-change: transform; }
.hl-1 .hero-line-inner { animation: revealUp 1.2s 0.04s cubic-bezier(0.16,1,0.3,1) both; }
.hl-2 .hero-line-inner { animation: revealUp 1.2s 0.20s cubic-bezier(0.16,1,0.3,1) both; }
.hl-3 .hero-line-inner { animation: revealUp 1.2s 0.36s cubic-bezier(0.16,1,0.3,1) both; }
.hl-4 .hero-line-inner { animation: revealUp 1.2s 0.52s cubic-bezier(0.16,1,0.3,1) both; }

.l-badge   { animation: fadeIn  0.9s 0.00s cubic-bezier(0.16,1,0.3,1) both; }
.l-desc    { animation: fadeUp  1.0s 0.68s cubic-bezier(0.16,1,0.3,1) both; }
.l-cta     { animation: fadeUp  1.0s 0.82s cubic-bezier(0.16,1,0.3,1) both; }
.l-stats   { animation: fadeUp  1.0s 0.96s cubic-bezier(0.16,1,0.3,1) both; }
.l-heroimg { animation: scaleIn 1.6s 0.00s cubic-bezier(0.16,1,0.3,1) both; }
.l-marquee { animation: marquee 40s linear infinite; white-space: nowrap; }
.l-float   { animation: float 6s ease-in-out infinite; }

/* Film grain overlay (applied via .grain class) */
.grain::after {
  content: '';
  position: absolute;
  inset: -50%;
  width: 200%; height: 200%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.045;
  pointer-events: none;
  z-index: 3;
  animation: grain 9s steps(10) infinite;
}

/* Smooth scrolling */
html { scroll-behavior: smooth; }

/* Card hover lift */
.card-lift {
  transition: transform 0.5s cubic-bezier(0.16,1,0.3,1),
              box-shadow 0.5s cubic-bezier(0.16,1,0.3,1);
}
.card-lift:hover {
  transform: translateY(-8px);
  box-shadow: 0 24px 64px rgba(15,23,42,0.14);
}

/* Image scale-on-hover */
.img-zoom img {
  transition: transform 0.8s cubic-bezier(0.16,1,0.3,1);
}
.img-zoom:hover img { transform: scale(1.06); }

/* Accent dot pulse */
.accent-dot { animation: pulseDot 2.4s ease-in-out infinite; }

/* Scroll-reveal base */
.sr { opacity: 0; transform: translateY(28px); transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1); }
.sr.in { opacity: 1; transform: translateY(0); }
`

// ─── Scroll-reveal hook ───────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
function R({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(32px)',
        transition: `opacity 0.85s ${delay}ms cubic-bezier(0.16,1,0.3,1),
                     transform 0.85s ${delay}ms cubic-bezier(0.16,1,0.3,1)`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const fired = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || fired.current) return
        fired.current = true; obs.disconnect()
        const dur = 1800, start = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - start) / dur, 1)
          const e = 1 - Math.pow(1 - p, 4)
          if (el) el.textContent = prefix + Math.round(e * to) + suffix
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.6 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [to, prefix, suffix])
  return <span ref={ref}>{prefix}0{suffix}</span>
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(x => !x)}
        className="flex w-full items-start justify-between gap-4 py-6 text-left focus-visible:outline-none"
      >
        <span className="text-[16px] font-semibold leading-snug text-white md:text-[18px]">{q}</span>
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-[18px] text-white/70"
          style={{ transition: 'transform .32s cubic-bezier(0.4,0,0.2,1)', transform: open ? 'rotate(45deg)' : 'none' }}
        >+</span>
      </button>
      <div style={{ maxHeight: open ? '600px' : 0, overflow: 'hidden', transition: 'max-height .48s cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="pb-6 text-[15px] leading-relaxed text-white/55 md:text-[16px]">{a}</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [trialOffers, setTrialOffers] = useState<TrialCategory[]>([])

  const progressRef  = useRef<HTMLDivElement>(null)
  const heroImgRef   = useRef<HTMLDivElement>(null)
  const supabase     = useMemo(() => createClient(), [])

  // Scroll → nav + progress bar + parallax (all DOM-direct, no re-renders)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y   = window.scrollY
        const max = document.documentElement.scrollHeight - window.innerHeight

        if (progressRef.current)
          progressRef.current.style.width = `${Math.min((y / max) * 100, 100)}%`

        if (heroImgRef.current)
          heroImgRef.current.style.transform = `scale(1.13) translateY(${y * 0.16}px)`

        setScrolled(y > 60)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  // Fetch trial categories
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [trialRes, catRes] = await Promise.all([
        supabase.from('trial_global_categories').select('category_id'),
        supabase.from('categories').select('id, title_kk, description_kk, is_active').order('sort_order'),
      ])
      if (cancelled || trialRes.error || catRes.error) return
      const byId = new Map(
        (catRes.data ?? []).filter((c: any) => c.is_active !== false).map((c: any) => [c.id, c])
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

      {/* ── Scroll progress bar ── */}
      <div className="fixed left-0 top-0 z-[60] h-[2px] bg-[color:var(--accent)] transition-none" ref={progressRef} style={{ width: '0%' }} />

      {/* ── NAV ── */}
      <nav
        className={[
          'fixed left-0 right-0 top-0 z-50 flex h-[68px] items-center justify-between px-5 transition-all duration-500 md:px-12',
          scrolled
            ? 'border-b border-black/8 bg-[#FAF8F3]/90 shadow-[0_2px_24px_rgba(15,23,42,0.07)] backdrop-blur-xl'
            : 'bg-transparent',
        ].join(' ')}
      >
        <a href="/" className="shrink-0">
          <img src="/logo.svg" alt="Senimen Books" className="h-6 w-auto" />
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {[['#why','Не үшін?'],['#how','Қалай?'],['#products','Бағалар'],['#faq','ЖҚС']].map(([h, l]) => (
            <a key={h} href={h} className="text-[14px] font-medium text-[color:var(--text-secondary)] transition-colors duration-200 hover:text-[color:var(--accent)]">{l}</a>
          ))}
        </div>
        <a
          href={LOGIN}
          className="rounded-xl border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-5 py-2.5 text-[14px] font-semibold text-[color:var(--accent)] transition-all duration-200 hover:bg-[color:var(--accent)] hover:text-white hover:shadow-[0_4px_16px_rgba(115,22,22,0.25)]"
        >
          Кіру
        </a>
      </nav>

      <main className="overflow-x-hidden">

        {/* ══════════════════════════════════════════════════════ HERO */}
        <section className="grain relative min-h-screen overflow-hidden bg-[#FAF8F3] pt-[68px]">
          <div className="mx-auto grid max-w-none grid-cols-1 md:grid-cols-[1fr_1fr] lg:grid-cols-[52%_48%]" style={{ minHeight: 'calc(100vh - 68px)' }}>

            {/* Left: huge editorial text */}
            <div className="flex flex-col justify-center px-6 py-16 md:px-14 lg:px-20 xl:px-24">

              {/* Badge */}
              <div className="l-badge mb-8 inline-flex w-fit items-center gap-2.5 rounded-full border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-4 py-2" style={{ opacity: 0 }}>
                <span className="accent-dot size-2 rounded-full bg-[color:var(--accent)]" />
                <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">
                  Персоналды кітаптар баспасы
                </span>
              </div>

              {/* Headline — line-by-line reveal */}
              <h1 className="font-['Cormorant'] font-semibold leading-[1.04] tracking-[-0.025em] text-[color:var(--text-primary)]"
                  style={{ fontSize: 'clamp(3.2rem, 6.5vw, 7rem)' }}>
                <span className="hero-line hl-1">
                  <span className="hero-line-inner">Кітаптың</span>
                </span>
                <span className="hero-line hl-2">
                  <span className="hero-line-inner">
                    авторы — <em className="not-italic text-[color:var(--accent)]">Сіз.</em>
                  </span>
                </span>
                <span className="hero-line hl-3">
                  <span className="hero-line-inner">Басты</span>
                </span>
                <span className="hero-line hl-4">
                  <span className="hero-line-inner">
                    кейіпкері — <em className="not-italic text-[color:var(--accent)]">Ол.</em>
                  </span>
                </span>
              </h1>

              <p className="l-desc mt-8 max-w-[480px] text-[17px] leading-[1.8] text-[color:var(--text-secondary)] md:text-[18px]" style={{ opacity: 0 }}>
                Біз сіздің махаббат хикаяңызды кәсіби редакцияланған,
                эстетикалық кітапқа айналдырамыз.
                Сүйіктіңізге арналған ең ерекше сыйлық.
              </p>

              <div className="l-cta mt-10 flex flex-wrap gap-4" style={{ opacity: 0 }}>
                <a
                  href={WA} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl bg-[color:var(--accent)] px-7 py-4 text-[16px] font-semibold text-white shadow-[0_6px_24px_rgba(115,22,22,0.32)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_36px_rgba(115,22,22,0.38)]"
                >
                  WhatsApp-қа жазу
                </a>
                <a
                  href={LOGIN}
                  className="rounded-xl border border-[color:var(--border)] bg-white px-7 py-4 text-[16px] font-semibold text-[color:var(--text-primary)] shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent-ring)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
                >
                  Кіру →
                </a>
              </div>

              {/* Stats */}
              <div className="l-stats mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-[color:var(--border)] pt-8" style={{ opacity: 0 }}>
                {[
                  { val: 100, suf: '+', label: 'кітап жасалды' },
                  { val: 40,  suf: '',  label: 'сурет дейін' },
                  { val: 14,  suf: '',  label: 'күнде дайын' },
                ].map(({ val, suf, label }) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="font-['Cormorant'] tabular-nums font-semibold leading-none text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.4rem,3.5vw,3.2rem)' }}>
                      <Counter to={val} suffix={suf} />
                    </span>
                    <span className="text-[14px] text-[color:var(--text-muted)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: parallax photo — edge to edge */}
            <div className="l-heroimg relative min-h-[55vw] overflow-hidden md:min-h-0" style={{ opacity: 0 }}>
              <div
                ref={heroImgRef}
                className="absolute inset-0"
                style={{ transform: 'scale(1.13)', transformOrigin: 'center', willChange: 'transform' }}
              >
                <img
                  src="/landing/book-open-illus.jpg"
                  alt="Кітаптың іші"
                  className="h-full w-full object-cover object-[30%_center]"
                  style={{ imageOrientation: 'from-image' }}
                />
              </div>
              {/* Left fade → bleeds into text column */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#FAF8F3] to-transparent" />
              {/* Bottom vignette */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FAF8F3]/50 to-transparent" />
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════ MARQUEE STRIP */}
        <section className="overflow-hidden border-y border-[color:var(--border)] bg-[#F4F0EA] py-5">
          <div className="flex">
            <div className="l-marquee flex shrink-0 items-center" style={{ willChange: 'transform' }}>
              {[...Array(2)].map((_, k) => (
                <span key={k} className="flex shrink-0 items-center">
                  {[
                    '100+ кітап жасалды',
                    'Бүкіл Қазақстан бойынша жеткізу',
                    '7–14 күнде дайын',
                    '40 сурет дейін',
                    'Кәсіби редакция',
                    'Авторлық верстка',
                    'Сенімен · Кітаптар',
                  ].map((t, i) => (
                    <span key={i} className="flex shrink-0 items-center gap-6 px-8 text-[14px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-secondary)]">
                      {t}
                      <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" aria-hidden />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════ BOOK INTERIOR — dark cinematic */}
        <section className="grain relative overflow-hidden bg-[#18140E] py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5 md:px-12">
            <R className="mb-14">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent-ring)]">
                Кітаптың іші
              </span>
              <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-white" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                Сапасын сезіңіз
              </h2>
              <p className="mt-4 max-w-xl text-[17px] leading-[1.75] text-white/55 md:text-[18px]">
                Әрбір бет — редактордың қолымен өңделген, дизайнердің жүрегімен жасалған.
              </p>
            </R>

            {/* Asymmetric bento — landscape images only */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:grid-rows-[320px_240px]">

              {/* Featured large — left */}
              <R delay={0} className="md:col-span-7 md:row-span-2">
                <div className="img-zoom relative h-[60vw] min-h-[280px] overflow-hidden rounded-2xl md:h-full">
                  <img
                    src="/landing/book-open-redspread.jpg"
                    alt="Кітап беті"
                    className="h-full w-full object-cover object-[50%_40%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
              </R>

              {/* Top right */}
              <R delay={80} className="md:col-span-5">
                <div className="img-zoom relative h-[50vw] min-h-[220px] overflow-hidden rounded-2xl md:h-full">
                  <img
                    src="/landing/book-open-couple.jpg"
                    alt="Фото бет"
                    className="h-full w-full object-cover object-[50%_30%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              </R>

              {/* Bottom right */}
              <R delay={160} className="md:col-span-5">
                <div className="img-zoom relative h-[40vw] min-h-[180px] overflow-hidden rounded-2xl md:h-full">
                  <img
                    src="/landing/book-open-dark.jpg"
                    alt="Иллюстрациялы бет"
                    className="h-full w-full object-cover object-[50%_50%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              </R>
            </div>

            {/* Two more below */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { src: 'book-open-text.jpg', pos: '50% 25%', alt: 'Мәтін беті' },
                { src: 'book-open-illus.jpg', pos: '70% 50%', alt: 'Иллюстрация беті' },
              ].map(({ src, pos, alt }, i) => (
                <R key={src} delay={i * 80}>
                  <div className="img-zoom relative h-[44vw] min-h-[200px] max-h-[340px] overflow-hidden rounded-2xl">
                    <img
                      src={`/landing/${src}`}
                      alt={alt}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: pos, imageOrientation: 'from-image' }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════ WHY — 3 cards */}
        <section id="why" className="bg-[#FAF8F3] py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5 md:px-12">
            <R className="mb-16">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">
                Не үшін?
              </span>
              <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                Неліктен кітап жазу керек?
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-[1.75] text-[color:var(--text-secondary)] md:text-[18px]">
                Сезімдерді сөзге айналдыру — ең сирек, ең бағалы сыйлық.
              </p>
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
                <R key={c.n} delay={i * 100}>
                  <div className="card-lift group h-full rounded-3xl border border-[color:var(--border)] bg-white p-8 md:p-10">
                    <span className="font-['Cormorant'] font-semibold leading-none text-[color:var(--border-strong)] transition-colors duration-300 group-hover:text-[color:var(--accent-ring)]"
                          style={{ fontSize: 'clamp(3rem,5vw,4.5rem)' }}>
                      {c.n}
                    </span>
                    <h3 className="mt-6 text-[19px] font-semibold leading-snug text-[color:var(--text-primary)] md:text-[21px]">
                      {c.title}
                    </h3>
                    <p className="mt-4 text-[15px] leading-[1.8] text-[color:var(--text-secondary)] md:text-[16px]">
                      {c.desc}
                    </p>
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════ HOW IT WORKS */}
        <section id="how" className="bg-white py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5 md:px-12">
            <R className="mb-16 text-center">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">
                Процесс
              </span>
              <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                Қалай жасалады?
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-[color:var(--text-secondary)] md:text-[18px]">
                Төрт қадам — ғұмырлық кітап.
              </p>
            </R>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: '01', t: 'Менеджерге жазыңыз', d: 'WhatsApp арқылы хабарлас. Менеджер барлығын түсіндіреді және сізді жүйеге қосады.' },
                { n: '02', t: 'Сұрақтарға жауап беріңіз', d: '100+ сұраққа жауап беріп, 40 сурет дейін жүктейсіз. Ыңғайлы, өз уақытыңызда.' },
                { n: '03', t: 'Редакция және дизайн', d: 'Редакторлар мәтінді өңдейді. Дизайнерлер версткасын жасайды. Макетті бекітесіз.' },
                { n: '04', t: 'Басып шығару және жеткізу', d: '7–14 жұмыс күні ішінде дайын. Бүкіл Қазақстан бойынша жеткіземіз.' },
              ].map((s, i) => (
                <R key={s.n} delay={i * 90}>
                  <div className="card-lift group relative h-full rounded-3xl border border-[color:var(--border)] bg-[#FAF8F3] p-8">
                    <span className="font-['Cormorant'] font-semibold leading-none text-[color:var(--border-strong)] transition-colors duration-300 group-hover:text-[color:var(--accent-ring)]"
                          style={{ fontSize: 'clamp(3rem,5vw,4.5rem)' }}>
                      {s.n}
                    </span>
                    <h3 className="mt-6 text-[18px] font-semibold leading-snug text-[color:var(--text-primary)] md:text-[20px]">
                      {s.t}
                    </h3>
                    <p className="mt-3 text-[15px] leading-[1.8] text-[color:var(--text-secondary)] md:text-[16px]">
                      {s.d}
                    </p>
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════ FREE TRIAL BOOKS */}
        {trialOffers.length > 0 && (
          <section className="bg-[#FAF8F3] py-24 md:py-36">
            <div className="mx-auto max-w-7xl px-5 md:px-12">
              <R className="mb-14">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">Тегін</span>
                    <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                      Тегін жазып көруге болады
                    </h2>
                    <p className="mt-5 max-w-xl text-[17px] leading-[1.75] text-[color:var(--text-secondary)] md:text-[18px]">
                      Тіркелгеннен кейін төмендегі үлгілер бойынша алғашқы 6 сұрақ тегін ашылады.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-2xl border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.12em] text-[color:var(--accent)]">
                    Тегін
                  </span>
                </div>
              </R>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trialOffers.map((offer, i) => (
                  <R key={offer.id} delay={i * 55}>
                    <a
                      href={LOGIN}
                      className="group flex h-full flex-col justify-between rounded-2xl border border-[color:var(--border)] bg-white px-6 py-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--accent-ring)] hover:shadow-[0_8px_32px_rgba(15,23,42,0.09)]"
                    >
                      <p className="text-[16px] font-semibold leading-snug text-[color:var(--text-primary)] md:text-[18px]">
                        {offer.title_kk}
                      </p>
                      {offer.description_kk && (
                        <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[color:var(--text-muted)] md:text-[15px]">
                          {offer.description_kk}
                        </p>
                      )}
                      <div className="mt-5 flex items-center justify-between gap-2">
                        <span className="rounded-lg border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--accent)]">
                          Тегін · 6 сұрақ
                        </span>
                        <span className="text-[15px] font-semibold text-[color:var(--accent)] transition-transform duration-200 group-hover:translate-x-1">
                          Бастау →
                        </span>
                      </div>
                    </a>
                  </R>
                ))}
              </div>

              <R delay={100}>
                <p className="mt-8 text-center text-[14px] text-[color:var(--text-muted)]">
                  Толық кітап үшін менеджерге{' '}
                  <a href={WA} target="_blank" rel="noopener noreferrer"
                     className="text-[color:var(--accent)] underline underline-offset-2">WhatsApp арқылы</a>{' '}
                  хабарласыңыз.
                </p>
              </R>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════ BOOK COLLECTION */}
        <section className="bg-white py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5 md:px-12">
            <R className="mb-14">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">
                Жасалған кітаптар
              </span>
              <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                <Counter to={100} suffix="+" /> кітап жасалды
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-[1.75] text-[color:var(--text-secondary)] md:text-[18px]">
                Нақты адамдардың нақты хикаялары. Сізден кейінгі ұрпаққа қалатын естелік.
              </p>
            </R>

            {/* Hero pair */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <R delay={0}>
                <div className="img-zoom overflow-hidden rounded-3xl">
                  <img
                    src="/landing/books-stack.jpg"
                    alt="Кітаптар жинағы"
                    className="h-[56vw] max-h-[440px] min-h-[260px] w-full object-cover object-[50%_60%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                </div>
              </R>
              <R delay={100}>
                <div className="img-zoom overflow-hidden rounded-3xl">
                  <img
                    src="/landing/books-fan.jpg"
                    alt="Кітаптар желпуіші"
                    className="h-[56vw] max-h-[440px] min-h-[260px] w-full object-cover object-[50%_50%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                </div>
              </R>
            </div>

            {/* Secondary trio */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <R delay={0}>
                <div className="img-zoom overflow-hidden rounded-2xl">
                  <img
                    src="/landing/books-shelf.jpg"
                    alt="Кітаптар сөресі"
                    className="h-[40vw] max-h-[280px] min-h-[180px] w-full object-cover object-[50%_45%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                </div>
              </R>
              <R delay={80}>
                <div className="img-zoom overflow-hidden rounded-2xl">
                  <img
                    src="/landing/book-cover-single.jpg"
                    alt="Кітап мұқабасы"
                    className="h-[40vw] max-h-[280px] min-h-[180px] w-full object-cover object-[50%_35%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                </div>
              </R>
              <R delay={160}>
                <div className="img-zoom overflow-hidden rounded-2xl">
                  <img
                    src="/landing/book-open-text.jpg"
                    alt="Кітаптың іші"
                    className="h-[40vw] max-h-[280px] min-h-[180px] w-full object-cover object-[50%_25%]"
                    style={{ imageOrientation: 'from-image' }}
                  />
                </div>
              </R>
            </div>

            {/* Tilda CDN covers */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                'https://static.tildacdn.pro/tild3364-3739-4035-b739-326334323038/425188394.jpg',
                'https://static.tildacdn.pro/tild6334-3531-4533-a437-613162323466/425188395.jpg',
                'https://static.tildacdn.pro/tild3430-6564-4335-b332-353533353433/425188396.jpg',
                'https://static.tildacdn.pro/tild3733-3934-4463-b737-643664633634/425188397.jpg',
              ].map((src, i) => (
                <R key={src} delay={i * 55}>
                  <div className="img-zoom overflow-hidden rounded-2xl shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                    <img
                      src={src}
                      alt={`Кітап мұқабасы ${i + 1}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════ PRICING */}
        <section id="products" className="bg-[#FAF8F3] py-24 md:py-36">
          <div className="mx-auto max-w-7xl px-5 md:px-12">
            <R className="mb-16">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">Бағалар</span>
              <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                Кітаптар түрлері
              </h2>
            </R>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* ── Product 1 ── */}
              <R delay={0}>
                <div className="card-lift group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white p-8 shadow-[0_2px_12px_rgba(15,23,42,0.06)] md:p-10">
                  <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 overflow-hidden rounded-bl-[48px] rounded-tr-3xl bg-[color:var(--accent-surface)]" />
                  <div className="relative flex-1">
                    <span className="inline-flex rounded-xl border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--accent)]">
                      Негізгі өнім
                    </span>
                    <h3 className="mt-6 font-['Cormorant'] font-semibold leading-tight text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)' }}>
                      Махаббат хикаясы кітабы
                    </h3>
                    <div className="mt-5 flex items-baseline gap-4">
                      <span className="font-['Cormorant'] tabular-nums font-semibold leading-none text-[color:var(--text-primary)]" style={{ fontSize: 'clamp(2.2rem,4vw,3.2rem)' }}>
                        35 500 ₸
                      </span>
                      <span className="text-[17px] font-medium text-[color:var(--text-muted)] line-through decoration-[color:var(--accent)] decoration-2">
                        44 000 ₸
                      </span>
                    </div>
                    <p className="mt-5 text-[16px] leading-[1.8] text-[color:var(--text-secondary)] md:text-[17px]">
                      Сіз сұрақтарға жауап бересіз — біздің редакторлар мен дизайнерлер
                      ғашықтық хикаяңызды шынайы кітапқа айналдырады.
                    </p>
                    <ul className="mt-7 space-y-3.5">
                      {[
                        '100+ жеке сұрақ',
                        '40 сурет дейін',
                        'Кәсіби редакция',
                        'Авторлық дизайн верстка',
                        'Дайын макетті онлайн бекіту',
                        'Бүкіл Қазақстан бойынша жеткізу',
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-3.5 text-[15px] text-[color:var(--text-secondary)] md:text-[16px]">
                          <span className="h-px w-5 shrink-0 bg-[color:var(--accent)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-9 flex flex-wrap gap-3">
                    <a
                      href={WA} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--accent)] px-7 py-4 text-[16px] font-semibold text-white transition-all hover:bg-[color:var(--accent-hover)] hover:shadow-[0_6px_20px_rgba(115,22,22,0.28)]"
                    >
                      Тапсырыс беру
                    </a>
                    <a
                      href={LOGIN}
                      className="inline-flex items-center rounded-xl border border-[color:var(--border)] bg-[#FAF8F3] px-7 py-4 text-[16px] font-semibold text-[color:var(--text-secondary)] transition-all hover:border-[color:var(--accent-ring)]"
                    >
                      Кіру
                    </a>
                  </div>
                </div>
              </R>

              {/* ── Product 2: dark card ── */}
              <R delay={120}>
                <div className="grain card-lift group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[#18140E] p-8 shadow-[0_6px_36px_rgba(15,23,42,0.22)] md:p-10">
                  <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 overflow-hidden rounded-bl-[48px] rounded-tr-3xl bg-white/5" />
                  <div className="relative flex-1">
                    <span className="inline-flex rounded-xl border border-white/15 bg-white/8 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white/60">
                      Фотокітап
                    </span>
                    <h3 className="mt-6 font-['Cormorant'] font-semibold leading-tight text-white" style={{ fontSize: 'clamp(1.8rem,3vw,2.6rem)' }}>
                      «Махаббат жібі»<br />фотокітабы
                    </h3>
                    <div className="mt-5 flex items-baseline gap-4">
                      <span className="font-['Cormorant'] tabular-nums font-semibold leading-none text-white" style={{ fontSize: 'clamp(2.2rem,4vw,3.2rem)' }}>
                        26 500 ₸
                      </span>
                      <span className="text-[17px] font-medium text-white/35 line-through">
                        33 000 ₸
                      </span>
                    </div>
                    <p className="mt-5 text-[16px] leading-[1.8] text-white/55 md:text-[17px]">
                      20 беттен тұратын қатты бетті фотокітап.
                      Тек суреттеріңізді жіберіңіз — мәтін жазудың қажеті жоқ.
                    </p>
                    <ul className="mt-7 space-y-3.5">
                      {[
                        '30 сапалы сурет',
                        'Сүйікті музыкаңызға QR сілтеме беті',
                        'Алғаш кездескен күнгі аспан картасы',
                        'Жүрекжарды хат беті',
                        'Мәтін жазу қажет емес',
                        '5–7 жұмыс күнінде дайын',
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-3.5 text-[15px] text-white/60 md:text-[16px]">
                          <span className="h-px w-5 shrink-0 bg-white/25" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-9">
                    <a
                      href={WA} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-[16px] font-semibold text-[color:var(--text-primary)] transition-all hover:bg-white/90 hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
                    >
                      Тапсырыс беру
                    </a>
                  </div>
                </div>
              </R>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════ FAQ — dark */}
        <section id="faq" className="grain relative overflow-hidden bg-[#18140E] py-24 md:py-36">
          <div className="relative mx-auto max-w-3xl px-5 md:px-12">
            <R className="mb-14">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent-ring)]">
                Сұрақтар
              </span>
              <h2 className="mt-4 font-['Cormorant'] font-semibold leading-tight text-white" style={{ fontSize: 'clamp(2.2rem,4vw,4rem)' }}>
                Жиі қойылатын сұрақтар
              </h2>
            </R>
            <R delay={60}>
              <div>
                <FAQ
                  q="Сұрақтарға жауап беру қанша уақытты алады? Барлық сұраққа жауап беру қажет пе?"
                  a="Барлық сұраққа жауап беру қажет емес. Сізге ұнаған, сіздерге қатысты сұрақтарға жауап берсеңіз болады. Кем дегенде 80–100 сұраққа жауап берілуі керек."
                />
                <FAQ
                  q="Кітапты қалай жазамын?"
                  a={
                    <span>
                      Біздің нөмірге хабарлассаңыз, менеджер сізге барлығын түсіндіреді. Төлемнен кейін{' '}
                      <a href={LOGIN} className="text-[color:var(--accent-ring)] underline underline-offset-2">сайтқа</a>{' '}
                      тіркелесіз. Сұрақтарға жауап беріп, суреттерді жүктейсіз. Редакторлар мәтінді өңдейді,
                      дизайнерлер версткасын жасайды — дайын макетті бекітесіз.
                    </span>
                  }
                />
                <FAQ q="Кітап қанша уақытта дайын болады?" a="Сіз сұрақтарға жауап беріп болған соң 7–14 жұмыс күні ішінде дайын болады." />
                <FAQ q="Кітапқа неше сурет қосуға болады?" a="Кітапқа 40 суретке дейін қосуға болады." />
                <FAQ
                  q="Қазақстанның басқа қалаларына жеткізу бар ма?"
                  a="Иә, бүкіл Қазақстан бойынша курьерлік қызмет арқылы жеткіземіз. Алматыда дайын болған күні, басқа қалаларға 2–5 жұмыс күні."
                />
                <FAQ q="«Махаббат жібі» фотокітабы қанша күнде дайын болады?" a="5–7 жұмыс күні ішінде дайын болады." />
                <FAQ q="Кітап орамасымен беріледі ме?" a="Иә, сыйлық орамасымен беруге болады. Менеджерге хабарласқанда айтуды ұмытпаңыз." />
              </div>
            </R>
          </div>
        </section>

        {/* ════════════════════════════════════════════════ FINAL CTA */}
        <section className="grain relative overflow-hidden bg-[#18140E] py-32 md:py-44">
          {/* Background book photo */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/landing/book-open-redspread.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: '50% 40%',
              opacity: 0.10,
              filter: 'saturate(0.5)',
            }}
          />
          {/* Vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#18140E_80%)]" />

          <div className="relative mx-auto max-w-3xl px-5 text-center md:px-12">
            <R>
              <p className="font-['Cormorant'] text-[18px] italic tracking-[0.16em] text-white/35 md:text-[20px]">
                Сенімен · Кітаптар
              </p>
              <h2 className="mt-5 font-['Cormorant'] font-semibold leading-[1.06] text-white" style={{ fontSize: 'clamp(3rem,7vw,6.5rem)' }}>
                Қош келдің,<br />жазушы.
              </h2>
              <p className="mx-auto mt-7 max-w-lg text-[17px] leading-[1.8] text-white/50 md:text-[19px]">
                Жақыныңызға арналған кітап жасауды бүгін бастаңыз.
              </p>
              <div className="mt-12 flex flex-wrap justify-center gap-5">
                <a
                  href={WA} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[color:var(--accent)] px-9 py-5 text-[17px] font-semibold text-white shadow-[0_6px_28px_rgba(115,22,22,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(115,22,22,0.55)]"
                >
                  WhatsApp-қа жазу
                </a>
                <a
                  href={LOGIN}
                  className="inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/8 px-9 py-5 text-[17px] font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/38 hover:bg-white/14"
                >
                  Кіру →
                </a>
              </div>
            </R>
          </div>
        </section>

        {/* ════════════════════════════════════════════════ FOOTER */}
        <footer className="border-t border-[color:var(--border)] bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 md:px-12">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Senimen Books" className="h-6 w-auto" />
              <span className="text-[13px] text-[color:var(--text-muted)]">Барлық құқықтар сақталған ©</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              {[['#why','Не үшін?'],['#how','Қалай?'],['#products','Бағалар'],['#faq','ЖҚС'],['/privacy','Құпиялылық']].map(([h, l]) => (
                <a key={h} href={h} className="text-[13px] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-secondary)]">{l}</a>
              ))}
            </div>
          </div>
        </footer>

      </main>
    </>
  )
}
