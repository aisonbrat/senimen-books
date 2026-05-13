import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Жария оферта, Құпиялылық саясаты, Қайтару тәртібі — Senimen Books',
  description:
    'Senimen Books платформасының заңды құжаттары: жария оферта, құпиялылық саясаты және қайтару тәртібі. ИП «AISULTAN GROUP», ЖСН 040113551663.',
  alternates: {
    languages: {
      kk: '/privacy',
      ru: '/privacy',
    },
  },
  openGraph: {
    title: 'Жария оферта, Құпиялылық саясаты — Senimen Books',
    description: 'Senimen Books платформасының заңды құжаттары.',
    locale: 'kk_KZ',
    alternateLocale: ['ru_KZ'],
    type: 'website',
  },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
