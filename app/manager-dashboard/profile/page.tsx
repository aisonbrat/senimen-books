'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProfilePageClient } from '@/components/profile/ProfilePageClient'

const W = '#731616'

export default function ManagerProfilePage() {
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
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Сенімен" style={{ height: 26 }} />
            <span
              style={{
                background: '#ECFEFF',
                color: '#0E7E7C',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                borderRadius: 4,
                padding: '3px 8px',
                border: '1px solid rgba(14,165,164,0.22)',
              }}
            >
              Manager
            </span>
            <button
              type="button"
              onClick={() => router.push('/manager-dashboard')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: W,
              }}
            >
              ← Басты бет
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: '#B8A8A8', fontWeight: 500 }}>{userLabel}</span>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: '#7A6060',
              }}
            >
              Шығу →
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px' }}>
        <header style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#1C1010',
              margin: '0 0 8px',
              letterSpacing: '-0.03em',
            }}
          >
            Профиль
          </h1>
          <p style={{ fontSize: 13, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>
            Жеке деректерді қарау және құпия сөзді жаңарту
          </p>
        </header>
        <ProfilePageClient />
      </div>
    </div>
  )
}
