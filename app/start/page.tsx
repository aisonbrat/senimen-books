'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'

const TRIAL_WHATSAPP_HREF = 'https://wa.me/+77067074748'

type TrialOfferUi = {
  id: string
  title_kk: string
  description_kk: string | null
}

export default function TrialStartLandingPage() {
  const [offers, setOffers] = useState<TrialOfferUi[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/public/trial-offers')
        const body = (await res.json()) as { ok?: boolean; offers?: TrialOfferUi[]; error?: string }
        if (cancelled) return
        if (!res.ok) { setLoadErr(body.error ?? 'Жүктеу қатесі'); setOffers([]); return }
        setOffers(Array.isArray(body.offers) ? body.offers : [])
      } catch {
        if (!cancelled) { setLoadErr('Желі қатесі'); setOffers([]) }
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-[family-name:var(--font-ui-sans)] text-[color:var(--text-primary)]">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/start" aria-label="Басы">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Сени мен Books" className="h-8 w-auto" />
          </Link>
          <nav className="flex shrink-0 items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[#F3F4F6] hover:text-[color:var(--text-primary)]"
            >
              Кіру
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(115,22,22,0.25)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(115,22,22,0.3)] active:scale-[0.98]"
            >
              Тіркелу
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Main grid ───────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8 md:pt-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">

          {/* Hero — 8 cols */}
          <section className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.06)] md:col-span-8 sm:p-10">
            {/* Subtle accent tint strip */}
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-[color:var(--accent)]" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--accent)]">
              Senimen Books · Персоналды кітап
            </span>
            <h1 className="mt-5 font-serif-display text-[1.75rem] font-semibold leading-[1.18] tracking-tight text-[color:var(--text-primary)] sm:text-[2.1rem] md:text-[2.3rem]">
              Жақыныңызға сыйлайтын<br className="hidden sm:block" /> ең құнды сыйлық
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.65] text-[color:var(--text-secondary)]">
              Сенімен Books платформасында авторлық сұрақтарға жауап беріп, суреттер мен өлең жолдарыңызды қосып, кітаптың алдын ала қарауын нақты уақытта көре аласыз.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(115,22,22,0.28)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(115,22,22,0.35)] active:scale-[0.98]"
              >
                Бастау — тіркелу →
              </Link>
              <a
                href="#trial-templates"
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-strong)] bg-white px-6 py-3 text-[14px] font-semibold text-[color:var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[#F9FAFB]"
              >
                Тегін үлгілерді көру
              </a>
            </div>
          </section>

          {/* Side stack — 4 cols */}
          <div className="flex flex-col gap-4 md:col-span-4">
            <div className="flex flex-1 flex-col justify-between rounded-3xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.06)]">
              <div>
                <span className="inline-flex rounded-lg bg-[color:var(--accent)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Тегін қолдану
                </span>
                <p className="mt-4 text-[20px] font-semibold tabular-nums tracking-tight text-[color:var(--text-primary)]">
                  {TRIAL_FREE_QUESTION_COUNT} сұрақ — тегін
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                  Платформаның барлық артықшылықтарын тегін байқап көр.
                </p>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.06)]">
              <div className="mb-2 inline-flex rounded-lg border border-[color:var(--border)] bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-secondary)]">
                Дизайн
              </div>
              <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">Кітапты толықтай сіз жасайсыз</p>
              <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
                Мәтін, өлеңдер, суреттер, ЖИ қолданбалар және алдын ала қарау — барлығы бір жерде.
              </p>
            </div>
          </div>

          {/* 3 steps */}
          {[
            {
              step: 1,
              title: 'Тіркелу',
              body: 'Телефон арқылы тіркелесіз. Бір аккаунт арқылы бірнеше адамға арнап кітап жаза аласыз.',
            },
            {
              step: 2,
              title: 'Тегін үлгіні таңдау',
              body: 'Қалаған кітап түрін тегін қолдана аласыз.',
            },
            {
              step: 3,
              title: 'Жауап жазу және сақтау',
              body: 'Өзгерістердің бәрі сақталады; кітаптың қалай көрінетінін алдын ала қарауға болады.',
            },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-3xl bg-white p-6 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.06)] md:col-span-4"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-[color:var(--accent)] text-[13px] font-bold text-white">
                {s.step}
              </span>
              <h2 className="mt-3 text-[15px] font-semibold text-[color:var(--text-primary)]">{s.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{s.body}</p>
            </div>
          ))}

          {/* ─── Trial templates ──────────────────────────────────────── */}
          <section
            id="trial-templates"
            className="scroll-mt-20 rounded-3xl bg-white p-7 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.06)] md:col-span-12 sm:p-9"
          >
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[1.2rem] font-semibold tracking-tight text-[color:var(--text-primary)]">
                  Тегін кітап жазып көру
                </h2>
                <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.55] text-[color:var(--text-secondary)]">
                  Үлгіні таңдап «Бастау» батырмасын басыңыз — тіркеліп кіргеннен кейін кітап мәліметтерін толтыруға бағыттаймыз.{' '}
                  Әр үлгі бойынша алдымен{' '}
                  <strong className="font-semibold text-[color:var(--accent)]">{TRIAL_FREE_QUESTION_COUNT} сұрақ</strong> тегін ашылады.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {offers === null ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-2xl bg-[#F3F4F6] px-4 py-4"
                      style={{ opacity: 1 - i * 0.15 }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="h-4 w-[40%] rounded-lg bg-[#E5E7EB]" />
                        <div className="h-9 w-24 rounded-xl bg-[#E5E7EB]" />
                      </div>
                    </div>
                  ))}
                </>
              ) : offers.length === 0 ? (
                <div className="rounded-2xl bg-[#F9FAFB] px-6 py-8 text-center">
                  <p className="text-[14px] font-semibold text-[color:var(--text-primary)]">{loadErr ?? 'Әзірге тізім бос'}</p>
                  {!loadErr && (
                    <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[color:var(--text-muted)]">
                      Админ панельде тегін кезең үлгілері таблицасында категория қосыңыз немесе қолдау бөліміне жазыңыз.
                    </p>
                  )}
                </div>
              ) : (
                offers.map((c) => (
                  <div
                    key={c.id}
                    className="group flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[#F9FAFB] px-5 py-4 transition-[border-color,background-color] duration-200 hover:border-[color:var(--accent-ring)] hover:bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-[color:var(--text-primary)]">{c.title_kk}</span>
                        <span className="inline-flex shrink-0 rounded-lg bg-[color:var(--accent-surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--accent)]">
                          Тегін {TRIAL_FREE_QUESTION_COUNT}
                        </span>
                      </div>
                      {c.description_kk && (
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                          {c.description_kk}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/auth/register?category=${encodeURIComponent(c.id)}`}
                      className="shrink-0 rounded-xl bg-[color:var(--accent)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(115,22,22,0.2)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(115,22,22,0.28)] active:scale-[0.98]"
                    >
                      Бастау →
                    </Link>
                  </div>
                ))
              )}
            </div>

            <p className="mt-6 text-center text-[12px] text-[color:var(--text-muted)]">
              Басқа үлгілер үшін менеджерге жазыңыз — рұқсат бергеннен кейін тізімнен көре аласыз.
            </p>
          </section>

          {/* Help */}
          <div className="rounded-3xl bg-white p-7 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.06)] md:col-span-7 sm:p-8">
            <h2 className="text-[1.05rem] font-semibold text-[color:var(--text-primary)]">Сұрағыңыз бар ма?</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
              Тапсырыс, баға немесе кітап түріне қатысты ақпарат алу үшін менеджермен байланысыңыз.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={TRIAL_WHATSAPP_HREF}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-[#16a34a] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(22,163,74,0.28)] transition-[transform,box-shadow] hover:-translate-y-px active:scale-[0.98]"
              >
                WhatsApp жазу
              </a>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-strong)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[color:var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[#F9FAFB]"
              >
                Аккаунтым бар — кіру
              </Link>
            </div>
          </div>

          {/* Quote */}
          <div className="flex flex-col justify-between rounded-3xl bg-[color:var(--accent)] p-7 shadow-[0_4px_24px_rgba(115,22,22,0.22)] md:col-span-5 sm:p-8">
            <p className="font-serif-display text-[1.2rem] font-semibold leading-snug text-white/90">
              «Сіздің жазған кітаб ең құнды сыйлық болады.»
            </p>
            <Link
              href="/auth/register"
              className="mt-6 inline-flex self-start rounded-xl bg-white/15 px-4 py-2 text-[13px] font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
            >
              Тіркеліп үлгі таңдау →
            </Link>
          </div>

        </div>

        <footer className="mt-14 border-t border-[color:var(--border)] pt-6 text-center text-[12px] text-[color:var(--text-muted)]">
          © Senimen Books. Деректер қорғау туралы ақпарат тіркеу бетінде қолжетімді.
        </footer>
      </main>
    </div>
  )
}
