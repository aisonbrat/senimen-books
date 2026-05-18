'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Review = {
  id: string
  client_name: string
  book_format: string
  review_text: string
  rating: number
  created_at: string
}

const FORMATS = [
  'Ата-анаға',
  'Сүйіктіге',
  'Достарға',
  'Ата/Әжеге',
  'Аға/Қарындасқа',
]

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .fb-root {
    min-height: 100dvh;
    background: #0d0d0f;
    font-family: var(--font-ui-sans);
    color: #fff;
  }

  /* ── Nav ── */
  .fb-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(13,13,15,0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .fb-nav-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .fb-logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  .fb-nav-link {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    transition: color 160ms;
    letter-spacing: -0.01em;
  }
  .fb-nav-link:hover { color: #fff; }

  /* ── Hero ── */
  .fb-hero-wrap {
    position: relative;
    overflow: hidden;
    padding: 72px 24px 60px;
    text-align: center;
  }
  .fb-hero-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 45% at 50% -5%, rgba(192,59,100,0.22) 0%, transparent 70%),
      radial-gradient(ellipse 35% 25% at 85% 110%, rgba(115,22,22,0.14) 0%, transparent 70%);
    pointer-events: none;
  }
  .fb-hero-inner { position: relative; max-width: 580px; margin: 0 auto; }
  .fb-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(192,59,100,0.1);
    border: 1px solid rgba(192,59,100,0.25);
    color: #f472b6;
    border-radius: 24px;
    padding: 6px 16px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  .fb-badge-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #f472b6;
    animation: fb-blink 2s ease-in-out infinite;
  }
  @keyframes fb-blink {
    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  .fb-hero-title {
    font-size: clamp(28px, 5.5vw, 42px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.035em;
    color: #fff;
    margin-bottom: 18px;
  }
  .fb-hero-title em {
    font-style: normal;
    background: linear-gradient(135deg, #f472b6 0%, #c03b64 60%, #a83055 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .fb-hero-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.45);
    line-height: 1.65;
    max-width: 460px;
    margin: 0 auto 20px;
  }
  .fb-insta-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 13px;
    color: rgba(255,255,255,0.4);
  }
  .fb-insta-tag a {
    color: #f472b6;
    font-weight: 700;
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  .fb-insta-tag a:hover { text-decoration: underline; }

  /* ── 2-col layout ── */
  .fb-content {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 24px 80px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    align-items: start;
  }

  /* ── Form card ── */
  .fb-card {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    padding: 34px 30px 30px;
  }
  .fb-card-title {
    font-size: 17px; font-weight: 700; color: #fff;
    margin-bottom: 4px; letter-spacing: -0.025em;
  }
  .fb-card-sub {
    font-size: 12px; color: rgba(255,255,255,0.35);
    margin-bottom: 28px; line-height: 1.5;
  }
  .fb-field { margin-bottom: 20px; }
  .fb-label {
    display: block; font-size: 11px; font-weight: 700;
    color: rgba(255,255,255,0.5); margin-bottom: 8px;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .fb-label span { color: #f472b6; }
  .fb-label-long {
    display: block; font-size: 13px; font-weight: 500;
    color: rgba(255,255,255,0.6); margin-bottom: 10px;
    line-height: 1.5;
  }
  .fb-label-long span { color: #f472b6; }
  .fb-input, .fb-select, .fb-textarea {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 12px 15px;
    font-size: 14px;
    font-family: var(--font-ui-sans);
    color: #fff;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  .fb-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.28)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-color: rgba(255,255,255,0.05);
    padding-right: 36px;
    cursor: pointer;
  }
  .fb-select option { background: #1a1a1f; color: #fff; }
  .fb-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
  .fb-input::placeholder, .fb-textarea::placeholder { color: rgba(255,255,255,0.22); }
  .fb-input:focus, .fb-select:focus, .fb-textarea:focus {
    border-color: rgba(192,59,100,0.55);
    box-shadow: 0 0 0 3px rgba(192,59,100,0.12);
    background: rgba(255,255,255,0.07);
  }
  .fb-input.error, .fb-select.error, .fb-textarea.error {
    border-color: rgba(239,68,68,0.55);
    box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
  }
  .fb-field-err { font-size: 11px; color: #f87171; margin-top: 5px; }

  /* ── Rating ── */
  .fb-rating-row {
    display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 10px;
  }
  .fb-rating-hint { font-size: 11px; color: rgba(255,255,255,0.28); }
  .fb-rating-val  { font-size: 13px; font-weight: 700; color: #f472b6; }
  .fb-hearts-row  { display: flex; gap: 5px; flex-wrap: wrap; }
  .fb-heart-btn {
    background: none; border: none; padding: 3px; cursor: pointer;
    border-radius: 6px; transition: transform 130ms ease;
    display: flex; align-items: center; justify-content: center;
  }
  .fb-heart-btn:hover { transform: scale(1.3) translateY(-2px); }
  .fb-heart-btn:focus-visible { outline: 2px solid #f472b6; outline-offset: 2px; }

  /* ── Submit ── */
  .fb-submit {
    width: 100%; padding: 14px 24px;
    background: linear-gradient(135deg, #c03b64 0%, #a83055 100%);
    color: #fff; border: none; border-radius: 10px;
    font-size: 14px; font-weight: 700;
    font-family: var(--font-ui-sans); cursor: pointer;
    letter-spacing: -0.01em;
    transition: opacity 160ms ease, transform 120ms ease, box-shadow 160ms ease;
    margin-top: 4px;
    box-shadow: 0 4px 20px rgba(192,59,100,0.25);
  }
  .fb-submit:hover:not(:disabled) {
    opacity: 0.88; transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(192,59,100,0.35);
  }
  .fb-submit:active:not(:disabled) { transform: translateY(0); }
  .fb-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .fb-submit-error { font-size: 12px; color: #f87171; text-align: center; margin-top: 10px; }

  /* ── Side panel ── */
  .fb-side { display: flex; flex-direction: column; gap: 16px; }
  .fb-side-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px; padding: 24px;
  }
  .fb-side-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: rgba(255,255,255,0.28);
    margin-bottom: 12px;
  }
  .fb-side-h {
    font-size: 15px; font-weight: 700; color: #fff;
    margin-bottom: 8px; letter-spacing: -0.02em;
  }
  .fb-side-p {
    font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.65;
  }
  .fb-side-p strong { color: rgba(255,255,255,0.7); font-weight: 600; }

  .fb-steps { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .fb-step {
    display: flex; align-items: flex-start; gap: 12px;
    font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.55;
  }
  .fb-step-num {
    flex-shrink: 0; width: 22px; height: 22px;
    background: rgba(192,59,100,0.12);
    border: 1px solid rgba(192,59,100,0.22);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #f472b6;
  }
  .fb-step em { font-style: normal; color: rgba(255,255,255,0.72); font-weight: 600; }

  .fb-insta-link {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-top: 14px;
    padding: 12px 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    text-decoration: none;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .fb-insta-link:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); }
  .fb-insta-link-text { font-size: 13px; font-weight: 700; color: #fff; }
  .fb-insta-link-sub  { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 1px; }
  .fb-insta-arrow     { font-size: 14px; color: rgba(255,255,255,0.3); flex-shrink: 0; }

  .fb-btn-outline {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 11px 18px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 10px; font-size: 13px; font-weight: 600;
    color: rgba(255,255,255,0.65); font-family: var(--font-ui-sans);
    text-decoration: none; cursor: pointer; margin-top: 12px;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }
  .fb-btn-outline:hover {
    background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); color: #fff;
  }

  /* ── Success ── */
  .fb-success {
    text-align: center; padding: 16px 0 8px;
    animation: fb-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  @keyframes fb-pop {
    from { opacity: 0; transform: scale(0.86) translateY(16px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .fb-success-mark {
    width: 64px; height: 64px; margin: 0 auto 20px;
    border-radius: 50%;
    background: rgba(192,59,100,0.12);
    border: 1.5px solid rgba(192,59,100,0.25);
    display: flex; align-items: center; justify-content: center;
  }
  .fb-success-title {
    font-size: 21px; font-weight: 800; color: #fff;
    margin-bottom: 8px; letter-spacing: -0.03em;
  }
  .fb-success-body {
    font-size: 13px; color: rgba(255,255,255,0.42);
    line-height: 1.65; max-width: 280px; margin: 0 auto 22px;
  }
  .fb-success-insta {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px; padding: 18px;
    margin-bottom: 18px; text-align: left;
  }
  .fb-success-insta-title {
    font-size: 12px; font-weight: 700;
    color: rgba(255,255,255,0.6); margin-bottom: 8px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .fb-success-insta-text {
    font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.65;
  }
  .fb-success-insta-text em {
    font-style: normal; color: #f472b6; font-weight: 600;
  }
  .fb-success-btn-insta {
    display: flex; align-items: center; justify-content: center;
    width: 100%; padding: 13px 20px;
    background: rgba(255,255,255,0.07);
    border: 1.5px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    font-size: 13px; font-weight: 700;
    font-family: var(--font-ui-sans); color: #fff;
    text-decoration: none; cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease;
    margin-bottom: 10px;
  }
  .fb-success-btn-insta:hover { background: rgba(255,255,255,0.11); border-color: rgba(255,255,255,0.2); }
  .fb-success-btn-books {
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 2px;
    width: 100%; padding: 13px 20px;
    background: linear-gradient(135deg, rgba(192,59,100,0.2) 0%, rgba(115,22,22,0.2) 100%);
    border: 1.5px solid rgba(192,59,100,0.25);
    border-radius: 10px;
    font-family: var(--font-ui-sans); color: #fff;
    text-decoration: none; cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .fb-success-btn-books:hover { background: linear-gradient(135deg, rgba(192,59,100,0.3) 0%, rgba(115,22,22,0.3) 100%); border-color: rgba(192,59,100,0.4); }
  .fb-success-btn-books-main { font-size: 13px; font-weight: 700; }
  .fb-success-btn-books-sub  { font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 500; }

  /* ── Reviews section ── */
  .fb-section-head {
    max-width: 900px; margin: 48px auto 22px;
    padding: 0 24px;
    display: flex; align-items: center; gap: 14px;
  }
  .fb-section-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
  .fb-section-title {
    font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.28);
    letter-spacing: 0.09em; text-transform: uppercase; white-space: nowrap;
  }
  .fb-section-count {
    background: rgba(192,59,100,0.12); color: #f472b6;
    border: 1px solid rgba(192,59,100,0.2);
    border-radius: 10px; padding: 2px 8px;
    font-size: 11px; font-weight: 700;
  }

  /* ── Review cards ── */
  .fb-reviews-grid {
    max-width: 900px; margin: 0 auto;
    padding: 0 24px 80px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }
  .fb-review-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 18px;
    transition: background 200ms ease, border-color 200ms ease, transform 200ms ease;
    position: relative; overflow: hidden;
  }
  .fb-review-card::after {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
    background: linear-gradient(90deg, transparent, rgba(192,59,100,0.35), transparent);
    opacity: 0; transition: opacity 200ms ease;
  }
  .fb-review-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.11); transform: translateY(-2px); }
  .fb-review-card:hover::after { opacity: 1; }
  .fb-review-top {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 10px; margin-bottom: 10px;
  }
  .fb-review-author { font-weight: 700; font-size: 14px; color: #fff; }
  .fb-review-format {
    display: inline-block; padding: 2px 8px;
    background: rgba(192,59,100,0.1); color: #f472b6;
    border: 1px solid rgba(192,59,100,0.18);
    border-radius: 10px; font-size: 11px; font-weight: 600;
    white-space: nowrap; flex-shrink: 0;
  }
  .fb-review-hearts { display: flex; gap: 3px; margin-bottom: 10px; flex-wrap: wrap; }
  .fb-review-text {
    font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.65;
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }
  .fb-review-date {
    margin-top: 12px; font-size: 11px; color: rgba(255,255,255,0.18);
    padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);
  }

  /* ── Footer ── */
  .fb-footer {
    text-align: center; font-size: 12px;
    color: rgba(255,255,255,0.18); padding: 24px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  /* ── Responsive ── */
  @media (max-width: 680px) {
    .fb-content { grid-template-columns: 1fr; padding: 0 16px 60px; }
    .fb-side { display: none; }
    .fb-hero-wrap { padding: 48px 20px 40px; }
    .fb-card { padding: 24px 20px 20px; }
    .fb-reviews-grid { padding: 0 16px 60px; }
    .fb-section-head { padding: 0 16px; }
  }
  @media (min-width: 681px) and (max-width: 860px) {
    .fb-content { grid-template-columns: 1.1fr 0.9fr; }
  }
`

/* ── Heart SVG for rating ── */
function HeartIcon({ filled, size = 26 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? '#c03b64' : 'none'}
      stroke={filled ? 'none' : 'rgba(255,255,255,0.15)'}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block' }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function HeartSm({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24"
      fill={filled ? '#c03b64' : 'none'}
      stroke={filled ? 'none' : 'rgba(255,255,255,0.14)'}
      strokeWidth="1.5" style={{ display: 'block' }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

/* ── Checkmark for success ── */
function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

/* ── Rating picker (5 hearts, centered) ── */
function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value
  return (
    <div>
      <div className="fb-rating-row">
        <span className="fb-rating-hint">1 — нашар &nbsp;·&nbsp; 5 — өте жақсы</span>
        {value > 0 && <span className="fb-rating-val">{value} / 5</span>}
      </div>
      <div className="fb-hearts-row" style={{ justifyContent: 'center' }} role="group" aria-label="Баға беру">
        {Array.from({ length: 5 }).map((_, i) => {
          const n = i + 1
          return (
            <button key={n} type="button" className="fb-heart-btn"
              aria-label={`${n} баға`} aria-pressed={value === n}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}>
              <HeartIcon filled={n <= active} size={36} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('kk-KZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type FormErrors = {
  client_name?: string
  book_format?: string
  review_text?: string
  rating?: string
}

export default function FeedbackPage() {
  const [name, setName]     = useState('')
  const [format, setFormat] = useState('')
  const [text, setText]     = useState('')
  const [rating, setRating] = useState(0)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted]     = useState(false)

  const [reviews, setReviews]               = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('product_reviews')
      .select('id, client_name, book_format, review_text, rating, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setReviews(data ?? []); setLoadingReviews(false) })
  }, [])

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!name.trim()) e.client_name = 'Атыңызды жазыңыз'
    if (!format.trim()) e.book_format = 'Кітап түрін жазыңыз'
    if (!text.trim()) e.review_text = 'Пікіріңізді жазыңыз'
    else if (text.trim().length < 10) e.review_text = 'Пікір тым қысқа (кем дегенде 10 таңба)'
    if (rating === 0) e.rating = 'Баға беріңіз'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    setSubmitError(null)
    const supabase = createClient()
    const { error } = await supabase.from('product_reviews').insert({
      client_name: name.trim(),
      book_format: format,
      review_text: text.trim(),
      rating,
    })
    setSubmitting(false)
    if (error) { setSubmitError('Жіберу кезінде қате орын алды. Қайталап көріңіз.'); return }
    setSubmitted(true)
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="fb-root">

        {/* Nav */}
        <nav className="fb-nav">
          <div className="fb-nav-inner">
            <a href="/landing" className="fb-logo-link">
              <img
                src="/logo.svg"
                alt="Senimen Books"
                style={{
                  height: 26,
                  width: 'auto',
                  display: 'block',
                  filter: 'brightness(0) invert(1)',
                }}
              />
            </a>
            <a href="/landing" className="fb-nav-link">← Басты бет</a>
          </div>
        </nav>

        {/* Hero */}
        <div className="fb-hero-wrap">
          <div className="fb-hero-glow" />
          <div className="fb-hero-inner">
            <div className="fb-badge">
              <span className="fb-badge-dot" />
              Жеңілдік аламыз
            </div>
            <h1 className="fb-hero-title">
              Пікіріңізді жазып,<br />
              <em>15% жеңілдік алыңыз</em>
            </h1>
            <p className="fb-hero-sub">
              Кітабыңыз жайлы ойыңызбен бөлісіңіз — Instagram сторисіңізде тэгтеңіз.
              Скриншотты директке жіберіңіз, жеңілдігіңіз дайын.
            </p>
            <div className="fb-insta-tag">
              Instagram:&nbsp;
              <a href="https://www.instagram.com/senimen.books/" target="_blank" rel="noopener noreferrer">
                @senimen.books
              </a>
            </div>
          </div>
        </div>

        {/* 2-col content */}
        <div className="fb-content">

          {/* Form */}
          <div className="fb-card">
            {submitted ? (
              <div className="fb-success">
                <div className="fb-success-mark">
                  <CheckIcon />
                </div>
                <div className="fb-success-title">Рақмет сізге!</div>
                <div className="fb-success-body">
                  Пікіріңіз қабылданды. 15% жеңілдік алу үшін Instagram сторисіңізде тэгтеңіз.
                </div>
                <div className="fb-success-insta">
                  <div className="fb-success-insta-title">Келесі қадам</div>
                  <div className="fb-success-insta-text">
                    Instagram сторисіңізде кітабыңыздың фотосын жариялап,{' '}
                    <em>@senimen.books</em> тэгін қойыңыз.
                    Скриншотты директке жіберіңіз — жеңілдігіңіз расталады.
                  </div>
                </div>
                <a
                  href="https://www.instagram.com/senimen.books/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fb-success-btn-insta"
                >
                  @senimen.books — Instagram ашу
                </a>
                <a
                  href="http://app.senimenbooks.com/dashboard"
                  className="fb-success-btn-books"
                >
                  <span className="fb-success-btn-books-main">Басқа кітап түрлерін</span>
                  <span className="fb-success-btn-books-sub">тегін жазу</span>
                </a>
              </div>
            ) : (
              <>
                <div className="fb-card-title">Пікір қалдырыңыз</div>
                <div className="fb-card-sub">Барлық өрістерді толтырыңыз</div>
                <form onSubmit={handleSubmit} noValidate>

                  {/* Name */}
                  <div className="fb-field">
                    <label className="fb-label" htmlFor="fb-name">
                      Атыңыз <span>*</span>
                    </label>
                    <input
                      id="fb-name"
                      className={`fb-input${errors.client_name ? ' error' : ''}`}
                      type="text" placeholder="Аты-жөніңіз"
                      value={name} maxLength={80} autoComplete="name"
                      onChange={e => {
                        setName(e.target.value)
                        if (errors.client_name) setErrors(p => ({ ...p, client_name: undefined }))
                      }}
                    />
                    {errors.client_name && <div className="fb-field-err">{errors.client_name}</div>}
                  </div>

                  {/* Format */}
                  <div className="fb-field">
                    <label className="fb-label-long" htmlFor="fb-format">
                      Қандай кітап түріне тапсырыс бердіңіз немесе қандай кітап түрін сыйға алдыңыз? <span>*</span>
                    </label>
                    <input
                      id="fb-format"
                      className={`fb-input${errors.book_format ? ' error' : ''}`}
                      type="text"
                      placeholder="Мысалы: Ата-анаға, Сүйіктіге…"
                      value={format}
                      maxLength={80}
                      onChange={e => {
                        setFormat(e.target.value)
                        if (errors.book_format) setErrors(p => ({ ...p, book_format: undefined }))
                      }}
                    />
                    {errors.book_format && <div className="fb-field-err">{errors.book_format}</div>}
                  </div>

                  {/* Rating */}
                  <div className="fb-field">
                    <label className="fb-label">Кітапқа баға <span>*</span></label>
                    <RatingPicker
                      value={rating}
                      onChange={v => {
                        setRating(v)
                        if (errors.rating) setErrors(p => ({ ...p, rating: undefined }))
                      }}
                    />
                    {errors.rating && <div className="fb-field-err" style={{ marginTop: 8 }}>{errors.rating}</div>}
                  </div>

                  {/* Review text */}
                  <div className="fb-field">
                    <label className="fb-label" htmlFor="fb-text">
                      Пікіріңіз <span>*</span>
                    </label>
                    <textarea
                      id="fb-text"
                      className={`fb-textarea${errors.review_text ? ' error' : ''}`}
                      placeholder="Кітап туралы ойларыңызбен бөлісіңіз…"
                      value={text} maxLength={1200}
                      onChange={e => {
                        setText(e.target.value)
                        if (errors.review_text) setErrors(p => ({ ...p, review_text: undefined }))
                      }}
                    />
                    {errors.review_text && <div className="fb-field-err">{errors.review_text}</div>}
                  </div>

                  <button type="submit" className="fb-submit" disabled={submitting}>
                    {submitting ? 'Жіберілуде…' : 'Жіберу'}
                  </button>
                  {submitError && <div className="fb-submit-error">{submitError}</div>}
                </form>
              </>
            )}
          </div>

          {/* Side panel */}
          <div className="fb-side">
            <div className="fb-side-card">
              <div className="fb-side-label">15% жеңілдік</div>
              <div className="fb-side-h">Қалай жұмыс істейді?</div>
              <ul className="fb-steps">
                <li className="fb-step">
                  <span className="fb-step-num">1</span>
                  <span>Пікір формасын толтырыңыз</span>
                </li>
                <li className="fb-step">
                  <span className="fb-step-num">2</span>
                  <span>Instagram сторисіңізде кітаптың фотосын жариялаңыз</span>
                </li>
                <li className="fb-step">
                  <span className="fb-step-num">3</span>
                  <span><em>@senimen.books</em> тэгін қойыңыз</span>
                </li>
                <li className="fb-step">
                  <span className="fb-step-num">4</span>
                  <span>Скриншотты директке жіберіңіз — <em>жеңілдігіңіз расталады</em></span>
                </li>
              </ul>
            </div>

            <div className="fb-side-card">
              <div className="fb-side-label">Біздің Instagram</div>
              <div className="fb-side-h">Жаңа кітаптар мен ерекше ұсыныстар</div>
              <div className="fb-side-p" style={{ marginBottom: 0 }}>
                Барлық жаңалықтар, клиенттер пікірлері — парақшамызда.
              </div>
              <a
                href="https://www.instagram.com/senimen.books/"
                target="_blank"
                rel="noopener noreferrer"
                className="fb-insta-link"
              >
                <div>
                  <div className="fb-insta-link-text">@senimen.books</div>
                  <div className="fb-insta-link-sub">Instagram-да қарау</div>
                </div>
                <span className="fb-insta-arrow">→</span>
              </a>
            </div>

            <div className="fb-side-card" style={{ borderColor: 'rgba(192,59,100,0.15)' }}>
              <div className="fb-side-label">Жаңа кітап</div>
              <div className="fb-side-h">Басқа кітап түрлерін тегін жазу</div>
              <div className="fb-side-p" style={{ marginBottom: 0 }}>
                <strong>Ата-анаға · Сүйіктіге · Достарға</strong> — барлық форматтар қол жетімді.
              </div>
              <a
                href="http://app.senimenbooks.com/dashboard"
                className="fb-btn-outline"
              >
                Тегін бастау →
              </a>
            </div>
          </div>
        </div>

        {/* Published reviews */}
        {!loadingReviews && reviews.length > 0 && (
          <>
            <div className="fb-section-head">
              <div className="fb-section-line" />
              <span className="fb-section-title">Пікірлер</span>
              <span className="fb-section-count">{reviews.length}</span>
              <div className="fb-section-line" />
            </div>
            <div className="fb-reviews-grid">
              {reviews.map(r => (
                <div key={r.id} className="fb-review-card">
                  <div className="fb-review-top">
                    <div className="fb-review-author">{r.client_name}</div>
                    <div className="fb-review-format">{r.book_format}</div>
                  </div>
                  <div className="fb-review-hearts">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <HeartSm key={i} filled={i < r.rating} />
                    ))}
                  </div>
                  <p className="fb-review-text">{r.review_text}</p>
                  <div className="fb-review-date">{formatDate(r.created_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <footer className="fb-footer">
          © 2025 Senimen Books · Барлық құқықтар қорғалған
        </footer>
      </div>
    </>
  )
}
