'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
type TrialCategory = { id: string; title_kk: string; description_kk: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────
const WA    = 'https://wa.me/77067074748'
const LOGIN = '/auth/login'

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
html { scroll-behavior: smooth; }
*, *::before, *::after { box-sizing: border-box; }

.lp {
  --ink:   #0D0D13;
  --ink2:  #60606E;
  --ink3:  #9E9EAB;
  --cream: #F5F5F3;
  --cream2:#EDEDEA;
  --white: #FFFFFF;
  --dark:  #0D0D13;
  --red:   #C03B64;
  --redb:  #A83055;
  --redf:  #FEF0F5;
  --line:  rgba(13,13,19,0.08);
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--ink);
  background: var(--cream);
}

/* ── Scroll progress bar ── */
.lp-progress {
  position: fixed; top: 0; left: 0; z-index: 300;
  height: 2px; background: var(--red);
  width: 0%; pointer-events: none;
  will-change: width;
}

/* ── Scroll reveal ── */
.sr {
  opacity: 0;
  transform: translate3d(0, 18px, 0);
  transition: opacity 0.65s cubic-bezier(0.22,1,0.36,1),
              transform 0.65s cubic-bezier(0.22,1,0.36,1);
  backface-visibility: hidden;
}
.sr.visible { opacity: 1; transform: translate3d(0,0,0); }
.sr.d1 { transition-delay: 80ms; }
.sr.d2 { transition-delay: 160ms; }
.sr.d3 { transition-delay: 240ms; }
.sr.d4 { transition-delay: 320ms; }

/* ── Image clip-path reveal (GPU-accelerated) ── */
.ir {
  clip-path: inset(0 0 100% 0);
  transition: clip-path 1.1s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: clip-path;
  transform: translateZ(0);
}
.ir.in { clip-path: inset(0 0 0% 0); }
.ir.del1 { transition-delay: 140ms; }
.ir.del2 { transition-delay: 320ms; }

/* ── Image zoom ── */
.img-c { overflow: hidden; }
.img-c img {
  transition: transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94);
  display: block; width: 100%; height: 100%; object-fit: cover;
  backface-visibility: hidden;
}
.img-c:hover img { transform: scale3d(1.04, 1.04, 1); }

/* ── Format tag entrance ── */
@keyframes tagIn {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
.lp-format-tag {
  display: inline-block;
  padding: 7px 14px;
  border: 1px solid var(--line);
  font-size: 13px;
  font-weight: 500;
  color: var(--ink2);
  background: var(--white);
  cursor: default;
  opacity: 0;
  animation: tagIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.lp-format-tag:hover {
  border-color: rgba(192,59,100,0.35);
  color: var(--red);
  background: var(--redf);
}

/* ── Marquee + keyframes ── */
@keyframes marq {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
@keyframes kenBurns {
  0%   { transform: scale3d(1.05, 1.05, 1) translate3d(0, 0, 0); }
  100% { transform: scale3d(1.11, 1.11, 1) translate3d(-10px, 5px, 0); }
}
.lp-marq-inner {
  display: flex;
  white-space: nowrap;
  animation: marq 28s linear infinite;
  will-change: transform;
  backface-visibility: hidden;
}

/* ── Nav ── */
.lp-nav {
  position: fixed; left: 0; right: 0; top: 0; z-index: 50;
  height: 60px; display: flex; align-items: center;
  justify-content: space-between; padding: 0 48px;
  transition: background 0.4s ease, border-color 0.4s ease;
  border-bottom: 1px solid transparent;
}
.lp-nav.scrolled {
  background: rgba(245,245,243,0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-color: var(--line);
}
.lp-nav-links {
  display: flex; align-items: center; gap: 32px;
}
.lp-nav-link {
  font-size: 14px; font-weight: 500; color: var(--ink2);
  text-decoration: none; letter-spacing: 0.01em;
  position: relative;
  transition: color 0.2s ease;
}
.lp-nav-link::after {
  content: '';
  position: absolute; bottom: -3px; left: 0; right: 0;
  height: 1px; background: var(--ink);
  transform: scaleX(0); transform-origin: right;
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
}
.lp-nav-link:hover { color: var(--ink); }
.lp-nav-link:hover::after { transform: scaleX(1); transform-origin: left; }
.lp-nav-cta {
  font-size: 14px; font-weight: 600; color: var(--red);
  text-decoration: none; border: 1px solid rgba(192,59,100,0.28);
  padding: 8px 20px; transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.lp-nav-cta:hover { background: var(--red); color: var(--white); border-color: var(--red); }
.lp-ham {
  display: none; flex-direction: column; justify-content: center;
  align-items: center; gap: 5px; width: 40px; height: 40px;
  background: none; border: none; cursor: pointer; padding: 0;
}
.lp-ham span {
  display: block; width: 22px; height: 1.5px; background: var(--ink);
  transition: transform 0.3s ease, opacity 0.3s ease;
  transform-origin: center;
}
.lp-ham.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
.lp-ham.open span:nth-child(2) { opacity: 0; }
.lp-ham.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

/* ── Mobile menu ── */
.lp-mobile-menu {
  position: fixed; top: 60px; left: 0; right: 0; z-index: 49;
  background: rgba(245,245,243,0.97);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  padding: 20px 24px 28px;
  display: flex; flex-direction: column; gap: 0;
}
.lp-mobile-link {
  font-size: 17px; font-weight: 500; color: var(--ink);
  text-decoration: none; padding: 14px 0;
  border-bottom: 1px solid var(--line);
  display: block;
}

/* ── Hero ── */
.lp-hero {
  display: grid;
  grid-template-columns: 55% 45%;
  min-height: 100svh;
  padding-top: 60px;
}
.lp-hero-l {
  display: flex; flex-direction: column; justify-content: center;
  padding: 80px 72px 80px 80px;
  background: var(--cream);
}
.lp-hero-r {
  overflow: hidden;
  background: var(--dark);
  position: relative;
}
.lp-hero-r img {
  width: 100%; height: 100%; object-fit: cover;
  object-position: 50% 35%;
  display: block;
  animation: kenBurns 24s ease-in-out infinite alternate;
  will-change: transform;
  backface-visibility: hidden;
}
.lp-hero-fade {
  pointer-events: none;
  position: absolute; top: 0; left: 0; bottom: 0;
  width: 18%;
  background: linear-gradient(to right, var(--cream), transparent);
}

/* ── Section shared ── */
.lp-section { padding: 120px 0; }
.lp-cont {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 48px;
}
.lp-eyebrow {
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--red);
  display: block;
  margin-bottom: 20px;
}

/* ── Showcase ── */
.lp-showcase {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 2px;
  background: var(--dark);
}
.lp-showcase-l { position: relative; }
.lp-showcase-l img {
  width: 100%; height: 70vh; min-height: 460px;
  object-fit: cover; object-position: 50% 40%;
  display: block;
}
.lp-showcase-r {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
}
.lp-showcase-r .img-c { height: 100%; }
.lp-showcase-caption {
  background: #111;
  padding: 28px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

/* ── Why ── */
.lp-why-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 80px;
  align-items: start;
}
.lp-why-item {
  display: flex;
  gap: 32px;
  padding: 40px 0;
  border-bottom: 1px solid var(--line);
}
.lp-why-item:first-child { border-top: 1px solid var(--line); }
.lp-why-num {
  font-family: 'Cormorant', Georgia, serif;
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  color: rgba(13,13,19,0.08);
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
  width: 64px;
}

/* ── Process ── */
.lp-process-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-left: 1px solid var(--line);
}
.lp-process-item {
  padding: 40px 32px;
  border-right: 1px solid var(--line);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.lp-process-num {
  font-family: 'Cormorant', Georgia, serif;
  font-size: clamp(2.2rem, 3.5vw, 3rem);
  color: rgba(13,13,19,0.08);
  font-weight: 600;
  line-height: 1;
  display: block;
  margin-bottom: 24px;
}

/* ── Gallery ── */
.lp-gallery {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  background: var(--dark);
}
.lp-gallery-cell {
  height: 40vw;
  min-height: 260px;
  max-height: 420px;
}
.lp-gallery-covers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  background: var(--dark);
}
.lp-gallery-cover {
  aspect-ratio: 3/4;
}
.lp-gallery-cover img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}

/* ── Trial cards ── */
.lp-trial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.lp-trial-card {
  background: var(--white);
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s ease;
}
.lp-trial-card:hover { background: var(--redf); }
.lp-trial-badge {
  display: inline-block;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--red);
  border: 1px solid rgba(192,59,100,0.3);
  padding: 4px 10px;
}
.lp-trial-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink2);
}
.lp-trial-row {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-top: auto; padding-top: 16px;
}

/* ── Plans ── */
.lp-plans {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  border: 1px solid var(--line);
}
.lp-plan {
  padding: 52px 48px;
  background: var(--white);
}
.lp-plan-dark {
  background: var(--ink);
}
.lp-plan-features {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column;
  border-top: 1px solid var(--line);
  margin-top: 32px; padding-top: 32px;
  gap: 14px;
}
.lp-plan-dark .lp-plan-features {
  border-color: rgba(255,255,255,0.1);
}
.lp-plan-feature {
  display: flex; align-items: flex-start; gap: 14px;
  font-size: 15px; line-height: 1.5; color: var(--ink2);
}
.lp-plan-dark .lp-plan-feature { color: rgba(255,255,255,0.5); }
.lp-plan-dash { color: var(--red); flex-shrink: 0; font-weight: 600; }
.lp-plan-dark .lp-plan-dash { color: rgba(255,255,255,0.3); }

/* ── Buttons ── */
.btn-red {
  display: inline-block;
  background: var(--red);
  color: var(--white);
  font-size: 15px; font-weight: 600;
  text-decoration: none;
  padding: 14px 28px;
  border: 1px solid var(--red);
  transition: background 0.2s ease, box-shadow 0.3s ease, transform 0.15s ease;
}
.btn-red:hover {
  background: var(--redb); border-color: var(--redb);
  box-shadow: 0 0 0 4px rgba(192,59,100,0.14), 0 6px 20px rgba(192,59,100,0.24);
  transform: translateY(-1px);
}
.btn-outline {
  display: inline-block;
  background: transparent;
  color: var(--ink);
  font-size: 15px; font-weight: 600;
  text-decoration: none;
  padding: 14px 28px;
  border: 1px solid var(--line);
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.btn-outline:hover { border-color: var(--ink2); transform: translateY(-1px); }
.btn-white {
  display: inline-block;
  background: var(--white);
  color: var(--ink);
  font-size: 15px; font-weight: 600;
  text-decoration: none;
  padding: 14px 28px;
  border: 1px solid var(--white);
  transition: background 0.2s ease, transform 0.15s ease;
}
.btn-white:hover { background: rgba(255,255,255,0.88); transform: translateY(-1px); }
.btn-outline-white {
  display: inline-block;
  background: transparent;
  color: var(--white);
  font-size: 15px; font-weight: 600;
  text-decoration: none;
  padding: 14px 28px;
  border: 1px solid rgba(255,255,255,0.3);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
}
.btn-outline-white:hover {
  border-color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.06);
  transform: translateY(-1px);
}

/* ── FAQ ── */
.lp-faq-item {
  border-bottom: 1px solid var(--line);
}
.lp-faq-btn {
  display: flex; width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px; padding: 24px 0;
  text-align: left; background: none; border: none;
  cursor: pointer;
}
.lp-faq-icon {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; flex-shrink: 0; margin-top: 2px;
  color: var(--red); font-size: 22px; line-height: 1;
  transition: transform 0.3s ease;
  font-weight: 300;
}
.lp-faq-item.open .lp-faq-icon { transform: rotate(45deg); }
.lp-faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.4s ease;
}
.lp-faq-item.open .lp-faq-answer { max-height: 500px; }
.lp-faq-answer-inner {
  padding-bottom: 28px;
  font-size: 16px; line-height: 1.8;
  color: var(--ink2);
}

/* ── Stat ── */
.lp-stats {
  display: flex; flex-wrap: wrap; gap: 40px;
  border-top: 1px solid var(--line);
  padding-top: 36px; margin-top: 40px;
}
.lp-stat-num {
  font-family: 'Cormorant', Georgia, serif;
  font-size: clamp(2.2rem, 3.5vw, 3rem);
  font-weight: 600; line-height: 1;
  color: var(--ink);
  display: block;
}
.lp-stat-label {
  font-size: 13px; color: var(--ink3);
  margin-top: 4px; display: block;
}

/* ── Footer ── */
.lp-footer {
  background: var(--cream);
  border-top: 1px solid var(--line);
  padding: 32px 48px;
}
.lp-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.lp-footer-left {
  display: flex; align-items: center; gap: 12px;
}
.lp-footer-nav {
  display: flex; flex-wrap: wrap; gap: 24px;
}
.lp-footer-link {
  font-size: 13px; color: var(--ink3);
  text-decoration: none;
  transition: color 0.2s ease;
}
.lp-footer-link:hover { color: var(--ink); }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .lp-nav { padding: 0 32px; }
  .lp-hero { grid-template-columns: 1fr; min-height: auto; }
  .lp-hero-l { padding: 60px 48px; }
  .lp-hero-r { height: 52vw; min-height: 320px; }
  .lp-showcase { grid-template-columns: 1fr; }
  .lp-showcase-r { grid-template-columns: 1fr 1fr; grid-template-rows: auto; height: 40vw; }
  .lp-showcase-r .img-c { height: 100%; }
  .lp-why-grid { grid-template-columns: 1fr; gap: 48px; }
  .lp-process-grid { grid-template-columns: repeat(2, 1fr); }
  .lp-gallery { grid-template-columns: repeat(2, 1fr); }
  .lp-gallery-covers { grid-template-columns: repeat(2, 1fr); }
  .lp-plans { grid-template-columns: 1fr; }
  .lp-plan { padding: 40px 36px; }
}
@media (max-width: 768px) {
  .lp-nav { padding: 0 20px; }
  .lp-nav-links { display: none; }
  .lp-ham { display: flex; }
  .lp-hero-l { padding: 48px 24px; }
  .lp-hero-r { height: 60vw; min-height: 240px; }
  .lp-cont { padding: 0 24px !important; }
  .lp-section { padding: 80px 0; }
  .lp-process-grid { grid-template-columns: 1fr; }
  .lp-plan { padding: 36px 24px; }
  .lp-showcase-caption { padding: 20px 24px; flex-direction: column; align-items: flex-start; }
  .lp-footer { padding: 28px 20px; }
  .lp-footer-inner { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 480px) {
  .lp-hero-l { padding: 40px 20px; }
  .lp-hero-r { height: 56vw; }
  .lp-plan { padding: 32px 20px; }
  .lp-process-item { padding: 32px 20px; }
}
`

// ─── Counter ──────────────────────────────────────────────────────────────────
function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const fired = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fired.current) return
      fired.current = true
      obs.disconnect()
      const dur = 1800
      const start = Date.now()
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

// ─── FaqItem ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`lp-faq-item${open ? ' open' : ''}`}>
      <button type="button" className="lp-faq-btn" onClick={() => setOpen(x => !x)}>
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5, flex: 1 }}>{q}</span>
        <span className="lp-faq-icon">+</span>
      </button>
      <div className="lp-faq-answer">
        <div className="lp-faq-answer-inner">{a}</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled]       = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [trialOffers, setTrialOffers] = useState<TrialCategory[]>([])
  const progressRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  // Scroll → nav state + progress bar
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 40)
      if (progressRef.current) {
        const max = document.documentElement.scrollHeight - window.innerHeight
        progressRef.current.style.width = max > 0 ? `${Math.min((y / max) * 100, 100)}%` : '0%'
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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
        (catRes.data ?? [])
          .filter((c: { is_active?: boolean }) => c.is_active !== false)
          .map((c: { id: string; title_kk: string; description_kk: string | null }) => [c.id, c])
      )
      const offers: TrialCategory[] = []
      for (const row of trialRes.data ?? []) {
        const c = byId.get((row as { category_id: string }).category_id) as { id: string; title_kk: string; description_kk: string | null } | undefined
        if (c) offers.push({ id: c.id, title_kk: c.title_kk, description_kk: c.description_kk ?? null })
      }
      if (!cancelled) setTrialOffers(offers)
    })()
    return () => { cancelled = true }
  }, [supabase])

  // Scroll reveal — reruns when trialOffers loads
  useEffect(() => {
    const els = document.querySelectorAll('.sr')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.06 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [trialOffers])

  // Image clip-path reveal
  useEffect(() => {
    const els = document.querySelectorAll('.ir')
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.12 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const navLinks: [string, string][] = [
    ['#why',      'Не үшін?'],
    ['#how',      'Қалай?'],
    ['#products', 'Бағалар'],
    ['#faq',      'Сұрақтар'],
  ]

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div ref={progressRef} className="lp-progress" aria-hidden />

      {/* ── NAV ── */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <a href="/">
          <img src="/logo.svg" alt="Senimen Books" style={{ height: 22, width: 'auto', display: 'block' }} />
        </a>

        <div className="lp-nav-links">
          {navLinks.map(([href, label]) => (
            <a key={href} href={href} className="lp-nav-link">{label}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={LOGIN} className="lp-nav-cta">Кіру</a>
          <button
            type="button"
            className={`lp-ham${menuOpen ? ' open' : ''}`}
            aria-label="Мәзір"
            onClick={() => setMenuOpen(x => !x)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div className="lp-mobile-menu">
          {navLinks.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="lp-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
          <a
            href={LOGIN}
            className="lp-mobile-link"
            style={{ borderBottom: 'none', color: 'var(--red)', fontWeight: 600 }}
            onClick={() => setMenuOpen(false)}
          >
            Кіру →
          </a>
        </div>
      )}

      <main style={{ overflowX: 'hidden' }}>

        {/* ══════════════════════════════════════════════════ 1. HERO */}
        <section className="lp-hero">
          {/* Left */}
          <div className="lp-hero-l">
            <span className="lp-eyebrow sr">Сауалнама форматындағы кітап</span>

            <h1 className="sr d1" style={{
              fontFamily: "'Cormorant', Georgia, serif",
              fontWeight: 600,
              fontSize: 'clamp(3rem, 5.2vw, 5.8rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: '0 0 24px',
            }}>
              Сіздің<br />
              хикаяңыз —<br />
              <span style={{ color: 'var(--red)' }}>кітапта.</span>
            </h1>

            {/* Format categories */}
            <div className="sr d2" style={{ marginBottom: 28 }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--ink3)',
                marginBottom: 12,
              }}>
                Форматтар
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['Ата-анаға',        '0.05s'],
                  ['Сүйіктіге',        '0.12s'],
                  ['Достарға',         '0.19s'],
                  ['Ата/Әжеге',        '0.26s'],
                  ['Аға/Қарындасқа',   '0.33s'],
                ].map(([label, delay]) => (
                  <span
                    key={label}
                    className="lp-format-tag"
                    style={{ animationDelay: delay }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <p className="sr d3" style={{
              fontSize: 'clamp(15px, 1.4vw, 18px)',
              lineHeight: 1.8,
              color: 'var(--ink2)',
              maxWidth: 400,
              margin: '0 0 32px',
            }}>
              100+ сұраққа жауап беріп, суреттеріңізді жүктейсіз.
              Редакторлар мен дизайнерлер қалғанын жасайды.
            </p>

            <div className="sr d4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="btn-red">
                WhatsApp-қа жазу
              </a>
              <a href={LOGIN} className="btn-outline">
                Кіру →
              </a>
            </div>

            <div className="lp-stats sr" style={{ transitionDelay: '400ms' }}>
              <div>
                <span className="lp-stat-num">
                  <Counter to={100} suffix="+" />
                </span>
                <span className="lp-stat-label">кітап жасалды</span>
              </div>
              <div>
                <span className="lp-stat-num">
                  <Counter to={40} />
                </span>
                <span className="lp-stat-label">сурет дейін</span>
              </div>
              <div>
                <span className="lp-stat-num">
                  <Counter to={14} />
                </span>
                <span className="lp-stat-label">күнде дайын</span>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="lp-hero-r">
            <img
              src="/landing/book-open-illus.jpg"
              alt="Кітаптың іші"
            />
            <div className="lp-hero-fade" />
          </div>
        </section>

        {/* ══════════════════════════════════════════ 2. MARQUEE STRIP */}
        <div style={{ background: 'var(--ink)', padding: '14px 0', overflow: 'hidden' }}>
          <div className="lp-marq-inner">
            {[
              '100+ кітап жасалды', 'Бүкіл Қазақстан',
              '7–14 күнде дайын', '40 сурет дейін',
              'Кәсіби редакция', 'Авторлық дизайн',
              '100+ кітап жасалды', 'Бүкіл Қазақстан',
              '7–14 күнде дайын', '40 сурет дейін',
              'Кәсіби редакция', 'Авторлық дизайн',
            ].map((item, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.4)',
                  padding: '0 32px', flexShrink: 0, display: 'inline-block',
                }}
              >
                {item}
                {i % 6 !== 5 && <span style={{ marginLeft: 32, opacity: 0.3 }}>·</span>}
              </span>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════ 3. SHOWCASE */}
        <div style={{ background: 'var(--dark)' }}>
          <div className="lp-showcase">
            {/* Left large image — clip-path reveal */}
            <div className="lp-showcase-l img-c ir">
              <img
                src="/landing/book-open-redspread.jpg"
                alt="Кітап беті"
                style={{ height: '70vh', minHeight: 460 }}
              />
            </div>
            {/* Right two images — staggered reveals */}
            <div className="lp-showcase-r">
              <div className="img-c ir del1">
                <img
                  src="/landing/book-open-couple.jpg"
                  alt="Жұп фото беті"
                  style={{ objectPosition: '50% 30%' }}
                />
              </div>
              <div className="img-c ir del2">
                <img
                  src="/landing/book-open-dark.jpg"
                  alt="Иллюстрациялы бет"
                  style={{ objectPosition: '50% 50%' }}
                />
              </div>
            </div>
          </div>

          {/* Caption row */}
          <div className="lp-showcase-caption">
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              Нақты кітаптардың ішінен
            </span>
            <span style={{
              fontFamily: "'Cormorant', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
              color: 'rgba(255,255,255,0.55)',
            }}>
              Сіздің хикаяңыз — баспа сапасында
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════ 4. WHY */}
        <section id="why" className="lp-section" style={{ background: 'var(--cream)' }}>
          <div className="lp-cont">
            <div className="lp-why-grid">
              {/* Left sticky column */}
              <div>
                <span className="lp-eyebrow sr">Не үшін?</span>
                <h2 className="sr d1" style={{
                  fontFamily: "'Cormorant', Georgia, serif",
                  fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
                  fontWeight: 600, lineHeight: 1.1,
                  color: 'var(--ink)', margin: 0,
                }}>
                  Неліктен кітап?
                </h2>
              </div>

              {/* Right: items */}
              <div>
                {[
                  {
                    n: '01',
                    title: 'Естеліктерді уақыттан сақтап қалу',
                    body: 'Өмірдің ең мағыналы сәттерін мәңгіге кітап бетіне сіңіріңіз. Жылдар өтсе де ешкім алып кете алмайды.',
                    cls: 'sr d1',
                  },
                  {
                    n: '02',
                    title: 'Жақыныңызға өзінің бағалы екенін сезіндіру',
                    body: 'Дүниедегі ең ерекше сыйлық — назар. Кітап сіздің уақытыңыздың, жүрегіңіздің айқын белгісі.',
                    cls: 'sr d2',
                  },
                  {
                    n: '03',
                    title: 'Тілмен айта алмағанды сөзбен жеткіз',
                    body: 'Кейде сезімдер сөзге сыймайды. Бірақ кітап бетінде — олар мәңгі тұрады, мәңгі жылытады.',
                    cls: 'sr d3',
                  },
                ].map(item => (
                  <div key={item.n} className={`lp-why-item ${item.cls}`}>
                    <span className="lp-why-num">{item.n}</span>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.3 }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: 16, color: 'var(--ink2)', lineHeight: 1.8, margin: 0 }}>
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════ 5. PROCESS */}
        <section id="how" className="lp-section" style={{ background: 'var(--white)' }}>
          <div className="lp-cont">
            <span className="lp-eyebrow sr">Процесс</span>
            <h2 className="sr d1" style={{
              fontFamily: "'Cormorant', Georgia, serif",
              fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
              fontWeight: 600, lineHeight: 1.1,
              color: 'var(--ink)', margin: '0 0 64px',
            }}>
              Қалай жасалады?
            </h2>

            <div className="lp-process-grid">
              {[
                {
                  n: '01',
                  t: 'Хабарласыңыз',
                  d: 'WhatsApp арқылы менеджерге жазыңыз. Барлығын түсіндіреді, жүйеге қосады.',
                  cls: 'sr d1',
                },
                {
                  n: '02',
                  t: 'Жауап беріңіз',
                  d: '100+ сұраққа жауап беріп, 40 сурет дейін жүктейсіз. Өз уақытыңызда.',
                  cls: 'sr d2',
                },
                {
                  n: '03',
                  t: 'Редакция',
                  d: 'Редакторлар мәтінді өңдейді, дизайнерлер версткасын жасайды. Макетті бекітесіз.',
                  cls: 'sr d3',
                },
                {
                  n: '04',
                  t: 'Жеткізу',
                  d: '7–14 жұмыс күні ішінде дайын. Бүкіл Қазақстан бойынша жеткіземіз.',
                  cls: 'sr d4',
                },
              ].map(step => (
                <div key={step.n} className={`lp-process-item ${step.cls}`}>
                  <span className="lp-process-num">{step.n}</span>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.3 }}>
                    {step.t}
                  </h3>
                  <p style={{ fontSize: 15, color: 'var(--ink2)', lineHeight: 1.8, margin: 0 }}>
                    {step.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════ 6. QUOTE */}
        <section className="lp-section" style={{ background: 'var(--ink)', padding: '120px 48px' }}>
          <div className="sr" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            <blockquote style={{ margin: 0 }}>
              <p style={{
                fontFamily: "'Cormorant', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 'clamp(2rem, 4.5vw, 4rem)',
                fontWeight: 500,
                color: 'var(--white)',
                lineHeight: 1.3,
                margin: 0,
              }}>
                «Ең ғажайып хикая — екеуіңнің хикаяң»
              </p>
              <footer style={{
                marginTop: 32,
                fontSize: 12, fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontVariant: 'small-caps',
                color: 'rgba(255,255,255,0.35)',
              }}>
                — Сенімен Кітаптар
              </footer>
            </blockquote>
          </div>
        </section>

        {/* ══════════════════════════════════════════ 7. GALLERY */}
        <div style={{ background: 'var(--dark)' }}>
          <div className="lp-gallery">
            {[
              { src: '/landing/books-stack.jpg',      pos: '50% 60%', alt: 'Кітаптар жинағы' },
              { src: '/landing/books-fan.jpg',         pos: '50% 50%', alt: 'Кітаптар' },
              { src: '/landing/books-shelf.jpg',       pos: '50% 45%', alt: 'Кітаптар сөресі' },
              { src: '/landing/book-cover-single.jpg', pos: '50% 35%', alt: 'Кітап мұқабасы' },
            ].map((img, i) => (
              <div
                key={img.src}
                className={`lp-gallery-cell img-c sr${i > 0 ? ` d${i}` : ''}`}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  style={{ objectPosition: img.pos }}
                />
              </div>
            ))}
          </div>

          <div className="lp-gallery-covers" style={{ marginTop: 2 }}>
            {[
              'https://static.tildacdn.pro/tild3364-3739-4035-b739-326334323038/425188394.jpg',
              'https://static.tildacdn.pro/tild6334-3531-4533-a437-613162323466/425188395.jpg',
              'https://static.tildacdn.pro/tild3430-6564-4335-b332-353533353433/425188396.jpg',
              'https://static.tildacdn.pro/tild3733-3934-4463-b737-643664633634/425188397.jpg',
            ].map((src, i) => (
              <div key={src} className={`lp-gallery-cover img-c sr${i > 0 ? ` d${i}` : ''}`}>
                <img src={src} alt={`Кітап мұқабасы ${i + 1}`} />
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════ 8. FREE TRIAL */}
        {trialOffers.length > 0 && (
          <section className="lp-section" style={{ background: 'var(--cream)' }}>
            <div className="lp-cont">
              <span className="lp-eyebrow sr">Тегін</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 52 }}>
                <div>
                  <h2 className="sr d1" style={{
                    fontFamily: "'Cormorant', Georgia, serif",
                    fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
                    fontWeight: 600, lineHeight: 1.1,
                    color: 'var(--ink)', margin: '0 0 16px',
                  }}>
                    Тегін жазып көруге болады
                  </h2>
                  <p className="sr d2" style={{ fontSize: 17, color: 'var(--ink2)', lineHeight: 1.75, maxWidth: 480 }}>
                    Тіркелгеннен кейін төмендегі тақырыптар бойынша алғашқы сұрақтар тегін ашылады.
                  </p>
                </div>
              </div>

              <div className="lp-trial-grid sr d3">
                {trialOffers.map(offer => (
                  <a key={offer.id} href={LOGIN} className="lp-trial-card">
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>
                      {offer.title_kk}
                    </p>
                    {offer.description_kk && (
                      <p className="lp-trial-desc">{offer.description_kk}</p>
                    )}
                    <div className="lp-trial-row">
                      <span className="lp-trial-badge">Тегін</span>
                      <span style={{ fontSize: 15, color: 'var(--red)', fontWeight: 600 }}>→</span>
                    </div>
                  </a>
                ))}
              </div>

              <p className="sr" style={{ marginTop: 32, fontSize: 14, color: 'var(--ink3)', textAlign: 'center' }}>
                Толық кітап үшін{' '}
                <a href={WA} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--red)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  WhatsApp арқылы
                </a>{' '}
                хабарласыңыз.
              </p>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════ 9. PRICING */}
        <section id="products" className="lp-section" style={{ background: 'var(--white)' }}>
          <div className="lp-cont">
            <span className="lp-eyebrow sr">Бағалар</span>
            <h2 className="sr d1" style={{
              fontFamily: "'Cormorant', Georgia, serif",
              fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
              fontWeight: 600, lineHeight: 1.1,
              color: 'var(--ink)', margin: '0 0 56px',
            }}>
              Жасалатын өнімдер
            </h2>

            <div className="lp-plans sr d2">
              {/* Plan 1: light */}
              <div className="lp-plan">
                <span className="lp-eyebrow" style={{ marginBottom: 16 }}>Негізгі өнім</span>
                <h3 style={{
                  fontFamily: "'Cormorant', Georgia, serif",
                  fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
                  fontWeight: 600, lineHeight: 1.2,
                  color: 'var(--ink)', margin: '0 0 20px',
                }}>
                  Махаббат хикаясы кітабы
                </h3>
                <p style={{ fontSize: 16, color: 'var(--ink2)', lineHeight: 1.75, margin: '0 0 28px' }}>
                  Сіздің ғашықтық хикаяңыз — кәсіби редакция,
                  авторлық дизайн, баспа сапасы. Мәңгіге сақталатын сыйлық.
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: "'Cormorant', Georgia, serif",
                    fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                    fontWeight: 600, color: 'var(--ink)', lineHeight: 1,
                  }}>35 500 ₸</span>
                  <span style={{ fontSize: 15, color: 'var(--ink3)', textDecoration: 'line-through' }}>44 000 ₸</span>
                  <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>Үнемдейсіз 8 500 ₸</span>
                </div>

                <ul className="lp-plan-features">
                  {['100+ жеке сұрақ', '40 сурет дейін', 'Кәсіби редакция', 'Авторлық дизайн', 'Онлайн макет бекіту', 'Бүкіл Қазақстан'].map(f => (
                    <li key={f} className="lp-plan-feature">
                      <span className="lp-plan-dash">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
                  <a href={WA} target="_blank" rel="noopener noreferrer" className="btn-red">
                    Тапсырыс беру →
                  </a>
                  <a href={LOGIN} className="btn-outline">
                    Кіру
                  </a>
                </div>
              </div>

              {/* Plan 2: dark */}
              <div className="lp-plan lp-plan-dark">
                <span style={{
                  display: 'block', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.4)', marginBottom: 16,
                }}>
                  Фотокітап
                </span>
                <h3 style={{
                  fontFamily: "'Cormorant', Georgia, serif",
                  fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
                  fontWeight: 600, lineHeight: 1.2,
                  color: 'var(--white)', margin: '0 0 20px',
                }}>
                  «Махаббат жібі» фотокітабы
                </h3>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, margin: '0 0 28px' }}>
                  Суреттеріңізді жіберіңіз — біз атмосфералық
                  фотокітап жасаймыз. Мәтін жазудың қажеті жоқ.
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: "'Cormorant', Georgia, serif",
                    fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                    fontWeight: 600, color: 'var(--white)', lineHeight: 1,
                  }}>26 500 ₸</span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>33 000 ₸</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Үнемдейсіз 6 500 ₸</span>
                </div>

                <ul className="lp-plan-features">
                  {[
                    '30 сапалы сурет',
                    'Музыкаңызға QR сілтеме',
                    'Аспан картасы беті',
                    'Жүрекжарды хат беті',
                    'Мәтін жазу қажет емес',
                    '5–7 жұмыс күнінде дайын',
                  ].map(f => (
                    <li key={f} className="lp-plan-feature">
                      <span className="lp-plan-dash">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: 36 }}>
                  <a href={WA} target="_blank" rel="noopener noreferrer" className="btn-outline-white">
                    Тапсырыс беру →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════ 10. FAQ */}
        <section id="faq" className="lp-section" style={{ background: 'var(--cream)' }}>
          <div className="lp-cont" style={{ maxWidth: 720 }}>
            <span className="lp-eyebrow sr">Сұрақтар</span>
            <h2 className="sr d1" style={{
              fontFamily: "'Cormorant', Georgia, serif",
              fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
              fontWeight: 600, lineHeight: 1.1,
              color: 'var(--ink)', margin: '0 0 56px',
            }}>
              Жиі қойылатын сұрақтар
            </h2>

            <div className="sr d2">
              <FaqItem
                q="Сұрақтарға жауап беру қанша уақытты алады?"
                a="Барлық сұраққа жауап беру міндетті емес. Сізге жақын сұрақтарды таңдап жауап бересіз. Кем дегенде 80–100 сұраққа жауап берілуі керек."
              />
              <FaqItem
                q="Кітапты қалай бастаймын?"
                a={
                  <span>
                    Менеджерге хабарласыңыз. Төлемнен кейін{' '}
                    <a href={LOGIN} style={{ color: 'var(--red)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                      сайтқа
                    </a>{' '}
                    тіркелесіз, сұрақтарға жауап беріп суреттерді жүктейсіз.
                  </span>
                }
              />
              <FaqItem
                q="Кітап қанша уақытта дайын болады?"
                a="Сұрақтарға жауап беріп болған соң 7–14 жұмыс күні ішінде дайын болады."
              />
              <FaqItem
                q="Кітапқа неше сурет?"
                a="Кітапқа 40 суретке дейін қосуға болады."
              />
              <FaqItem
                q="Қазақстанның басқа қалаларына жеткізу бар ма?"
                a="Иә, бүкіл Қазақстан бойынша жеткіземіз. Алматыда — дайын болған күні, басқа қалаларға 2–5 жұмыс күні."
              />
              <FaqItem
                q="«Махаббат жібі» фотокітабы қанша күнде?"
                a="5–7 жұмыс күні ішінде дайын болады."
              />
              <FaqItem
                q="Кітап орамасымен беріледі ме?"
                a="Иә, сыйлық орамасымен беруге болады. Менеджерге хабарласқанда айтуды ұмытпаңыз."
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════ 11. FINAL CTA */}
        <section style={{
          background: 'var(--ink)',
          padding: '140px 48px',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          {/* Faint bg photo */}
          <div style={{
            pointerEvents: 'none',
            position: 'absolute', inset: 0,
            backgroundImage: 'url(/landing/book-open-redspread.jpg)',
            backgroundSize: 'cover', backgroundPosition: '50% 40%',
            opacity: 0.06,
            filter: 'grayscale(1)',
          }} />

          <div className="sr" style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
            <span style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)', marginBottom: 24,
            }}>
              Сенімен Кітаптар
            </span>
            <h2 style={{
              fontFamily: "'Cormorant', Georgia, serif",
              fontSize: 'clamp(3rem, 6vw, 5.5rem)',
              fontWeight: 600, lineHeight: 1.05,
              color: 'var(--white)', margin: '0 0 24px',
            }}>
              Бүгін бастаңыз.
            </h2>
            <p style={{
              fontSize: 17, lineHeight: 1.8,
              color: 'rgba(255,255,255,0.45)',
              maxWidth: 440, margin: '0 auto 44px',
            }}>
              Жақыныңызға арналған кітап жасауды бүгін бастаңыз.
              Алғашқы қадам — менеджерге жазу.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="btn-white">
                WhatsApp-қа жазу
              </a>
              <a href={LOGIN} className="btn-outline-white">
                Кіру →
              </a>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════ 12. FOOTER */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-left">
              <img src="/logo.svg" alt="Senimen Books" style={{ height: 20, width: 'auto', display: 'block' }} />
              <span style={{ fontSize: 13, color: 'var(--ink3)' }}>© 2025</span>
            </div>
            <nav className="lp-footer-nav">
              {[
                ['#why',      'Не үшін?'],
                ['#how',      'Қалай?'],
                ['#products', 'Бағалар'],
                ['#faq',      'Сұрақтар'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="lp-footer-link">{label}</a>
              ))}
            </nav>
          </div>
        </footer>

      </main>
    </div>
  )
}
