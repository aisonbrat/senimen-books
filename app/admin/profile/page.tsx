'use client'

import { ProfilePageClient } from '@/components/profile/ProfilePageClient'

export default function AdminProfilePage() {
  return (
    <div className="px-4 py-8 md:px-10 md:py-10">
      <header className="mb-8">
        <h1 className="font-serif-display text-[1.5rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[1.65rem]">
          Профиль
        </h1>
        <p className="mt-1 text-[13px] font-medium text-[color:var(--text-muted)]">
          Жеке деректерді қарау және құпия сөзді жаңарту
        </p>
      </header>
      <ProfilePageClient />
    </div>
  )
}
