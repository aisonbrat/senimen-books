'use server'

import { phoneToSyntheticEmail, sanitizePhoneInputForAuth } from '@/lib/utils/phone'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

/**
 * Public registration — secure, server-only.
 *
 * Security model
 * ──────────────
 * 1. We DO NOT trust client formatting. All inputs are re-normalized and
 *    validated server-side. The client format is purely UX.
 * 2. Auth users are created via the *service-role* admin API with
 *    `email_confirm: true`. This bypasses the project's email-confirmation
 *    requirement (which would otherwise block sign-in forever because we use
 *    synthetic `@senimen.app` emails). This mirrors the existing admin /
 *    manager / editor invite flows.
 * 3. We pre-check phone uniqueness against `profile_phones.phone` so the user gets
 *    a clear "already registered" message instead of a generic Supabase
 *    "user_already_exists" error.
 * 4. Profile rows are created via service role (RLS-bypassing) but only with
 *    `role: 'client'`. Privilege escalation is impossible because role is
 *    hard-coded here.
 * 5. Returned errors use stable codes so the client can localize messages
 *    without parsing strings.
 */

export type RegisterErrorCode =
  | 'invalid_name'
  | 'invalid_phone'
  | 'weak_password'
  | 'consent_required'
  | 'phone_taken'
  | 'rate_limited'
  | 'server_error'

export type RegisterResult =
  | { ok: true; email: string }
  | { ok: false; code: RegisterErrorCode; message: string }

interface RegisterInput {
  full_name: string
  phone: string
  password: string
  consent: boolean
}

const NAME_MIN = 2
const NAME_MAX = 80
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

/**
 * Light password strength gate. We require a minimum length and a mix of at
 * least one letter and one digit, which buys most of the value of a heavier
 * policy without making the form punishing on mobile keyboards.
 */
function passwordIsAcceptable(pw: string): boolean {
  if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX) return false
  const hasLetter = /[A-Za-zА-Яа-яҚқҒғҢңӨөҮүҰұҺһЁёІіЪъЬь]/.test(pw)
  const hasDigit = /\d/.test(pw)
  return hasLetter && hasDigit
}

function sanitizeName(raw: string): string {
  return (raw || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
    .slice(0, NAME_MAX)
}

export async function registerClient(input: RegisterInput): Promise<RegisterResult> {
  const name = sanitizeName(input.full_name)
  const phoneDigits = sanitizePhoneInputForAuth(input.phone)
  const password = String(input.password ?? '')
  const consent = Boolean(input.consent)

  if (name.length < NAME_MIN) {
    return {
      ok: false,
      code: 'invalid_name',
      message: 'Аты-жөніңізді толық жазыңыз (кемі 2 таңба).',
    }
  }
  if (!phoneDigits) {
    return {
      ok: false,
      code: 'invalid_phone',
      message: 'Толық 11 саннан тұратын дұрыс телефон нөмірін енгізіңіз.',
    }
  }
  if (!passwordIsAcceptable(password)) {
    return {
      ok: false,
      code: 'weak_password',
      message:
        'Құпия сөз кем дегенде 8 таңба болсын және ішінде әріп пен сан болсын.',
    }
  }
  if (!consent) {
    return {
      ok: false,
      code: 'consent_required',
      message: 'Жалғастыру үшін Құпиялылық саясатымен келісу қажет.',
    }
  }

  const adminInit = createValidatedServiceRoleClient()
  if (!adminInit.ok) {
    return { ok: false, code: 'server_error', message: adminInit.error }
  }
  const admin = adminInit.client

  const email = phoneToSyntheticEmail(phoneDigits)

  // Phone uniqueness — friendlier than the Supabase "user_already_exists" error.
  const { data: existing, error: existingErr } = await admin
    .from('profile_phones')
    .select('profile_id')
    .eq('phone', phoneDigits)
    .maybeSingle()
  if (existingErr) {
    return {
      ok: false,
      code: 'server_error',
      message: 'Қазір тіркеу мүмкін емес. Біраздан соң қайталап көріңіз.',
    }
  }
  if (existing) {
    return {
      ok: false,
      code: 'phone_taken',
      message: 'Бұл нөмір тіркелген. Кіру бетіне өтіңіз немесе басқа нөмір қолданыңыз.',
    }
  }

  // Create the auth user with email confirmation already satisfied so the
  // client can sign in immediately afterwards.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (createErr) {
    const lower = (createErr.message || '').toLowerCase()
    if (lower.includes('already') || lower.includes('exists') || lower.includes('registered')) {
      return {
        ok: false,
        code: 'phone_taken',
        message: 'Бұл нөмір тіркелген. Кіру бетіне өтіңіз немесе басқа нөмір қолданыңыз.',
      }
    }
    if (lower.includes('rate') || lower.includes('too many')) {
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Тым көп әрекет. Бір сәтке кідіріп, қайталап көріңіз.',
      }
    }
    return {
      ok: false,
      code: 'server_error',
      message: 'Тіркелу сәтсіз. Кейінірек қайталап көріңіз.',
    }
  }

  const userId = created.user?.id
  if (!userId) {
    return {
      ok: false,
      code: 'server_error',
      message: 'Тіркелу сәтсіз. Кейінірек қайталап көріңіз.',
    }
  }

  // Profile insert. Role is hard-coded to `client` so this path can never
  // mint privileged accounts even if someone tries to inject metadata.
  const { error: profileErr } = await admin.from('profiles').upsert(
    {
      id: userId,
      full_name: name,
      role: 'client',
    },
    { onConflict: 'id' }
  )

  if (profileErr) {
    // Roll back the auth user so the system doesn't drift out of sync.
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    const raw = profileErr.message || ''
    const hint =
      /permission denied|rls/i.test(raw)
        ? ' Supabase құпия ключі (`SUPABASE_SERVICE_ROLE_KEY`) service_role болғанын тексеріңіз (anon емес). Немесе жаңартылған SQL миграцияны қолданыңыз.'
        : ''
    return {
      ok: false,
      code: 'server_error',
      message: `Профиль сақталмады: ${raw}.${hint}`,
    }
  }

  const { error: phoneErr } = await admin.from('profile_phones').upsert(
    { profile_id: userId, phone: phoneDigits },
    { onConflict: 'profile_id' }
  )
  if (phoneErr) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return {
      ok: false,
      code: 'server_error',
      message: `Телефон сақталмады: ${phoneErr.message}`,
    }
  }

  return { ok: true, email }
}
