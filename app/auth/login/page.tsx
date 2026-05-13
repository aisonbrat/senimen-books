'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { AuthFormShell, PhoneField } from '@/components/auth'
import { phoneIsValid, sanitizePhoneInputForAuth } from '@/lib/utils/phone'
import { loginWithPhone, type LoginErrorCode } from './actions'
import { normalizeTrialCategoryId, postAuthDashboardHref, getSafeInternalNextPath } from '@/lib/auth/postAuthRedirect'

/* eslint-disable @next/next/no-img-element */

interface FieldErrors {
  phone?: string
  password?: string
  form?: string
}

const RATE_LIMIT_THRESHOLD = 5
const RATE_LIMIT_COOLDOWN_MS = 60_000

const ERROR_ORDER: (keyof FieldErrors)[] = ['phone', 'password', 'form']

function fieldFromCode(code: LoginErrorCode): keyof FieldErrors {
  switch (code) {
    case 'invalid_phone':
      return 'phone'
    case 'missing_password':
      return 'password'
    default:
      return 'form'
  }
}

export default function LoginPage() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const [phoneDigits, setPhoneDigits] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, startTransition] = useTransition()

  const [failures, setFailures] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [trialCategoryId, setTrialCategoryId] = useState<string | null>(null)

  useEffect(() => {
    const cat = normalizeTrialCategoryId(new URLSearchParams(window.location.search).get('category'))
    setTrialCategoryId(cat)
  }, [])

  useEffect(() => {
    if (!cooldownUntil) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [cooldownUntil])

  useEffect(() => {
    const keys = ERROR_ORDER.filter((k) => Boolean(errors[k]))
    if (keys.length === 0) return
    const first = keys[0]
    const el =
      first === 'form'
        ? formRef.current?.querySelector('[data-auth-form-error]')
        : document.getElementById(`auth-field-${first}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [errors])

  const cooldownLeft = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0
  const isLocked = cooldownLeft > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    if (isLocked) return

    const next: FieldErrors = {}
    if (!phoneIsValid(phoneDigits)) {
      next.phone = 'Толық 10 сандық нөмірді енгізіңіз (+7 арқылы көрсетеді).'
    }
    if (!password) next.password = 'Құпия сөзді енгізіңіз'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    startTransition(async () => {
      const phone11 = sanitizePhoneInputForAuth(phoneDigits)
      if (!phone11) {
        setErrors({ phone: 'Толық 11 саннан тұратын дұрыс телефон нөмірін енгізіңіз (7-ден басталады).' })
        return
      }
      const result = await loginWithPhone({ phone: phone11, password })
      if (!result.ok) {
        const nf = failures + 1
        setFailures(nf)
        if (nf >= RATE_LIMIT_THRESHOLD || result.code === 'rate_limited') {
          setCooldownUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS)
        }
        setErrors({ [fieldFromCode(result.code)]: result.message })
        return
      }
      setFailures(0)
      const next = getSafeInternalNextPath(
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null
      )
      router.push(next ?? postAuthDashboardHref(trialCategoryId))
      router.refresh()
    })
  }

  function handlePasswordKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === 'function') {
      setCapsOn(e.getModifierState('CapsLock'))
    }
  }

  return (
    <AuthFormShell>
      <div className="flex shrink-0 justify-center pb-6">
        <img src="/logo.svg" alt="Сенімен" className="h-9 w-auto" />
      </div>

      <div className="rounded-[var(--radius-xl)] bg-[color:var(--surface)] px-6 py-8 shadow-[var(--shadow-lg)] sm:px-8 sm:py-9">
        <header className="mb-6">
          <h1 className="font-serif-display text-[22px] font-bold tracking-tight text-[color:var(--text-primary)]">
            Жүйеге кіру
          </h1>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[color:var(--text-muted)]">
            Телефон нөміріңіз (+7…) және құпия сөзіңіз
          </p>
        </header>

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pb-4">
          <PhoneField
            id="auth-field-phone"
            label="Телефон нөмірі"
            rawDigitSeq={phoneDigits}
            onRawDigitSeqChange={setPhoneDigits}
            error={errors.phone}
            disabled={pending || isLocked}
          />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="auth-field-password"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]"
            >
              Құпия сөз
            </label>
            <div className="relative isolate z-0">
              <input
                id="auth-field-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handlePasswordKey}
                onKeyUp={handlePasswordKey}
                disabled={pending || isLocked}
                className={clsx(
                  'min-h-[48px] w-full rounded-[var(--radius-md)] border bg-[color:var(--surface)] py-3 pl-4 pr-16 font-medium outline-none [-webkit-appearance:none]',
                  'text-[16px] leading-normal shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-[var(--transition)]',
                  'placeholder:text-[color:var(--text-muted)]',
                  'focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-ring),var(--shadow-xs)]',
                  'disabled:cursor-not-allowed disabled:bg-[color:var(--surface-subtle)] disabled:opacity-45',
                  errors.password
                    ? 'border-red-400 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                    : 'border-[color:var(--border)]'
                )}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'auth-field-password-err' : undefined}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? 'Құпия сөзді жасыру' : 'Құпия сөзді көрсету'}
                aria-pressed={showPassword}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault()
                  setShowPassword((v) => !v)
                }}
                className="absolute right-1.5 top-1/2 z-30 flex min-h-[40px] min-w-[48px] -translate-y-1/2 cursor-pointer touch-manipulation items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] active:opacity-80"
              >
                {showPassword ? 'жасыру' : 'көру'}
              </button>
            </div>
            {capsOn && !errors.password && (
              <p className="text-[13px] font-medium leading-snug text-amber-700">Caps Lock қосулы.</p>
            )}
            {errors.password && (
              <p id="auth-field-password-err" role="alert" className="text-[13px] font-medium leading-snug text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          {errors.form ? (
            <div
              data-auth-form-error
              role="alert"
              className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-red-900"
            >
              {errors.form}
            </div>
          ) : null}

          {isLocked && (
            <div
              role="status"
              className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-amber-900"
            >
              Тым көп әрекет. {Math.ceil(cooldownLeft / 1000)} секундтан кейін қайталаңыз.
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={pending || isLocked}
            className="mt-2 shrink-0"
          >
            {pending ? 'Кіруде...' : 'Кіру'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] font-medium text-[color:var(--text-muted)]">
          Тіркелгіңіз жоқ па?{' '}
          <a
            href={
              trialCategoryId
                ? `/auth/register?category=${encodeURIComponent(trialCategoryId)}`
                : '/auth/register'
            }
            className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            Тіркелу
          </a>
        </p>
      </div>

      <p className="mx-auto mt-6 max-w-sm text-center text-[11px] font-medium leading-relaxed text-[color:var(--text-muted)]">
        Деректер HTTPS арқылы қорғалады. Құпия сөзіңізді ешкімге айтпаңыз.
      </p>
    </AuthFormShell>
  )
}
