'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconCheck } from '@/components/ui/icons'
import { AuthFormShell, PhoneField } from '@/components/auth'
import { phoneIsValid, sanitizePhoneInputForAuth } from '@/lib/utils/phone'
import { registerClient, type RegisterErrorCode } from './actions'
import { normalizeTrialCategoryId, postAuthDashboardHref } from '@/lib/auth/postAuthRedirect'

/* eslint-disable @next/next/no-img-element */

interface FieldErrors {
  full_name?: string
  phone?: string
  password?: string
  consent?: string
  form?: string
}

const ERROR_ORDER: (keyof FieldErrors)[] = ['full_name', 'phone', 'password', 'consent', 'form']

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Za-zА-Яа-яҚқҒғҢңӨөҮүҰұҺһ]/.test(pw) && /\d/.test(pw)) score++
  if (pw.length >= 12 && /[^A-Za-zА-Яа-я0-9]/.test(pw)) score++
  const labels = ['', 'Әлсіз', 'Орташа', 'Күшті']
  return { score: Math.min(score, 3) as 0 | 1 | 2 | 3, label: labels[Math.min(score, 3)] }
}

function fieldErrorFromCode(code: RegisterErrorCode): keyof FieldErrors {
  switch (code) {
    case 'invalid_name':
      return 'full_name'
    case 'invalid_phone':
    case 'phone_taken':
      return 'phone'
    case 'weak_password':
      return 'password'
    case 'consent_required':
      return 'consent'
    default:
      return 'form'
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const formRef = useRef<HTMLFormElement>(null)

  const [fullName, setFullName] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [success, setSuccess] = useState(false)
  /** Shown after success when client session refresh fails (still registered). */
  const [manualLoginHint, setManualLoginHint] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [trialCategoryId, setTrialCategoryId] = useState<string | null>(null)

  const strength = passwordStrength(password)
  const phoneOk = phoneIsValid(phoneDigits)

  useEffect(() => {
    const cat = normalizeTrialCategoryId(new URLSearchParams(window.location.search).get('category'))
    setTrialCategoryId(cat)
  }, [])

  useEffect(() => {
    if (!success) return
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.getElementById('auth-register-success')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [success])

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const next: FieldErrors = {}
    if (fullName.trim().length < 2) next.full_name = 'Аты-жөніңізді жазыңыз'
    if (!phoneOk) {
      next.phone = 'Толық 10 сандық нөмірді енгізіңіз (+7 арқылы көрсетеді).'
    }
    if (password.length < 8 || !/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
      next.password = 'Кемі 8 таңба + әріп пен сан болсын'
    }
    if (!consent) next.consent = 'Құпиялылық саясатымен келісу қажет'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    startTransition(async () => {
      setManualLoginHint(null)
      const phone11 = sanitizePhoneInputForAuth(phoneDigits)
      if (!phone11) {
        setErrors({ phone: 'Толық 11 саннан тұратын дұрыс телефон нөмірін енгізіңіз (7-ден басталады).' })
        return
      }
      const result = await registerClient({
        full_name: fullName,
        phone: phone11,
        password,
        consent,
      })
      if (!result.ok) {
        const field = fieldErrorFromCode(result.code)
        setErrors({ [field]: result.message })
        return
      }
      const signIn = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      })
      setSuccess(true)
      if (signIn.error) {
        setManualLoginHint(
          'Тіркеу орындалды, бірақ автоматты кіру сәтсіз. «Кіру» бетінен ұялы нөмірмен қайта кіріңіз.'
        )
        return
      }
      setManualLoginHint(null)
      setTimeout(() => {
        router.push(postAuthDashboardHref(trialCategoryId))
        router.refresh()
      }, 900)
    })
  }

  if (success) {
    return (
      <AuthFormShell>
        <div className="flex shrink-0 justify-center pb-6">
          <img src="/logo.svg" alt="Сенімен" className="h-9 w-auto" />
        </div>
        <div
          id="auth-register-success"
          className="relative z-10 rounded-[var(--radius-xl)] bg-[color:var(--surface)] px-6 py-10 text-center shadow-[var(--shadow-lg)] ring-1 ring-black/[0.06] sm:px-8"
        >
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-900/8">
            <IconCheck className="size-6" />
          </div>
          <h1 className="font-serif-display text-[22px] font-bold tracking-tight text-[color:var(--text-primary)]">
            Тіркелдіңіз!
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[13px] font-medium leading-relaxed text-[color:var(--text-secondary)]">
            Жүйеге кіруге дайынсыз.
            {manualLoginHint ? ` ${manualLoginHint}` : ' Бір сәтте бағыттаймыз…'}
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              onClick={() => router.push(postAuthDashboardHref(trialCategoryId))}
            >
              Қазір кіру
            </Button>
            <a
              href="https://wa.me/+77067074748"
              className="inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-3 text-[13px] font-semibold text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--accent)]"
            >
              Кітап тапсырыс — WhatsApp
            </a>
          </div>
        </div>
      </AuthFormShell>
    )
  }

  return (
    <AuthFormShell>
      <div className="flex shrink-0 justify-center pb-6">
        <img src="/logo.svg" alt="Сенімен" className="h-9 w-auto" />
      </div>

      <div className="rounded-[var(--radius-xl)] bg-[color:var(--surface)] px-6 py-8 shadow-[var(--shadow-lg)] sm:px-8 sm:py-9">
        <header className="mb-6">
          <h1 className="font-serif-display text-[22px] font-bold tracking-tight text-[color:var(--text-primary)]">
            Тіркелу
          </h1>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[color:var(--text-muted)]">
            Жаңа тіркелгі жасап, кітап жазуды бастаңыз
          </p>
        </header>

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pb-4">
          <Input
            id="auth-field-full_name"
            label="Аты-жөні"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={80}
            placeholder="Айгерім Ермекқызы"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.full_name}
            disabled={pending}
            className="!text-[16px] min-h-[48px] py-3"
          />

          <PhoneField
            id="auth-field-phone"
            label="Телефон нөмірі"
            rawDigitSeq={phoneDigits}
            onRawDigitSeqChange={setPhoneDigits}
            error={errors.phone}
            disabled={pending}
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
              name="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
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
            {password && !errors.password && (
              <div className="flex items-center gap-2" aria-hidden>
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={clsx(
                        'h-1 flex-1 rounded-full transition-colors duration-[var(--transition)]',
                        i <= strength.score
                          ? strength.score === 1
                            ? 'bg-amber-400'
                            : strength.score === 2
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          : 'bg-[color:var(--surface-subtle)]'
                      )}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-[color:var(--text-muted)]">{strength.label}</span>
              </div>
            )}
            {errors.password && (
              <p id="auth-field-password-err" role="alert" className="text-[13px] font-medium leading-snug text-red-600">
                {errors.password}
              </p>
            )}
          </div>

          <div className="mt-1">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                id="auth-field-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={pending}
                className="mt-1 size-[22px] shrink-0 cursor-pointer rounded border-[color:var(--border)] accent-[color:var(--accent)]"
              />
              <span className="text-[13px] font-medium leading-relaxed text-[color:var(--text-secondary)]">
                Мен{' '}
                <Link
                  href="/privacy"
                  className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                >
                  Құпиялылық саясатымен
                </Link>{' '}
                келісемін және деректерімнің кітап шығару үшін қолданылуына рұқсат беремін.
              </span>
            </label>
            {errors.consent && (
              <p role="alert" className="mt-2 text-[13px] font-medium leading-snug text-red-600">
                {errors.consent}
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

          <Button type="submit" variant="primary" fullWidth disabled={pending} className="mt-2 shrink-0">
            {pending ? 'Тіркелуде...' : 'Тіркелу'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] font-medium text-[color:var(--text-muted)]">
          Тіркелгіңіз бар ма?{' '}
          <a
            href={
              trialCategoryId
                ? `/auth/login?category=${encodeURIComponent(trialCategoryId)}`
                : '/auth/login'
            }
            className="font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            Кіру
          </a>
        </p>
      </div>

      <p className="mx-auto mt-6 max-w-sm text-center text-[11px] font-medium leading-relaxed text-[color:var(--text-muted)]">
        Деректер HTTPS арқылы қорғалады. ҚР ДК талаптарына сай сақталады.
      </p>
    </AuthFormShell>
  )
}
