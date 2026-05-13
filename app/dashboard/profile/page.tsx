'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SiteHeader } from '@/components/shell/SiteHeader'
import { ProfilePageClient } from '@/components/profile/ProfilePageClient'

export default function DashboardProfilePage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [userLabel, setUserLabel] = useState('')

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserLabel(user.email ?? '')
    })
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-page)]">
      <SiteHeader userLabel={userLabel} onLogout={handleLogout} homeHref="/dashboard" homeLabel="Басты бет" />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 md:px-8 md:pt-14">
        <header className="mb-10">
          <h1 className="font-serif-display text-[1.75rem] font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[2rem]">
            Профиль
          </h1>
          <p className="mt-2 text-[13px] font-medium text-[color:var(--text-muted)]">
            Жеке деректерді қарау және құпия сөзді жаңарту
          </p>
        </header>

        <ProfilePageClient />
      </main>
    </div>
  )
}
