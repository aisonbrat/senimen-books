'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type TrialCategory = { id: string; title_kk: string; description_kk: string | null }

// ─── Deterministic particles ──────────────────────────────────────────────────
const PARTICLES = [
  { x: 8,  y: 88, s: 2.0, d: 7.5, e: 0.0,  tx: 14 },
  { x: 19, y: 75, s: 1.5, d: 9.0, e: 1.8,  tx: -9 },
  { x: 31, y: 92, s: 1.0, d: 6.5, e: 0.7,  tx: 16 },
  { x: 44, y: 80, s: 2.5, d: 8.5, e: 2.5,  tx: -13 },
  { x: 57, y: 70, s: 1.5, d: 10,  e: 0.3,  tx: 8 },
  { x: 68, y: 85, s: 1.0, d: 7.0, e: 3.2,  tx: -11 },
  { x: 79, y: 78, s: 2.0, d: 8.0, e: 1.1,  tx: 12 },
  { x: 90, y: 90, s: 1.5, d: 9.5, e: 0.5,  tx: -7 },
  { x: 13, y: 60, s: 1.0, d: 6.0, e: 4.0,  tx: 10 },
  { x: 26, y: 50, s: 2.0, d: 8.0, e: 2.0,  tx: -15 },
  { x: 52, y: 55, s: 1.5, d: 7.5, e: 1.5,  tx: 6 },
  { x: 73, y: 45, s: 1.0, d: 9.0, e: 3.8,  tx: -10 },
  { x: 85, y: 60, s: 2.5, d: 6.5, e: 0.9,  tx: 13 },
  { x: 38, y: 35, s: 1.0, d: 10,  e: 2.8,  tx: -6 },
  { x: 62, y: 30, s: 1.5, d: 7.0, e: 1.3,  tx: 9 },
]

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
/* ── Color palette ── */
.lp {
  --w:  #8B1212;
  --wh: #A51515;
  --ws: #FDF4F4;
  --wr: rgba(139,18,18,.18);
  --g:  #9E7218;
  --gl: #F8EDCF;
  --dk: #1C1108;
  --cr: #FBF7F1;
  --cr2: #F3EDE3;
  --tx: #1A1108;
  --tx2: #4A3D2E;
  --tm: #7B6B54;
  --bd: rgba(26,17,8,.10);
}

html { scroll-behavior: smooth; }

/* ── Keyframes ── */
@keyframes clipUp {
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0   0% 0); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes tickerMove {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes particleFloat {
  0%   { opacity: 0;    transform: translateY(0)     translateX(0); }
  15%  { opacity: 0.9; }
  70%  { opacity: 0.35; }
  100% { opacity: 0;    transform: translateY(-72px) translateX(var(--ptx)); }
}
@keyframes grainAnim {
  0%,100% { transform: translate(0,    0); }
  10%     { transform: translate(-2%,  1%); }
  20%     { transform: translate( 1%, -2%); }
  30%     { transform: translate(-1%,  2%); }
  40%     { transform: translate( 2%, -1%); }
  50%     { transform: translate(-2%,  0); }
  60%     { transform: translate( 0,   2%); }
  70%     { transform: translate( 1%, -1%); }
  80%     { transform: translate(-1%,  1%); }
  90%     { transform: translate( 2%, -2%); }
}
@keyframes lineExpand {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes dotPulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: 0.5; transform: scale(0.65); }
}
@keyframes goldShimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}

/* ── Hero clip reveal ── */
.hl-inner { display: block; will-change: clip-path; }
.hl-1 .hl-inner { animation: clipUp 1.1s 0.04s cubic-bezier(0.16,1,0.3,1) both; }
.hl-2 .hl-inner { animation: clipUp 1.1s 0.20s cubic-bezier(0.16,1,0.3,1) both; }
.hl-3 .hl-inner { animation: clipUp 1.1s 0.36s cubic-bezier(0.16,1,0.3,1) both; }
.hl-4 .hl-inner { animation: clipUp 1.1s 0.52s cubic-bezier(0.16,1,0.3,1) both; }
.hl-wrap { overflow: hidden; display: block; }

.a1 { animation: fadeUp 1.0s 0.00s cubic-bezier(0.16,1,0.3,1) both; }
.a2 { animation: fadeUp 1.0s 0.68s cubic-bezier(0.16,1,0.3,1) both; }
.a3 { animation: fadeUp 1.0s 0.82s cubic-bezier(0.16,1,0.3,1) both; }
.a4 { animation: fadeUp 1.0s 0.96s cubic-bezier(0.16,1,0.3,1) both; }
.a-img { animation: scaleIn 1.6s 0.00s cubic-bezier(0.16,1,0.3,1) both; }

/* ── Ticker ── */
.ticker-inner { animation: tickerMove 38s linear infinite; white-space: nowrap; }

/* ── Card hover lift ── */
.card-lift {
  transition: transform 0.5s cubic-bezier(0.16,1,0.3,1),
              box-shadow 0.5s cubic-bezier(0.16,1,0.3,1);
}
.card-lift:hover { transform: translateY(-9px); box-shadow: 0 28px 64px rgba(26,17,8,0.13); }

/* ── Image zoom ── */
.img-zoom { overflow: hidden; }
.img-zoom img { transition: transform 0.85s cubic-bezier(0.16,1,0.3,1); }
.img-zoom:hover img { transform: scale(1.07); }

/* ── Accent dot pulse ── */
.dot-pulse { animation: dotPulse 2.2s ease-in-out infinite; }

/* ── Gold shimmer text ── */
.shimmer-gold {
  background: linear-gradient(90deg, var(--g) 0%, #F4CE78 40%, var(--g) 60%, #C9932A 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: goldShimmer 3.5s linear infinite;
}

/* ── Ink line decorator ── */
.ink-line {
  width: 40px; height: 1.5px;
  background: var(--w);
  transform-origin: left;
  animation: lineExpand 0.9s cubic-bezier(0.16,1,0.3,1) both;
}
`

// ─── Grain component (JSX, not CSS ::after) ───────────────────────────────────
function Grain({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
      <div style={{
        position: 'absolute', inset: '-50%', width: '200%', height: '200%',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity,
        mixBlendMode: 'overlay' as const,
        animation: 'grainAnim 8s steps(10) infinite',
      }} />
    </div>
  )
}

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
function R({ children, delay = 0, className = '', style: extraStyle }: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
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
        ...extraStyle,
      }}
    >
      {children}
    </div>
  )
}

// ─── Section label with ink-line ──────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <R>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="ink-line" />
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase' as const,
          color: 'var(--w)',
        }}>
          {children}
        </span>
      </div>
    </R>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const fired = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
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
    }, { threshold: 0.6 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [to, prefix, suffix])
  return <span ref={ref}>{prefix}0{suffix}</span>
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--bd)' }}>
      <button
        type="button"
        onClick={() => setOpen(x => !x)}
        style={{
          display: 'flex', width: '100%', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16, padding: '24px 0',
          textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45, color: 'var(--tx)', flex: 1 }}>{q}</span>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: '50%',
          border: '1.5px solid var(--w)',
          background: open ? 'var(--w)' : 'transparent',
          color: open ? '#fff' : 'var(--w)',
          fontSize: 20, flexShrink: 0, marginTop: 2,
          transition: 'transform .32s cubic-bezier(0.4,0,0.2,1), background .25s, color .25s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}>+</span>
      </button>
      <div style={{ maxHeight: open ? '600px' : 0, overflow: 'hidden', transition: 'max-height .48s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ paddingBottom: 24, fontSize: 16, lineHeight: 1.8, color: 'var(--tx2)' }}>{a}</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [trialOffers, setTrialOffers] = useState<TrialCategory[]>([])

  const progressRef = useRef<HTMLDivElement>(null)
  const heroImgRef  = useRef<HTMLDivElement>(null)
  const supabase    = useMemo(() => createClient(), [])

  // Scroll → progress bar + parallax (DOM-direct, minimal re-renders)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y   = window.scrollY
        const max = document.documentElement.scrollHeight - window.innerHeight

        if (progressRef.current)
          progressRef.current.style.width = `${Math.min((y / max) * 100, 100)}%`

        if (heroImgRef.current) {
          const shift = Math.min(y * 0.12, 60)
          heroImgRef.current.style.transform = `scale(1.18) translateY(${shift}px)`
        }

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
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── Scroll progress bar ── */}
      <div
        ref={progressRef}
        style={{
          position: 'fixed', left: 0, top: 0, zIndex: 60,
          height: 2, background: 'var(--w)', width: '0%',
          transition: 'none', pointerEvents: 'none',
        }}
      />

      {/* ── NAV ── */}
      <nav
        style={{
          position: 'fixed', left: 0, right: 0, top: 0, zIndex: 50,
          height: 68, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 48px',
          transition: 'background 0.5s, box-shadow 0.5s, border-color 0.5s',
          background: scrolled ? 'rgba(251,247,241,0.93)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--bd)' : '1px solid transparent',
          boxShadow: scrolled ? '0 2px 24px rgba(26,17,8,0.06)' : 'none',
        }}
      >
        <a href="/" style={{ flexShrink: 0 }}>
          <img src="/logo.svg" alt="Senimen Books" style={{ height: 26, width: 'auto' }} />
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          {[['#why','Не үшін?'],['#how','Қалай?'],['#products','Бағалар'],['#faq','ЖҚС']].map(([h, l]) => (
            <a key={h} href={h} style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx2)', textDecoration: 'none', transition: 'color 0.2s' }}
               onMouseEnter={e => (e.currentTarget.style.color = 'var(--w)')}
               onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx2)')}
            >{l}</a>
          ))}
        </div>
        <a
          href={LOGIN}
          style={{
            borderRadius: 12, border: '1.5px solid var(--wr)',
            background: 'var(--ws)', padding: '10px 22px',
            fontSize: 14, fontWeight: 700, color: 'var(--w)',
            textDecoration: 'none', transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--w)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--ws)'
            e.currentTarget.style.color = 'var(--w)'
          }}
        >
          Кіру
        </a>
      </nav>

      <main style={{ overflowX: 'hidden' }}>

        {/* ══════════════════════════════════════════════════ HERO */}
        <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: 'var(--cr)', paddingTop: 68 }}>
          <Grain opacity={0.035} />

          <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '52% 48%', minHeight: 'calc(100vh - 68px)' }}>

            {/* Left: editorial text */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 80px 64px 80px' }}>

              {/* Badge */}
              <div className="a1" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 36,
                borderRadius: 999, border: '1.5px solid var(--wr)', background: 'var(--ws)',
                padding: '8px 18px', width: 'fit-content',
              }}>
                <span className="dot-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--w)', display: 'block' }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--w)' }}>
                  Персоналды кітаптар баспасы
                </span>
              </div>

              {/* Headline — line-by-line clip reveal */}
              <h1 style={{
                fontFamily: "'Cormorant', Georgia, serif",
                fontWeight: 600,
                lineHeight: 1.04,
                letterSpacing: '-0.025em',
                color: 'var(--tx)',
                fontSize: 'clamp(3.4rem, 7vw, 7rem)',
                margin: 0,
              }}>
                <span className="hl-wrap hl-1"><span className="hl-inner">Кітаптың</span></span>
                <span className="hl-wrap hl-2">
                  <span className="hl-inner">
                    авторы — <em style={{ fontStyle: 'normal', color: 'var(--w)' }}>Сіз.</em>
                  </span>
                </span>
                <span className="hl-wrap hl-3"><span className="hl-inner">Басты</span></span>
                <span className="hl-wrap hl-4">
                  <span className="hl-inner">
                    кейіпкері — <em style={{ fontStyle: 'normal', color: 'var(--w)' }}>Ол.</em>
                  </span>
                </span>
              </h1>

              <p className="a2" style={{
                marginTop: 32, maxWidth: 500,
                fontSize: 18, lineHeight: 1.8,
                color: 'var(--tx2)',
              }}>
                Біз сіздің махаббат хикаяңызды кәсіби редакцияланған,
                эстетикалық кітапқа айналдырамыз.
                Сүйіктіңізге арналған — ең ерекше, ең мәңгілік сыйлық.
              </p>

              <div className="a3" style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                <a
                  href={WA} target="_blank" rel="noopener noreferrer"
                  style={{
                    borderRadius: 14, background: 'var(--w)',
                    padding: '15px 30px', fontSize: 16, fontWeight: 700,
                    color: '#fff', textDecoration: 'none',
                    boxShadow: '0 6px 28px rgba(139,18,18,0.38)',
                    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--wh)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(139,18,18,0.46)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--w)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 6px 28px rgba(139,18,18,0.38)'
                  }}
                >
                  WhatsApp-қа жазу
                </a>
                <a
                  href={LOGIN}
                  style={{
                    borderRadius: 14, border: '1.5px solid var(--bd)',
                    background: '#fff', padding: '15px 30px',
                    fontSize: 16, fontWeight: 700, color: 'var(--tx)',
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(26,17,8,0.06)',
                    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--wr)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 28px rgba(26,17,8,0.10)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--bd)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,17,8,0.06)'
                  }}
                >
                  Кіру →
                </a>
              </div>

              {/* Stats */}
              <div className="a4" style={{
                marginTop: 48, display: 'flex', flexWrap: 'wrap', gap: '16px 40px',
                borderTop: '1px solid var(--bd)', paddingTop: 32,
              }}>
                {[
                  { val: 100, suf: '+', label: 'кітап жасалды' },
                  { val: 40,  suf: '',  label: 'сурет дейін' },
                  { val: 14,  suf: '',  label: 'күнде дайын' },
                ].map(({ val, suf, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{
                      fontFamily: "'Cormorant', Georgia, serif",
                      fontWeight: 700, lineHeight: 1, color: 'var(--tx)',
                      fontSize: 'clamp(2.4rem,3.5vw,3.2rem)',
                    }}>
                      <Counter to={val} suffix={suf} />
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--tm)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: parallax photo + particles */}
            <div className="a-img" style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                ref={heroImgRef}
                style={{ position: 'absolute', inset: 0, transform: 'scale(1.18)', transformOrigin: 'center', willChange: 'transform' }}
              >
                <img
                  src="/landing/book-open-illus.jpg"
                  alt="Кітаптың іші"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '30% center' }}
                />
              </div>
              {/* Left gradient fade into text column */}
              <div style={{
                pointerEvents: 'none', position: 'absolute', inset: '0 auto 0 0', width: '36%',
                background: 'linear-gradient(to right, var(--cr), transparent)',
              }} />
              {/* Bottom vignette */}
              <div style={{
                pointerEvents: 'none', position: 'absolute', inset: 'auto 0 0 0', height: 96,
                background: 'linear-gradient(to top, rgba(251,247,241,0.5), transparent)',
              }} />

              {/* Particles */}
              {PARTICLES.map((p, i) => (
                <div
                  key={i}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: p.s * 3,
                    height: p.s * 3,
                    borderRadius: '50%',
                    background: 'var(--g)',
                    ['--ptx' as string]: `${p.tx}px`,
                    animation: `particleFloat ${p.d}s ease-in-out ${p.e}s infinite`,
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════ TICKER STRIP */}
        <section style={{ overflow: 'hidden', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)', background: 'var(--gl)', padding: '18px 0' }}>
          <div style={{ display: 'flex' }}>
            <div className="ticker-inner" style={{ display: 'flex', flexShrink: 0, alignItems: 'center', willChange: 'transform' }}>
              {[...Array(2)].map((_, k) => (
                <span key={k} style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
                  {[
                    '100+ кітап жасалды',
                    'Бүкіл Қазақстан бойынша жеткізу',
                    '7–14 күнде дайын',
                    '40 сурет дейін',
                    'Кәсіби редакция',
                    'Авторлық верстка',
                    'Сенімен · Кітаптар',
                  ].map((t, i) => (
                    <span key={i} style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 24, padding: '0 28px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--g)' }}>
                      {t}
                      <span aria-hidden style={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', background: 'var(--w)' }} />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════ INTERIOR SHOWCASE — dark */}
        <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--dk)', padding: '96px 0' }}>
          <Grain opacity={0.05} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>

            <R className="mb-14">
              <SectionLabel>Кітаптың іші</SectionLabel>
              <h2 style={{
                fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                lineHeight: 1.1, color: '#fff', margin: '16px 0 0',
                fontSize: 'clamp(2.2rem, 4vw, 4rem)',
              }}>
                Сапасын сезіңіз
              </h2>
              <p style={{ marginTop: 20, maxWidth: 520, fontSize: 18, lineHeight: 1.75, color: 'rgba(255,255,255,0.55)' }}>
                Әрбір бет — редактордың қолымен өңделген, дизайнердің жүрегімен жасалған.
              </p>
            </R>

            {/* Asymmetric bento */}
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gridTemplateRows: '320px 240px', gap: 10 }}>

              {/* Featured large — left, spans 2 rows */}
              <R delay={0} className="img-zoom" style={{ gridRow: '1 / 3', borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
                <img src="/landing/book-open-redspread.jpg" alt="Кітап беті"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 40%' }} />
                <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }} />
              </R>

              {/* Top right */}
              <R delay={80} className="img-zoom" style={{ borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
                <img src="/landing/book-open-couple.jpg" alt="Жұп фото беті"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
                <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
              </R>

              {/* Bottom right */}
              <R delay={160} className="img-zoom" style={{ borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
                <img src="/landing/book-open-dark.jpg" alt="Иллюстрациялы бет"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%' }} />
                <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
              </R>
            </div>

            {/* Two more below */}
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { src: 'book-open-text.jpg', pos: '50% 25%', alt: 'Мәтін беті' },
                { src: 'book-open-illus.jpg', pos: '70% 50%', alt: 'Иллюстрация беті' },
              ].map(({ src, pos, alt }, i) => (
                <R key={src} delay={i * 80} className="img-zoom" style={{ borderRadius: 20, overflow: 'hidden', position: 'relative', height: 220 }}>
                  <img src={`/landing/${src}`} alt={alt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos }} />
                  <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)' }} />
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════ QUOTE SECTION */}
        <section style={{ background: 'var(--cr2)', padding: '100px 48px' }}>
          <R>
            <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
              {/* Top decorative line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 52 }}>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--g)', opacity: 0.5 }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g)', opacity: 0.7 }}>
                  Сенімен · Кітаптар
                </span>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--g)', opacity: 0.5 }} />
              </div>

              <blockquote style={{ margin: 0 }}>
                <p style={{
                  fontFamily: "'Cormorant', Georgia, serif",
                  fontStyle: 'italic', fontWeight: 500,
                  lineHeight: 1.35, color: 'var(--tx)',
                  fontSize: 'clamp(2rem, 5vw, 4.5rem)',
                  letterSpacing: '-0.01em',
                }}>
                  «Ең ғажайып хикая — екеуіңнің хикаяң»
                </p>
                <footer style={{
                  marginTop: 36, fontSize: 15, fontWeight: 600,
                  letterSpacing: '0.08em', color: 'var(--g)',
                }}>
                  — Сенімен Кітаптар
                </footer>
              </blockquote>

              {/* Bottom decorative line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 52 }}>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--g)', opacity: 0.5 }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--g)', opacity: 0.6 }} />
                <div style={{ flex: 1, height: '0.5px', background: 'var(--g)', opacity: 0.5 }} />
              </div>
            </div>
          </R>
        </section>

        {/* ════════════════════════════════════════════════ WHY — 3 cards */}
        <section id="why" style={{ background: 'var(--cr)', padding: '96px 0' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
            <SectionLabel>Не үшін?</SectionLabel>
            <R>
              <h2 style={{
                fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                lineHeight: 1.1, color: 'var(--tx)', margin: '0 0 16px',
                fontSize: 'clamp(2.2rem, 4vw, 4rem)',
              }}>
                Неліктен кітап жазу керек?
              </h2>
              <p style={{ maxWidth: 520, fontSize: 18, lineHeight: 1.75, color: 'var(--tx2)', marginBottom: 56 }}>
                Сезімдерді сөзге айналдыру — ең сирек, ең бағалы сыйлық.
              </p>
            </R>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
                  desc: 'Кейде сезімдер сөзге сыймайды. Бірақ кітап бетінде — олар мәңгі тұрады, мәңгі жылытады.',
                },
              ].map((c, i) => (
                <R key={c.n} delay={i * 100}>
                  <div className="card-lift" style={{
                    height: '100%', borderRadius: 24,
                    border: '1px solid var(--bd)', background: '#fff',
                    padding: '40px 36px',
                  }}>
                    <span style={{
                      fontFamily: "'Cormorant', Georgia, serif", fontWeight: 700,
                      lineHeight: 1, color: 'rgba(26,17,8,0.12)',
                      fontSize: 'clamp(3rem,5vw,4.5rem)', display: 'block',
                    }}>
                      {c.n}
                    </span>
                    <h3 style={{ marginTop: 24, fontSize: 21, fontWeight: 700, lineHeight: 1.3, color: 'var(--tx)' }}>
                      {c.title}
                    </h3>
                    <p style={{ marginTop: 14, fontSize: 17, lineHeight: 1.8, color: 'var(--tx2)' }}>
                      {c.desc}
                    </p>
                  </div>
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════ HOW IT WORKS */}
        <section id="how" style={{ background: '#fff', padding: '96px 0' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <SectionLabel>Процесс</SectionLabel>
              <R>
                <h2 style={{
                  fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                  lineHeight: 1.1, color: 'var(--tx)', margin: '0 0 16px',
                  fontSize: 'clamp(2.2rem, 4vw, 4rem)',
                }}>
                  Қалай жасалады?
                </h2>
                <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--tx2)' }}>
                  Төрт қадам — ғұмырлық кітап.
                </p>
              </R>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { n: '01', t: 'Менеджерге жазыңыз', d: 'WhatsApp арқылы хабарлас. Менеджер барлығын түсіндіреді және сізді жүйеге қосады.' },
                { n: '02', t: 'Сұрақтарға жауап беріңіз', d: '100+ сұраққа жауап беріп, 40 сурет дейін жүктейсіз. Ыңғайлы, өз уақытыңызда.' },
                { n: '03', t: 'Редакция және дизайн', d: 'Редакторлар мәтінді өңдейді. Дизайнерлер версткасын жасайды. Макетті бекітесіз.' },
                { n: '04', t: 'Басып шығару және жеткізу', d: '7–14 жұмыс күні ішінде дайын. Бүкіл Қазақстан бойынша жеткіземіз.' },
              ].map((s, i) => (
                <R key={s.n} delay={i * 90}>
                  <div className="card-lift" style={{
                    height: '100%', borderRadius: 24,
                    border: '1px solid var(--bd)', background: 'var(--cr)',
                    padding: '36px 28px',
                  }}>
                    <span style={{
                      fontFamily: "'Cormorant', Georgia, serif", fontWeight: 700,
                      lineHeight: 1, color: 'rgba(26,17,8,0.12)',
                      fontSize: 'clamp(3rem,5vw,4.5rem)', display: 'block',
                    }}>
                      {s.n}
                    </span>
                    <h3 style={{ marginTop: 22, fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: 'var(--tx)' }}>
                      {s.t}
                    </h3>
                    <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.8, color: 'var(--tx2)' }}>
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
          <section style={{ background: 'var(--cr)', padding: '96px 0' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
              <SectionLabel>Тегін</SectionLabel>
              <R>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 48 }}>
                  <div>
                    <h2 style={{
                      fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                      lineHeight: 1.1, color: 'var(--tx)', margin: '0 0 16px',
                      fontSize: 'clamp(2.2rem, 4vw, 4rem)',
                    }}>
                      Тегін жазып көруге болады
                    </h2>
                    <p style={{ maxWidth: 520, fontSize: 18, lineHeight: 1.75, color: 'var(--tx2)' }}>
                      Тіркелгеннен кейін төмендегі үлгілер бойынша алғашқы 6 сұрақ тегін ашылады.
                    </p>
                  </div>
                  <span style={{
                    flexShrink: 0, borderRadius: 16, border: '1.5px solid var(--wr)',
                    background: 'var(--ws)', padding: '10px 20px',
                    fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--w)',
                  }}>
                    Тегін
                  </span>
                </div>
              </R>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {trialOffers.map((offer, i) => (
                  <R key={offer.id} delay={i * 55}>
                    <a
                      href={LOGIN}
                      style={{
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        height: '100%', borderRadius: 20, border: '1px solid var(--bd)',
                        background: '#fff', padding: '24px', textDecoration: 'none',
                        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--wr)'
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 12px 36px rgba(26,17,8,0.09)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--bd)'
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, color: 'var(--tx)' }}>
                        {offer.title_kk}
                      </p>
                      {offer.description_kk && (
                        <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.65, color: 'var(--tm)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {offer.description_kk}
                        </p>
                      )}
                      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{
                          borderRadius: 10, border: '1.5px solid var(--wr)',
                          background: 'var(--ws)', padding: '5px 12px',
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: 'var(--w)',
                        }}>
                          Тегін · 6 сұрақ
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--w)' }}>Бастау →</span>
                      </div>
                    </a>
                  </R>
                ))}
              </div>

              <R delay={100}>
                <p style={{ marginTop: 32, textAlign: 'center', fontSize: 15, color: 'var(--tm)' }}>
                  Толық кітап үшін менеджерге{' '}
                  <a href={WA} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--w)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    WhatsApp арқылы
                  </a>{' '}
                  хабарласыңыз.
                </p>
              </R>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════ BOOK COLLECTION */}
        <section style={{ background: '#fff', padding: '96px 0' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
            <SectionLabel>Жасалған кітаптар</SectionLabel>
            <R>
              <h2 style={{
                fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                lineHeight: 1.1, color: 'var(--tx)', margin: '0 0 16px',
                fontSize: 'clamp(2.2rem, 4vw, 4rem)',
              }}>
                <Counter to={100} suffix="+" /> кітап жасалды
              </h2>
              <p style={{ maxWidth: 520, fontSize: 18, lineHeight: 1.75, color: 'var(--tx2)', marginBottom: 48 }}>
                Нақты адамдардың нақты хикаялары. Сізден кейінгі ұрпаққа қалатын естелік.
              </p>
            </R>

            {/* Hero pair */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <R delay={0} className="img-zoom" style={{ borderRadius: 24, overflow: 'hidden' }}>
                <img src="/landing/books-stack.jpg" alt="Кітаптар жинағы"
                  style={{ width: '100%', height: 440, objectFit: 'cover', objectPosition: '50% 60%', display: 'block' }} />
              </R>
              <R delay={100} className="img-zoom" style={{ borderRadius: 24, overflow: 'hidden' }}>
                <img src="/landing/books-fan.jpg" alt="Кітаптар желпуіші"
                  style={{ width: '100%', height: 440, objectFit: 'cover', objectPosition: '50% 50%', display: 'block' }} />
              </R>
            </div>

            {/* Secondary trio */}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { src: 'books-shelf.jpg',      pos: '50% 45%', alt: 'Кітаптар сөресі' },
                { src: 'book-cover-single.jpg', pos: '50% 35%', alt: 'Кітап мұқабасы' },
                { src: 'book-open-text.jpg',    pos: '50% 25%', alt: 'Кітаптың іші' },
              ].map(({ src, pos, alt }, i) => (
                <R key={src} delay={i * 80} className="img-zoom" style={{ borderRadius: 20, overflow: 'hidden' }}>
                  <img src={`/landing/${src}`} alt={alt}
                    style={{ width: '100%', height: 260, objectFit: 'cover', objectPosition: pos, display: 'block' }} />
                </R>
              ))}
            </div>

            {/* Tilda CDN covers */}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                'https://static.tildacdn.pro/tild3364-3739-4035-b739-326334323038/425188394.jpg',
                'https://static.tildacdn.pro/tild6334-3531-4533-a437-613162323466/425188395.jpg',
                'https://static.tildacdn.pro/tild3430-6564-4335-b332-353533353433/425188396.jpg',
                'https://static.tildacdn.pro/tild3733-3934-4463-b737-643664633634/425188397.jpg',
              ].map((src, i) => (
                <R key={src} delay={i * 55} className="img-zoom" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,17,8,0.08)' }}>
                  <img src={src} alt={`Кітап мұқабасы ${i + 1}`}
                    style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                </R>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════ PRICING */}
        <section id="products" style={{ background: 'var(--cr2)', padding: '96px 0' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
            <SectionLabel>Бағалар</SectionLabel>
            <R>
              <h2 style={{
                fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                lineHeight: 1.1, color: 'var(--tx)', margin: '0 0 56px',
                fontSize: 'clamp(2.2rem, 4vw, 4rem)',
              }}>
                Жүректен жасалған кітаптар
              </h2>
            </R>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* ── Product 1: light card ── */}
              <R delay={0}>
                <div className="card-lift" style={{
                  display: 'flex', flexDirection: 'column', height: '100%',
                  borderRadius: 28, background: '#fff', overflow: 'hidden',
                  boxShadow: '0 2px 16px rgba(26,17,8,0.06)',
                }}>
                  {/* Photo at top */}
                  <div style={{ height: 208, overflow: 'hidden', position: 'relative' }}>
                    <img src="/landing/book-open-text.jpg" alt="Кітап іші"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
                    <div style={{
                      position: 'absolute', inset: 'auto 0 0 0', height: 80,
                      background: 'linear-gradient(to top, #fff, transparent)',
                    }} />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 40px 40px' }}>
                    <span style={{
                      display: 'inline-flex', borderRadius: 12, border: '1.5px solid var(--wr)',
                      background: 'var(--ws)', padding: '7px 16px',
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--w)', width: 'fit-content',
                    }}>
                      Негізгі өнім
                    </span>

                    <h3 style={{
                      marginTop: 24, fontFamily: "'Cormorant', Georgia, serif",
                      fontWeight: 700, lineHeight: 1.2, color: 'var(--tx)',
                      fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
                    }}>
                      Махаббат хикаясы кітабы
                    </h3>

                    <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.8, color: 'var(--tx2)' }}>
                      Сіздің ғашықтық хикаяңыз — 100+ жеке сұрақ, кәсіби редакция,
                      авторлық дизайн. Мәңгіге сақталатын сыйлық.
                    </p>

                    <div style={{ marginTop: 24, display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: "'Cormorant', Georgia, serif", fontWeight: 700,
                        lineHeight: 1, color: 'var(--tx)',
                        fontSize: 'clamp(2.4rem, 4vw, 3.4rem)',
                      }}>
                        35 500 ₸
                      </span>
                      <span style={{ fontSize: 17, color: 'var(--tm)', textDecoration: 'line-through' }}>
                        44 000 ₸
                      </span>
                      <span style={{
                        borderRadius: 10, background: 'var(--gl)',
                        padding: '5px 12px', fontSize: 13, fontWeight: 700, color: 'var(--g)',
                      }}>
                        Үнемдейсіз 8 500 ₸
                      </span>
                    </div>

                    <ul style={{ marginTop: 28, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        '100+ жеке сұрақ',
                        '40 сурет дейін',
                        'Кәсіби редакция',
                        'Авторлық дизайн верстка',
                        'Дайын макетті онлайн бекіту',
                        'Бүкіл Қазақстан бойынша жеткізу',
                      ].map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 16, color: 'var(--tx2)' }}>
                          <span style={{ width: 20, height: 1.5, flexShrink: 0, background: 'var(--w)', display: 'block' }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div style={{ marginTop: 'auto', paddingTop: 36, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <a href={WA} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', borderRadius: 14,
                          background: 'var(--w)', padding: '15px 28px',
                          fontSize: 16, fontWeight: 700, color: '#fff', textDecoration: 'none',
                          transition: 'all 0.25s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--wh)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(139,18,18,0.3)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--w)'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        Тапсырыс беру
                      </a>
                      <a href={LOGIN}
                        style={{
                          display: 'inline-flex', alignItems: 'center', borderRadius: 14,
                          border: '1.5px solid var(--bd)', background: 'var(--cr)',
                          padding: '15px 28px', fontSize: 16, fontWeight: 700,
                          color: 'var(--tx2)', textDecoration: 'none', transition: 'all 0.25s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--wr)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}
                      >
                        Кіру
                      </a>
                    </div>
                  </div>
                </div>
              </R>

              {/* ── Product 2: dark card ── */}
              <R delay={120}>
                <div className="card-lift" style={{
                  display: 'flex', flexDirection: 'column', height: '100%',
                  borderRadius: 28, background: 'var(--dk)', overflow: 'hidden',
                  boxShadow: '0 8px 40px rgba(26,17,8,0.28)', position: 'relative',
                }}>
                  <Grain opacity={0.055} />
                  {/* Photo at top with dark overlay */}
                  <div style={{ height: 208, overflow: 'hidden', position: 'relative', zIndex: 2 }}>
                    <img src="/landing/books-fan.jpg" alt="Фотокітап"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%', opacity: 0.55 }} />
                    <div style={{
                      position: 'absolute', inset: 'auto 0 0 0', height: 100,
                      background: 'linear-gradient(to top, var(--dk), transparent)',
                    }} />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 40px 40px', position: 'relative', zIndex: 2 }}>
                    <span style={{
                      display: 'inline-flex', borderRadius: 12,
                      border: '1.5px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.07)', padding: '7px 16px',
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', width: 'fit-content',
                    }}>
                      Фотокітап
                    </span>

                    <h3 style={{
                      marginTop: 24, fontFamily: "'Cormorant', Georgia, serif",
                      fontWeight: 700, lineHeight: 1.2, color: '#fff',
                      fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
                    }}>
                      «Махаббат жібі»<br />фотокітабы
                    </h3>

                    <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.8, color: 'rgba(255,255,255,0.55)' }}>
                      Суреттеріңізді жіберіңіз — біз сізге атмосфералық фотокітап
                      жасаймыз. Мәтін жазудың қажеті жоқ.
                    </p>

                    <div style={{ marginTop: 24, display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: "'Cormorant', Georgia, serif", fontWeight: 700,
                        lineHeight: 1, color: '#fff',
                        fontSize: 'clamp(2.4rem, 4vw, 3.4rem)',
                      }}>
                        26 500 ₸
                      </span>
                      <span style={{ fontSize: 17, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>
                        33 000 ₸
                      </span>
                      <span style={{
                        borderRadius: 10, background: 'rgba(158,114,24,0.2)',
                        padding: '5px 12px', fontSize: 13, fontWeight: 700, color: 'var(--g)',
                      }}>
                        Үнемдейсіз 6 500 ₸
                      </span>
                    </div>

                    <ul style={{ marginTop: 28, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        '30 сапалы сурет',
                        'Сүйікті музыкаңызға QR сілтеме беті',
                        'Алғаш кездескен күнгі аспан картасы',
                        'Жүрекжарды хат беті',
                        'Мәтін жазу қажет емес',
                        '5–7 жұмыс күнінде дайын',
                      ].map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>
                          <span style={{ width: 20, height: 1.5, flexShrink: 0, background: 'rgba(255,255,255,0.25)', display: 'block' }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div style={{ marginTop: 'auto', paddingTop: 36 }}>
                      <a href={WA} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', borderRadius: 14,
                          background: '#fff', padding: '15px 28px',
                          fontSize: 16, fontWeight: 700, color: 'var(--tx)', textDecoration: 'none',
                          transition: 'all 0.25s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--ws)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,255,255,0.2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none' }}
                      >
                        Тапсырыс беру
                      </a>
                    </div>
                  </div>
                </div>
              </R>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════ FAQ — CREAM background */}
        <section id="faq" style={{ background: 'var(--cr)', padding: '96px 0' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 48px' }}>
            <SectionLabel>Сұрақтар</SectionLabel>
            <R>
              <h2 style={{
                fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                lineHeight: 1.1, color: 'var(--tx)', margin: '0 0 48px',
                fontSize: 'clamp(2.2rem, 4vw, 4rem)',
              }}>
                Жиі қойылатын сұрақтар
              </h2>
            </R>
            <R delay={60}>
              <div>
                <FAQ
                  q="Сұрақтарға жауап беру қанша уақытты алады? Барлық сұраққа жауап беру қажет пе?"
                  a="Барлық сұраққа жауап беру міндетті емес. Сізге жақын, сіздерге қатысты сұрақтарды таңдап жауап бересіз. Кем дегенде 80–100 сұраққа жауап берілуі керек."
                />
                <FAQ
                  q="Кітапты қалай жазамын?"
                  a={
                    <span>
                      Біздің нөмірге хабарлассаңыз, менеджер барлығын түсіндіреді. Төлемнен кейін{' '}
                      <a href={LOGIN} style={{ color: 'var(--w)', textDecoration: 'underline', textUnderlineOffset: 3 }}>сайтқа</a>{' '}
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

        {/* ════════════════════════════════════════════════ FINAL CTA — dark cinematic */}
        <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--dk)', padding: '128px 0' }}>
          <Grain opacity={0.05} />
          {/* Subtle bg book photo */}
          <div style={{
            pointerEvents: 'none', position: 'absolute', inset: 0,
            backgroundImage: 'url(/landing/book-open-redspread.jpg)',
            backgroundSize: 'cover', backgroundPosition: '50% 40%',
            opacity: 0.08, filter: 'saturate(0.4)',
          }} />
          {/* Radial vignette */}
          <div style={{
            pointerEvents: 'none', position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 20%, var(--dk) 80%)',
          }} />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: 800, margin: '0 auto', padding: '0 48px', textAlign: 'center' }}>
            <R>
              <p style={{
                fontFamily: "'Cormorant', Georgia, serif", fontStyle: 'italic',
                fontSize: 18, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)',
                marginBottom: 20,
              }}>
                Сенімен · Кітаптар
              </p>
              <h2 style={{
                fontFamily: "'Cormorant', Georgia, serif", fontWeight: 600,
                lineHeight: 1.06, color: '#fff', margin: '0 0 28px',
                fontSize: 'clamp(3rem, 7vw, 6.5rem)',
              }}>
                Қош келдің,<br />жазушы.
              </h2>
              <p style={{ maxWidth: 480, margin: '0 auto 48px', fontSize: 18, lineHeight: 1.8, color: 'rgba(255,255,255,0.5)' }}>
                Жақыныңызға арналған кітап жасауды бүгін бастаңыз.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>
                <a
                  href={WA} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    borderRadius: 16, background: 'var(--w)',
                    padding: '18px 36px', fontSize: 17, fontWeight: 700,
                    color: '#fff', textDecoration: 'none',
                    boxShadow: '0 8px 32px rgba(139,18,18,0.55)',
                    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--wh)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 14px 44px rgba(139,18,18,0.62)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--w)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(139,18,18,0.55)'
                  }}
                >
                  WhatsApp-қа жазу
                </a>
                <a
                  href={LOGIN}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.07)',
                    padding: '18px 36px', fontSize: 17, fontWeight: 700,
                    color: '#fff', textDecoration: 'none', backdropFilter: 'blur(8px)',
                    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  Кіру →
                </a>
              </div>
            </R>
          </div>
        </section>

        {/* ════════════════════════════════════════════════ FOOTER */}
        <footer style={{ borderTop: '1px solid var(--bd)', background: '#fff' }}>
          <div style={{
            maxWidth: 1280, margin: '0 auto', padding: '32px 48px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            justifyContent: 'space-between', gap: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/logo.svg" alt="Senimen Books" style={{ height: 24, width: 'auto' }} />
              <span style={{ fontSize: 13, color: 'var(--tm)' }}>Барлық құқықтар сақталған ©</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
              {[['#why','Не үшін?'],['#how','Қалай?'],['#products','Бағалар'],['#faq','ЖҚС'],['/privacy','Құпиялылық']].map(([h, l]) => (
                <a key={h} href={h} style={{ fontSize: 13, color: 'var(--tm)', textDecoration: 'none', transition: 'color 0.2s' }}
                   onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx2)')}
                   onMouseLeave={e => (e.currentTarget.style.color = 'var(--tm)')}
                >{l}</a>
              ))}
            </div>
          </div>
        </footer>

      </main>
    </div>
  )
}
