'use server'

import { createClient } from '@/lib/supabase/server'
import { phoneToSyntheticEmail, sanitizePhoneInputForAuth } from '@/lib/utils/phone'

/**
 * Phone+password sign-in. Runs server-side so cookies (set by @supabase/ssr)
 * are attached to the response, and so error messages can be mapped to a
 * stable, localizable code set instead of leaking raw Supabase strings.
 *
 * Returns a discriminated union — callers should `if (!result.ok)` to surface
 * the localized message in the form.
 */

export type LoginErrorCode =
  | 'invalid_phone'
  | 'missing_password'
  | 'invalid_credentials'
  | 'unconfirmed'
  | 'rate_limited'
  | 'server_error'

export type LoginResult =
  | { ok: true }
  | { ok: false; code: LoginErrorCode; message: string }

export async function loginWithPhone(input: {
  phone: string
  password: string
}): Promise<LoginResult> {
  const phoneDigits = sanitizePhoneInputForAuth(input.phone)
  const password = String(input.password ?? '')

  if (!phoneDigits) {
    return {
      ok: false,
      code: 'invalid_phone',
      message: 'Толық 11 саннан тұратын дұрыс телефон нөмірін енгізіңіз.',
    }
  }
  if (!password) {
    return {
      ok: false,
      code: 'missing_password',
      message: 'Құпия сөзді енгізіңіз.',
    }
  }

  const supabase = await createClient()
  const email = phoneToSyntheticEmail(phoneDigits)

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const status = (error as { status?: number }).status
    const lower = (error.message || '').toLowerCase()

    if (status === 429 || lower.includes('rate') || lower.includes('too many')) {
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Тым көп әрекет. Бір сәтке кідіріп, қайталап көріңіз.',
      }
    }
    if (lower.includes('not confirmed') || lower.includes('confirm')) {
      // Should never happen after the new admin-bypass registration path,
      // but surface a clear hint so support can diagnose legacy accounts.
      return {
        ok: false,
        code: 'unconfirmed',
        message:
          'Тіркелгі әлі белсендірілмеген. Әкімшіге хабарласыңыз: +7 706 707 47 48',
      }
    }
    // 400 / generic — wrong phone or password. We deliberately do NOT
    // distinguish "wrong phone" from "wrong password" so attackers can't
    // enumerate phone numbers via the login form.
    return {
      ok: false,
      code: 'invalid_credentials',
      message: 'Телефон нөмірі немесе құпия сөз қате.',
    }
  }

  return { ok: true }
}
