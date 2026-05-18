'use server'
import { normalizePhoneDigits, phoneToSyntheticEmail } from '@/lib/utils/phone'
import { requireAdminOrManager } from '@/lib/auth/requireStaff'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

function makeServiceClient() {
  const r = createValidatedServiceRoleClient()
  if (!r.ok) return { client: null, error: r.error }
  return { client: r.client, error: null }
}

type Role = 'client' | 'editor' | 'manager'

async function adminCreateRole(
  role: Role,
  data: {
    full_name: string
    phone: string
    password: string
  }
) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  if ((data.password || '').length < 8) {
    return { error: 'Уақытша құпия сөз кем дегенде 8 таңба болуы тиіс' }
  }

  const phoneDigits = normalizePhoneDigits(data.phone)
  if (!phoneDigits) return { error: 'Дұрыс телефон нөмірін енгізіңіз' }
  const email = phoneToSyntheticEmail(phoneDigits)

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name },
  })
  if (error) return { error: error.message }

  const userId = created.user?.id
  if (!userId) return { error: 'Пайдаланушы құрылмады' }

  const { data: updated, error: profileErr } = await admin
    .from('profiles')
    .update({
      full_name: data.full_name,
      role,
    })
    .eq('id', userId)
    .select('id')

  if (profileErr || !updated?.length) {
    const { error: insertErr } = await admin.from('profiles').insert({
      id: userId,
      full_name: data.full_name,
      role,
    })
    if (insertErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      if (/permission denied|rls/i.test(insertErr.message || '')) {
        return {
          error: `${insertErr.message}. Supabase құпия ключі (\`SUPABASE_SERVICE_ROLE_KEY\`) service_role болғанын тексеріңіз (anon емес). Немесе жаңартылған SQL миграцияны қолданыңыз.`,
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
        'Профиль табылмады. Supabase миграцияларын және SERVICE_ROLE кілтін тексеріңіз.',
    }
  }

  const roleOk = String(verify.role) === String(role)
  if (!roleOk) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return {
      error:
        'Профиль рөлі сақталмады (user_role enum-да manager/editor бар ма?). Миграцияны қолданыңыз.',
    }
  }

  const { data: phoneRow, error: phoneReadErr } = await admin
    .from('profile_phones')
    .select('phone')
    .eq('profile_id', userId)
    .maybeSingle()

  if (phoneReadErr || !phoneRow) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return { error: phoneReadErr?.message || 'Телефон жолы табылмады' }
  }

  const storedPhone = phoneRow.phone != null ? normalizePhoneDigits(String(phoneRow.phone)) : null
  const phoneOk = storedPhone === phoneDigits
  if (!phoneOk) {
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

export async function adminCreateUser(data: { full_name: string; phone: string; password: string }) {
  return adminCreateRole('client', data)
}
export async function adminCreateEditor(data: { full_name: string; phone: string; password: string }) {
  return adminCreateRole('editor', data)
}
export async function adminCreateManager(data: { full_name: string; phone: string; password: string }) {
  return adminCreateRole('manager', data)
}

export async function adminCreateOrderForUser(data: {
  client_id: string
  client_name: string
  category_id: string
}) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  const { error } = await admin.from('orders').insert({
    client_id: data.client_id,
    category_id: data.category_id,
    book_title: 'Менің кітабым',
    author_name: data.client_name || '',
    recipient_name: '',
    delivery_address: '',
    status: 'filling',
    trial_mode: false,
    answer_text_align: 'left',
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function adminAddGlobalTrialCategory(category_id: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }
  if (!category_id) return { error: 'Кітап түрін таңдаңыз' }

  const { error } = await admin.from('trial_global_categories').insert({ category_id })
  if (error) return { error: error.message }
  return { success: true }
}

export async function adminRemoveGlobalTrialCategory(category_id: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  const { error } = await admin.from('trial_global_categories').delete().eq('category_id', category_id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function adminGrantFullBookAccess(orderId: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  const { error } = await admin.from('orders').update({ trial_mode: false }).eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true }
}

const PW_MIN_ADMIN = 8

export async function adminUpdateUserPassword(userId: string, newPassword: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const trimmedId = userId?.trim()
  if (!trimmedId) return { error: 'Пайдаланушы көрсетілмеді' }

  const password = newPassword ?? ''
  if (password.length < PW_MIN_ADMIN) {
    return { error: `Жаңа құпия сөз кем дегенде ${PW_MIN_ADMIN} таңба болуы тиіс` }
  }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  const { error } = await admin.auth.admin.updateUserById(trimmedId, { password })
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function adminDeleteUser(userId: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }
  if (gate.user.id === userId) {
    return { error: 'Өз аккаунтыңызды жоюға болмайды' }
  }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  await admin.from('profiles').delete().eq('id', userId)
  return { success: true }
}
