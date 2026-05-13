/**
 * Phone — single source of truth for Kazakhstan-format mobile numbers.
 *
 * Synthetic auth email: `<11-digit e164 without +>@senimen.app`
 *
 * Mobile-first rules
 * ─────────────────
 * - Users often type a leading **8** (domestic trunk). We strip only that 8.
 * - We strip a **leading 7** only when it is clearly the country code
 *   (11+ digit buffer like `77771234567`). We do **not** strip the first 7
 *   of a 10-digit national number (`87771234567` → `7771234567` after 8).
 * - All formatting reads a **digit-only buffer** (`0…12` chars) so Safari /
 *   Chrome autofill and paste always land in the same code path as typing.
 */

/** Domain we attach to synthetic emails. */
export const SYNTHETIC_EMAIL_DOMAIN = 'senimen.app'

/** Max raw digits scanned from paste/autofill before clamping to KZ mobile length. */
export const PHONE_DIGIT_BUFFER_MAX = 15

/** National significant number length (after +7 / 8). */
export const KZ_SUBSCRIBER_DIGITS = 10

/**
 * Extract the 10-digit national significant number (operators like 701…/777…).
 * Input may be mixed text; only digit characters are considered, in order.
 */
export function extractNationalSubscriberDigits(input: string): string {
  let d = (input || '').replace(/\D/g, '').slice(0, PHONE_DIGIT_BUFFER_MAX)
  if (d.startsWith('8')) d = d.slice(1)
  if (d.startsWith('7') && d.length >= 11) d = d.slice(1)
  return d.slice(0, KZ_SUBSCRIBER_DIGITS)
}

/**
 * Normalizes the admin / auth «digit buffer» so users cannot type past one KZ mobile,
 * and paste overflow is clipped (no extra digits after 10 national).
 */
export function clampPhoneFieldDigitBuffer(input: string): string {
  const digits = String(input ?? '')
    .replace(/\D/g, '')
    .slice(0, PHONE_DIGIT_BUFFER_MAX)
  if (digits === '') return ''
  if (digits === '8') return '8'
  const sub = extractNationalSubscriberDigits(digits)
  /** Full KZ mobile: exactly 10 national digits in the buffer (+7 is outside the field). */
  if (sub.length === KZ_SUBSCRIBER_DIGITS) return sub
  /** Domestic trunk `8` then up to 10 digits (stored as `8` + max 10). */
  if (digits.startsWith('8')) {
    return digits.length === 1 ? '8' : '8' + digits.slice(1, 1 + KZ_SUBSCRIBER_DIGITS)
  }
  /** Typed/pasted with leading country `7` (e.g. 7 + 10 digits) — cap at 11 raw digits. */
  if (digits.startsWith('7')) return digits.slice(0, 11)
  /** National digits only — never keep more than 10. */
  return digits.slice(0, KZ_SUBSCRIBER_DIGITS)
}

/**
 * Build display `+7 XXX XXX XX XX` and the 0…10 digit subscriber from a
 * digit-only buffer (or any string — non-digits stripped).
 */
export function formatFromDigitSequence(seqRaw: string): {
  display: string
  subscriber10: string
} {
  const seq = clampPhoneFieldDigitBuffer(seqRaw)
  const digits = seq.replace(/\D/g, '')
  const subscriber10 = extractNationalSubscriberDigits(seq)

  const display =
    digits.length === 0
      ? ''
      : subscriber10.length === 0 && digits.startsWith('8')
        ? '+7 '
        : formatSubscriberBracket(subscriber10)
  return { display, subscriber10 }
}

/** `XXX XXX XX XX` — digits and single spaces only (backspace-friendly; no `(`…`)` mask). */
function formatSubscriberMaskedOnly(subscriber10: string): string {
  const s = subscriber10.slice(0, KZ_SUBSCRIBER_DIGITS)
  if (!s) return ''
  const a = s.slice(0, 3)
  const b = s.slice(3, 6)
  const c = s.slice(6, 8)
  const d = s.slice(8, 10)
  const parts: string[] = []
  if (a) parts.push(a)
  if (b) parts.push(b)
  if (c) parts.push(c)
  if (d) parts.push(d)
  return parts.join(' ')
}

function formatSubscriberBracket(sub: string): string {
  return `+7 ${formatSubscriberMaskedOnly(sub)}`
}

/** Input value beside a static «+7» label — extracting `\\d` CANNOT ingest a phantom leading 7 from the label. */
export function formatInnerPhoneInputDisplay(seqRaw: string): string {
  const seq = clampPhoneFieldDigitBuffer(seqRaw)
  const digits = seq.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits === '8') return '8'
  const subscriber10 = extractNationalSubscriberDigits(seq)
  if (subscriber10.length === 0 && digits.startsWith('8')) return '8'
  return formatSubscriberMaskedOnly(subscriber10)
}

/**
 * Pretty live-typing formatter — pass the current input `value` from the
 * field (may include spaces, `+`, etc.).
 */
export function formatPhoneAsTyped(input: string): string {
  return formatFromDigitSequence(clampPhoneFieldDigitBuffer(input)).display
}

/**
 * Normalize to canonical 11-digit `7XXXXXXXXXX`, or `null` if incomplete / invalid.
 */
export function normalizePhoneDigits(input: string): string | null {
  const sub = extractNationalSubscriberDigits(clampPhoneFieldDigitBuffer(input))
  if (sub.length !== KZ_SUBSCRIBER_DIGITS) return null
  return '7' + sub
}

/**
 * Auth transport: strip `+`, spaces, brackets, then apply KZ rules →
 * exactly `7` + 10 digits, or `null`.
 */
export function sanitizePhoneInputForAuth(raw: unknown): string | null {
  const compact = String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, PHONE_DIGIT_BUFFER_MAX)
  return normalizePhoneDigits(compact)
}

export function phoneIsValid(input: string): boolean {
  return normalizePhoneDigits(input) !== null
}

export function phoneToSyntheticEmail(input: string): string {
  const digits = normalizePhoneDigits(input)
  if (!digits) throw new Error('phoneToSyntheticEmail: invalid phone')
  return `${digits}@${SYNTHETIC_EMAIL_DOMAIN}`
}

export function formatPhoneForDisplay(input: string | null | undefined): string {
  if (!input) return ''
  const digits = normalizePhoneDigits(input)
  if (!digits) return input
  const sub = digits.slice(1)
  return `+7 ${formatSubscriberMaskedOnly(sub)}`
}
