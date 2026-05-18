'use server'

import { createServerClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { normalizePhoneDigits, phoneToSyntheticEmail } from '@/lib/utils/phone'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

/**
 * Manager-side server actions.
 *
 * Every action enforces two invariants:
 *   1. Caller must be authenticated AND have role ∈ { 'manager', 'admin' }.
 *   2. Managers may only mutate users whose role is 'client'. They CANNOT
 *      create, view-as, or delete other managers / editors / admins. This
 *      prevents privilege escalation through the manager dashboard.
 *
 * Admins keep their own `app/admin/users/actions.ts` flow — these duplicates
 * exist so we can apply tighter scope checks without compromising admin UX.
 */

function makeAdmin() {
  const r = createValidatedServiceRoleClient()
  if (!r.ok) return { client: null, error: r.error }
  return { client: r.client, error: null }
}

async function requireManager() {
  const cookieStore = await cookies()
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* no-op: actions don't refresh cookies */ },
      },
    }
  )
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return { error: 'Авторизацияланбаған', userId: null }

  const { data: profile } = await ssr
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string | null }>()
  const role = profile?.role
  if (role !== 'manager' && role !== 'admin') {
    return { error: 'Бұл әрекетке құқығыңыз жоқ', userId: null }
  }
  return { error: null, userId: user.id }
}

/** Verify a target user is a client. Managers may only touch clients. */
async function assertClientTarget(admin: SupabaseClient, userId: string) {
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single<{ role: string | null }>()
  if (!target) return 'Пайдаланушы табылмады'
  if (target.role !== 'client') return 'Менеджер тек клиенттерді басқара алады'
  return null
}

export async function managerCreateClient(data: {
  full_name: string
  phone: string
  password: string
}) {
  const auth = await requireManager()
  if (auth.error) return { error: auth.error }
  const { client: admin, error: keyErr } = makeAdmin()
  if (!admin) return { error: keyErr }

  if ((data.password || '').length < 8) {
    return { error: 'Уақытша құпия сөз кем дегенде 8 таңба болуы тиіс' }
  }

  const phoneDigits = normalizePhoneDigits(data.phone)
  if (!phoneDigits) return { error: 'Дұрыс телефон нөмірін енгізіңіз' }
  const email = phoneToSyntheticEmail(phoneDigits)

  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: data.password, email_confirm: true,
    user_metadata: { full_name: data.full_name },
  })
  if (error) return { error: error.message }

  const userId = created.user?.id
  if (!userId) return { error: 'Пайдаланушы құрылмады' }

  const { data: updated, error: profileErr } = await admin
    .from('profiles')
    .update({
      full_name: data.full_name,
      role: 'client',
    })
    .eq('id', userId)
    .select('id')

  if (profileErr || !updated?.length) {
    const { error: insertErr } = await admin.from('profiles').insert({
      id: userId,
      full_name: data.full_name,
      role: 'client',
    })
    if (insertErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      if (/permission denied|rls/i.test(insertErr.message || '')) {
        return {
          error: `${insertErr.message}. SERVICE_ROLE ключін тексеріңіз немесе миграцияны қолданыңыз.`,
        }
      }
      return { error: insertErr.message }
    }
  }

  const { error: phoneUpsertErr } = await admin.from('profile_phones').upsert(
    { profile_id: userId, phone: phoneDigits },
    { onConflict: 'profile_id' }
  )
  if (phoneUpsertErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return { error: phoneUpsertErr.message }
  }

  const { data: verify, error: verifyErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (verifyErr || !verify) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return {
      error:
        verifyErr?.message ||
        'Профиль табылмады. SERVICE_ROLE кілтін және миграцияларды тексеріңіз.',
    }
  }

  if (String(verify.role) !== 'client') {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return { error: 'Профиль рөлі client болып сақталмады.' }
  }

  const { data: phoneRow } = await admin
    .from('profile_phones')
    .select('phone')
    .eq('profile_id', userId)
    .maybeSingle()

  const storedPhone = phoneRow?.phone != null ? normalizePhoneDigits(String(phoneRow.phone)) : null
  if (storedPhone !== phoneDigits) {
    const { error: fixPhoneErr } = await admin
      .from('profile_phones')
      .upsert({ profile_id: userId, phone: phoneDigits }, { onConflict: 'profile_id' })
    if (fixPhoneErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      return { error: fixPhoneErr.message }
    }
  }

  return { success: true }
}

export async function managerGrantBookAccess(data: {
  client_id: string
  client_name: string
  category_id: string
}) {
  const auth = await requireManager()
  if (auth.error) return { error: auth.error }
  const { client: admin, error: keyErr } = makeAdmin()
  if (!admin) return { error: keyErr }

  const scopeErr = await assertClientTarget(admin, data.client_id)
  if (scopeErr) return { error: scopeErr }

  const { error } = await admin.from('orders').insert({
    client_id: data.client_id,
    category_id: data.category_id,
    book_title: 'Менің кітабым',
    author_name: data.client_name || '',
    recipient_name: '',
    delivery_address: '',
    status: 'filling',
    answer_text_align: 'left',
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function managerRevokeBookAccess(orderId: string) {
  const auth = await requireManager()
  if (auth.error) return { error: auth.error }
  const { client: admin, error: keyErr } = makeAdmin()
  if (!admin) return { error: keyErr }

  // Confirm the order belongs to a client before deleting.
  const { data: order } = await admin
    .from('orders')
    .select('id, client_id')
    .eq('id', orderId)
    .single<{ id: string; client_id: string }>()
  if (!order) return { error: 'Тапсырыс табылмады' }
  const scopeErr = await assertClientTarget(admin, order.client_id)
  if (scopeErr) return { error: scopeErr }

  const { error } = await admin.from('orders').delete().eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function managerSetOrderClientAiEnabled(orderId: string, enabled: boolean) {
  const auth = await requireManager()
  if (auth.error) return { error: auth.error }
  const { client: admin, error: keyErr } = makeAdmin()
  if (!admin) return { error: keyErr }

  const { data: order } = await admin
    .from('orders')
    .select('id, client_id')
    .eq('id', orderId)
    .single<{ id: string; client_id: string }>()
  if (!order) return { error: 'Тапсырыс табылмады' }
  const scopeErr = await assertClientTarget(admin, order.client_id)
  if (scopeErr) return { error: scopeErr }

  const { error } = await admin.from('orders').update({ client_ai_enabled: !!enabled }).eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function managerDeleteClient(userId: string) {
  const auth = await requireManager()
  if (auth.error) return { error: auth.error }
  const { client: admin, error: keyErr } = makeAdmin()
  if (!admin) return { error: keyErr }

  const scopeErr = await assertClientTarget(admin, userId)
  if (scopeErr) return { error: scopeErr }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  await admin.from('profiles').delete().eq('id', userId)
  return { success: true }
}
