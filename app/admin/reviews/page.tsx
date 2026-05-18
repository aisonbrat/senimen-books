'use client'

import { useEffect, useTransition, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveReview, rejectReview, unrejectReview, deleteReview } from './actions'

type Review = {
  id: string
  client_name: string
  book_format: string
  review_text: string
  rating: number
  is_published: boolean
  is_rejected?: boolean | null
  created_at: string
  published_at?: string | null
}

const STYLES = `
  .rev-page {
    padding: 32px 24px;
    max-width: 1160px;
    margin: 0 auto;
    font-family: var(--font-ui-sans);
  }
  .rev-head {
    margin-bottom: 28px;
  }
  .rev-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  .rev-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 5px;
  }
  .rev-tab-row {
    display: flex;
    gap: 6px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .rev-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1.5px solid var(--border-strong);
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-ui-sans);
    transition: all 160ms ease;
  }
  .rev-tab:hover { border-color: var(--text-primary); color: var(--text-primary); }
  .rev-tab.active { background: var(--text-primary); color: #fff; border-color: var(--text-primary); }
  .rev-tab.active-red { background: #dc2626; color: #fff; border-color: #dc2626; }
  .rev-chip {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 9px; font-size: 10px; font-weight: 700;
    background: rgba(255,255,255,0.25); color: inherit;
  }
  .rev-tab:not(.active):not(.active-red) .rev-chip {
    background: var(--surface-subtle); color: var(--text-muted);
  }
  .rev-table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .rev-table { width: 100%; border-collapse: collapse; }
  .rev-table th {
    text-align: left; padding: 11px 14px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--text-muted);
    background: var(--surface-subtle); border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .rev-table td {
    padding: 13px 14px; font-size: 13px;
    color: var(--text-primary); border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .rev-table tr:last-child td { border-bottom: none; }
  .rev-table tr:hover td { background: #fafaf9; }
  .rev-name { font-weight: 600; font-size: 13px; white-space: nowrap; }
  .rev-format {
    display: inline-block; padding: 2px 8px;
    background: var(--accent-surface); color: var(--accent);
    border-radius: 10px; font-size: 11px; font-weight: 600; white-space: nowrap;
  }
  .rev-text {
    color: var(--text-secondary); line-height: 1.55;
    max-width: 320px; min-width: 100px; font-size: 12px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rev-rating {
    display: flex; align-items: center; gap: 5px; white-space: nowrap;
  }
  .rev-hearts { display: flex; gap: 2px; }
  .rev-rating-num { font-size: 14px; font-weight: 700; }
  .rev-date { color: var(--text-muted); font-size: 11px; white-space: nowrap; line-height: 1.5; }
  .rev-date-sub { color: var(--text-muted); font-size: 10px; }
  .rev-status {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 10px;
    font-size: 11px; font-weight: 600; white-space: nowrap;
  }
  .rev-status.published { background: #ecfdf5; color: #15803d; }
  .rev-status.pending   { background: #fef9ec; color: #a16207; }
  .rev-status.rejected  { background: #fff5f5; color: #dc2626; }
  .rev-actions { display: flex; gap: 5px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
  .rev-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 5px 10px; border-radius: 6px;
    font-size: 11px; font-weight: 600; cursor: pointer;
    border: 1.5px solid transparent;
    font-family: var(--font-ui-sans);
    transition: all 140ms ease; white-space: nowrap;
  }
  .rev-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .rev-btn-approve { background:#ecfdf5; color:#15803d; border-color:#bbf7d0; }
  .rev-btn-approve:hover:not(:disabled) { background:#dcfce7; border-color:#86efac; }
  .rev-btn-reject  { background:#fef9ec; color:#a16207; border-color:#fde68a; }
  .rev-btn-reject:hover:not(:disabled)  { background:#fef3c7; border-color:#fcd34d; }
  .rev-btn-unreject{ background:#f0f9ff; color:#0369a1; border-color:#bae6fd; }
  .rev-btn-unreject:hover:not(:disabled){ background:#e0f2fe; border-color:#7dd3fc; }
  .rev-btn-delete  { background:#fff5f5; color:#dc2626; border-color:#fecaca; }
  .rev-btn-delete:hover:not(:disabled)  { background:#fee2e2; border-color:#fca5a5; }
  .rev-empty { text-align: center; padding: 56px 24px; color: var(--text-muted); font-size: 14px; }
  .rev-empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.3; }
  .rev-error {
    background:#fff5f5; border:1px solid #fecaca;
    border-radius: var(--radius-sm); padding:12px 16px;
    color:#dc2626; font-size:13px; margin-bottom:20px;
  }
  .rev-col-hide { display: table-cell; }
  @media (max-width: 900px) {
    .rev-col-hide { display: none; }
    .rev-page { padding: 20px 16px; }
  }
`

function HeartIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? '#dc2626' : 'none'}
      stroke={filled ? '#dc2626' : '#d1d5db'}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

type Tab = 'all' | 'pending' | 'published' | 'rejected'

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('product_reviews')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) setError(err.message)
    else setReviews(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  function act(fn: () => Promise<void>) {
    setActionError(null)
    startTransition(async () => {
      try { await fn(); await fetchReviews() }
      catch (e) { setActionError(e instanceof Error ? e.message : 'Қате орын алды') }
    })
  }

  const pending   = reviews.filter(r => !r.is_published && !r.is_rejected)
  const published = reviews.filter(r => r.is_published)
  const rejected  = reviews.filter(r => !!r.is_rejected)

  const filtered =
    tab === 'published' ? published :
    tab === 'pending'   ? pending :
    tab === 'rejected'  ? rejected : reviews

  return (
    <>
      <style>{STYLES}</style>
      <div className="rev-page">
        <div className="rev-head">
          <div className="rev-title">Пікірлер</div>
          <div className="rev-subtitle">
            Барлығы: {reviews.length} · Жарияланған: {published.length} · Күтуде: {pending.length} · Қабылданбаған: {rejected.length}
          </div>
        </div>

        {actionError && <div className="rev-error">⚠ {actionError}</div>}
        {error && <div className="rev-error">Жүктеу қатесі: {error}</div>}

        <div className="rev-tab-row">
          {([
            ['all',       'Барлығы',       reviews.length,   false],
            ['pending',   'Күтуде',         pending.length,   false],
            ['published', 'Жарияланған',   published.length, false],
            ['rejected',  'Қабылданбаған', rejected.length,  true ],
          ] as const).map(([key, label, count, isRed]) => (
            <button
              key={key}
              className={`rev-tab${tab === key ? (isRed ? ' active-red' : ' active') : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
              <span className="rev-chip">{count}</span>
            </button>
          ))}
        </div>

        <div className="rev-table-wrap">
          {loading ? (
            <div className="rev-empty"><div className="rev-empty-icon">◌</div><div>Жүктелуде…</div></div>
          ) : filtered.length === 0 ? (
            <div className="rev-empty"><div className="rev-empty-icon">◎</div><div>Пікір жоқ</div></div>
          ) : (
            <table className="rev-table">
              <thead>
                <tr>
                  <th>Аты</th>
                  <th>Формат</th>
                  <th className="rev-col-hide">Пікір</th>
                  <th>Баға</th>
                  <th>Күй</th>
                  <th>Жазылды</th>
                  <th style={{ textAlign: 'right' }}>Әрекет</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const { date: cDate, time: cTime } = formatDateTime(r.created_at)
                  return (
                    <tr key={r.id}>
                      <td><div className="rev-name">{r.client_name}</div></td>
                      <td><span className="rev-format">{r.book_format}</span></td>
                      <td className="rev-col-hide"><div className="rev-text">{r.review_text}</div></td>
                      <td>
                        <div className="rev-rating">
                          <div className="rev-hearts">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <HeartIcon key={i} filled={i < r.rating} size={12} />
                            ))}
                          </div>
                          <span className="rev-rating-num">{r.rating}/5</span>
                        </div>
                      </td>
                      <td>
                        <span className={`rev-status ${r.is_published ? 'published' : r.is_rejected ? 'rejected' : 'pending'}`}>
                          {r.is_published ? '● Жарияланған' : r.is_rejected ? '✕ Қабылданбаған' : '○ Күтуде'}
                        </span>

                      </td>
                      <td>
                        <div className="rev-date">{cDate}</div>
                        <div className="rev-date-sub">{cTime}</div>
                      </td>
                      <td>
                        <div className="rev-actions">
                          {!r.is_published && !r.is_rejected && (
                            <>
                              <button className="rev-btn rev-btn-approve" disabled={isPending} onClick={() => act(() => approveReview(r.id))}>✓ Бекіту</button>
                              <button className="rev-btn rev-btn-reject"  disabled={isPending} onClick={() => act(() => rejectReview(r.id))}>✕ Бас тарту</button>
                            </>
                          )}
                          {r.is_published && !r.is_rejected && (
                            <button className="rev-btn rev-btn-reject" disabled={isPending} onClick={() => act(() => rejectReview(r.id))}>Алып тастау</button>
                          )}
                          {!!r.is_rejected && (
                            <button className="rev-btn rev-btn-unreject" disabled={isPending} onClick={() => act(() => unrejectReview(r.id))}>↩ Қайтару</button>
                          )}
                          <button className="rev-btn rev-btn-delete" disabled={isPending} onClick={() => act(() => deleteReview(r.id))}>Жою</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
