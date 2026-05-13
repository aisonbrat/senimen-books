import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, TextArea } from '@/components/ui/Input'

export const metadata: Metadata = {
  title: 'Design preview — Сенімен Books',
  description: 'Visual direction for the platform refresh (tokens + primitives).',
  robots: { index: false, follow: false },
}

export default function DesignPreviewPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bg-page)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
              Direction preview
            </p>
            <h1 className="font-serif-display mt-1 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
              Сенімен Books
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm">
              Құжаттама
            </Button>
            <Button variant="secondary" size="sm">
              Қарау
            </Button>
            <Button variant="primary" size="sm">
              Негізгі әрекет
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-6 py-14 pb-24">
        <section className="space-y-6">
          <div>
            <h2 className="font-serif-display text-2xl font-semibold text-[color:var(--text-primary)]">
              Типография
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
              Интерфейс мәтіні — Inter (sans). Тақырыптар мен кітаптық сезім үшін — Source Serif 4.
              Фон ашық нейтрал, акцент{' '}
              <span className="font-medium text-[color:var(--accent)]">#731616</span>
              тек негізгі CTA және фокуста.
            </p>
          </div>
          <Card elevated className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Serif — тақырып
              </p>
              <p className="font-serif-display mt-3 text-2xl font-semibold leading-snug text-[color:var(--text-primary)]">
                Әр бетте оқырманға арналған жеке әңгіме
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Sans — дене мәтіні
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
                Таза қабырға, жұмсақ көлеңке, тұрақты радиустар. MVP көрінісін алып тастап,
                Google / Stripe сынды минималист Premium бет құрылымын көздейміз.
              </p>
            </div>
          </Card>
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="font-serif-display text-2xl font-semibold text-[color:var(--text-primary)]">
              Түстер мен бет
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] text-[color:var(--text-secondary)]">
              Бет фоны warm off-white; карточкалар ақ бетке жақын; шекаралар төмен контраст.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card padding="sm" className="flex flex-col gap-3">
              <span className="text-[12px] font-medium text-[color:var(--text-muted)]">Фон</span>
              <span className="rounded-[var(--radius-md)] bg-[color:var(--bg-page)] px-3 py-8 text-center text-[12px] text-[color:var(--text-secondary)] ring-1 ring-[color:var(--border)]">
                --bg-page
              </span>
            </Card>
            <Card padding="sm" className="flex flex-col gap-3">
              <span className="text-[12px] font-medium text-[color:var(--text-muted)]">Беткеу</span>
              <span className="rounded-[var(--radius-md)] bg-[color:var(--surface)] px-3 py-8 text-center text-[12px] text-[color:var(--text-secondary)] ring-1 ring-[color:var(--border)]">
                --surface
              </span>
            </Card>
            <Card padding="sm" className="flex flex-col gap-3">
              <span className="text-[12px] font-medium text-[color:var(--text-muted)]">Акцент</span>
              <span
                className="rounded-[var(--radius-md)] px-3 py-8 text-center text-[12px] font-medium text-white shadow-[var(--shadow-sm)]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                --accent
              </span>
            </Card>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="font-serif-display text-2xl font-semibold text-[color:var(--text-primary)]">
              Компоненттер
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] text-[color:var(--text-secondary)]">
              Батырмалар, өрістер және карточкалар — бірдей радиус, жұмсақ көлеңке, назары акцентке бағытталған.
            </p>
          </div>
          <Card elevated className="space-y-8">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Жобаны жалғастыру</Button>
              <Button variant="secondary">Қазір емес</Button>
              <Button variant="ghost">Қосымша</Button>
              <Button variant="danger">Жою</Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Input label="Аты-жөні" placeholder="Мысалы: Дана Қасым" />
              <Input label="Email" type="email" placeholder="you@example.com" error="Қате формат" />
              <div className="md:col-span-2">
                <TextArea
                  label="Хабарлама"
                  placeholder="Кітап туралы қысқаша..."
                  rows={4}
                />
              </div>
            </div>
          </Card>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-md)]">
          <h3 className="font-serif-display text-xl font-semibold text-[color:var(--text-primary)]">
            Келесі қадам (Фаза 2)
          </h3>
          <ul className="mt-4 space-y-2 text-[14px] text-[color:var(--text-secondary)]">
            <li>• Dashboard, Admin және Editor беттерін осы токендерге аудару</li>
            <li>• Editor жұмыс аумағын тармақтарға бөліп, визуалдық тығыздықты азайту</li>
            <li>• Барлық қолданыстағы логика өзгеріссіз қалуы тиіс — тек қабат және компонент стилі</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
