import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  GEMINI_MODEL,
  GeminiError,
  geminiPolishText,
  systemPromptForEnhancementMode,
  temperatureForEnhancementMode,
  type KazakhEnhancementMode,
} from '@/lib/ai/gemini'
import {
  countWords,
  htmlToPlainTextWithParagraphs,
  plainTextToParagraphHtml,
} from '@/lib/ai/htmlPlainText'
import {
  AI_CLIENT_PAID_SUCCESSES_PER_BLOCK_WINDOW,
  AI_CLIENT_PAID_WINDOW_MINUTES,
  AI_CLIENT_TRIAL_SUCCESSES_PER_BLOCK,
  AI_ENHANCE_MAX_BODY_BYTES,
  AI_ENHANCE_MAX_INPUT_CHARS,
} from '@/lib/config'

export const runtime = 'nodejs'

const ALLOWED_SOURCES = ['answer', 'algy', 'hat', 'custom_text', 'overlay'] as const
const ENHANCEMENT_MODES = ['grammar', 'polish', 'literary'] as const

const blockKeySchema = z
  .string()
  .min(1)
  .max(140)
  .regex(/^[a-zA-Z0-9_:.-]+$/, 'blockKey форматы дұрыс емес')

const enhanceRequestSchema = z
  .object({
    html: z.string().max(AI_ENHANCE_MAX_INPUT_CHARS * 4).optional(),
    text: z.string().max(AI_ENHANCE_MAX_INPUT_CHARS * 2).optional(),
    source: z.enum(ALLOWED_SOURCES).optional(),
    orderId: z.string().uuid().optional(),
    mode: z.enum(ENHANCEMENT_MODES).optional(),
    blockKey: blockKeySchema.optional(),
  })
  .refine((b) => !!(b.text?.trim() || b.html?.trim()), {
    message: 'Either html or text is required',
  })

type EnhanceRequestBody = z.infer<typeof enhanceRequestSchema>

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function createServiceAdmin(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return null
  return createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function countBlockSuccesses(
  admin: SupabaseClient,
  orderId: string,
  blockKey: string,
  sinceIso?: string
): Promise<number> {
  let q = admin
    .from('ai_enhancement_logs')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('block_key', blockKey)
    .eq('success', true)
  if (sinceIso) q = q.gte('created_at', sinceIso)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function earliestSuccessCreatedAtInWindow(
  admin: SupabaseClient,
  orderId: string,
  blockKey: string,
  sinceIso: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('ai_enhancement_logs')
    .select('created_at')
    .eq('order_id', orderId)
    .eq('block_key', blockKey)
    .eq('success', true)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const c = data?.created_at
  return typeof c === 'string' ? c : null
}

type ClientGateOk = {
  ok: true
  usedBefore: number
  limit: number
  trial: boolean
  /** ISO start of sliding window (paid path only). */
  paidWindowStartIso?: string
}

type ClientGateFail = {
  ok: false
  message: string
  resetsAtIso?: string
}

async function gateClientBlockQuota(
  admin: SupabaseClient,
  orderId: string,
  blockKey: string,
  trialMode: boolean
): Promise<ClientGateOk | ClientGateFail> {
  if (trialMode) {
    const usedBefore = await countBlockSuccesses(admin, orderId, blockKey)
    const limit = AI_CLIENT_TRIAL_SUCCESSES_PER_BLOCK
    if (usedBefore >= limit) {
      return {
        ok: false,
        message:
          `Тегін кезең: осы бөлім үшін ЖИ әрлеу лимиті таусылды (${limit} рет). Жаңа мәтін бөлімдері үшін қайта қолданыңыз.`,
      }
    }
    return { ok: true, usedBefore, limit, trial: true }
  }

  const paidWindowMs = AI_CLIENT_PAID_WINDOW_MINUTES * 60 * 1000
  const paidWindowStartIso = new Date(Date.now() - paidWindowMs).toISOString()
  const usedBefore = await countBlockSuccesses(admin, orderId, blockKey, paidWindowStartIso)
  const limit = AI_CLIENT_PAID_SUCCESSES_PER_BLOCK_WINDOW

  if (usedBefore >= limit) {
    const earliest = await earliestSuccessCreatedAtInWindow(admin, orderId, blockKey, paidWindowStartIso)
    const resetsAtIso = earliest
      ? new Date(new Date(earliest).getTime() + paidWindowMs).toISOString()
      : undefined
    return {
      ok: false,
      message: `Бұл бөлім үшін ЖИ қолдану кезеңдік лимитке жетті (30 мин ішінде ${limit} рет). Әрекетті қайталағыңыз келсе, кейінірек қайта көріңіз.`,
      resetsAtIso,
    }
  }

  return { ok: true, usedBefore, limit, trial: false, paidWindowStartIso: paidWindowStartIso }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > AI_ENHANCE_MAX_BODY_BYTES) {
    return jsonError(`Сұраныс өте үлкен (${contentLength}/${AI_ENHANCE_MAX_BODY_BYTES} байт)`, 413)
  }

  let userId: string
  let supabase: Awaited<ReturnType<typeof createClient>>
  let role: string
  try {
    supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return jsonError('Кіру қажет', 401)

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileErr) return jsonError('Авторизация дерекқорда оқылмады', 500)
    if (!profile) return jsonError('Профиль табылмады', 403)
    userId = user.id
    role = String(profile.role ?? 'client')
  } catch {
    return jsonError('Авторизация қатесі', 500)
  }

  let body: EnhanceRequestBody
  try {
    const raw = await req.json()
    const parsed = enhanceRequestSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return jsonError(first?.message || 'Денесі дұрыс емес', 400)
    }
    body = parsed.data
  } catch {
    return jsonError('Неверный JSON', 400)
  }

  const staffMayUseAi = role === 'editor' || role === 'admin'
  let gateResult: ClientGateOk | null = null
  let blockKeyLogged: string | null = staffMayUseAi ? (body.blockKey?.trim() ?? null) : null

  if (!staffMayUseAi) {
    if (role !== 'client') {
      return jsonError('Тек тапсырыс иесі немесе редактор бұл әрекетті орындай алады', 403)
    }
    if (!body.orderId) {
      return jsonError('Тапсырыс идентификаторы (orderId) қажет', 400)
    }
    if (!body.blockKey?.trim()) {
      return jsonError('ЖИ бөлім лимиті үшін blockKey жолы қажет.', 400)
    }

    const { data: ord, error: ordErr } = await supabase
      .from('orders')
      .select('client_id, client_ai_enabled, trial_mode')
      .eq('id', body.orderId)
      .maybeSingle<{
        client_id: string
        client_ai_enabled: boolean | null
        trial_mode: boolean | null
      }>()
    if (ordErr || !ord) return jsonError('Тапсырыс табылмады', 404)
    if (ord.client_id !== userId) return jsonError('Қол жеткізу жоқ', 403)
    const aiOkForBook = ord.client_ai_enabled === true || ord.trial_mode === true
    if (!aiOkForBook) {
      return jsonError(
        'Бұл кітап үшін AI қолжетімді емес. Админ немесе менеджер рұқсат беруі керек.',
        403,
      )
    }

    const admin = createServiceAdmin()
    if (!admin) {
      return jsonError('ЖИ лимиті тексерілімді — серверлік кілт бапталмаған (қолдауға жазыңыз).', 503)
    }

    const trialActive = ord.trial_mode === true
    const parsedKey = blockKeySchema.safeParse(body.blockKey.trim())
    if (!parsedKey.success) {
      return jsonError(parsedKey.error.issues[0]?.message ?? 'blockKey қате', 400)
    }

    blockKeyLogged = parsedKey.data

    try {
      const g = await gateClientBlockQuota(admin, body.orderId, blockKeyLogged, trialActive)
      if (!g.ok) {
        return NextResponse.json(
          { error: g.message, quotaExceeded: true, resetsAt: g.resetsAtIso ?? null },
          { status: 429 },
        )
      }
      gateResult = g
    } catch (err) {
      console.error('[api/ai/enhance] gateClientBlockQuota', err)
      return jsonError('ЖИ лимитін тексеру кезінде қате', 500)
    }
  }

  const inputPlain = body.text?.trim() ? body.text : htmlToPlainTextWithParagraphs(body.html ?? '')
  const trimmed = inputPlain.trim()

  if (!trimmed) return jsonError('Мәтін бос', 400)
  if (trimmed.length > AI_ENHANCE_MAX_INPUT_CHARS) {
    return jsonError(`Мәтін тым ұзын (${trimmed.length}/${AI_ENHANCE_MAX_INPUT_CHARS})`, 413)
  }

  const source = body.source ?? 'answer'
  const orderId = body.orderId ?? null
  const mode: KazakhEnhancementMode = body.mode ?? 'polish'
  const apiKey = process.env.GEMINI_API_KEY ?? ''

  let polished = ''
  let success = false
  let errorMessage: string | null = null
  let httpStatus = 200

  try {
    polished = await geminiPolishText({
      apiKey,
      systemPrompt: systemPromptForEnhancementMode(mode),
      userText: trimmed,
      temperature: temperatureForEnhancementMode(mode),
    })
    success = true
  } catch (err) {
    if (err instanceof GeminiError) {
      errorMessage = err.message
      httpStatus = [400, 413, 422, 429].includes(err.status) ? err.status : 502
    } else if (err instanceof Error) {
      errorMessage = err.message
      httpStatus = 502
    } else {
      errorMessage = 'Unknown error'
      httpStatus = 502
    }
  }

  const processingMs = Date.now() - startedAt
  const wordsBefore = countWords(trimmed)
  const wordsAfter = countWords(polished)

  const admin = createServiceAdmin()
  if (admin) {
    void admin
      .from('ai_enhancement_logs')
      .insert({
        editor_id: userId,
        order_id: orderId,
        block_key: blockKeyLogged,
        source,
        enhancement_mode: mode,
        words_before: wordsBefore,
        words_after: wordsAfter,
        chars_before: trimmed.length,
        chars_after: polished.length,
        processing_ms: processingMs,
        success,
        error_message: errorMessage,
        model: GEMINI_MODEL,
      })
      .then(() => undefined, () => undefined)
  }

  if (!success) {
    return jsonError(errorMessage ?? 'AI қызметі қол жетімсіз', httpStatus)
  }

  type QuotaJson = {
    remaining: number
    limit: number
    resetsAt: string | null
    tier: 'trial' | 'full'
  }

  let quota: QuotaJson | undefined

  if (gateResult?.ok && orderId && blockKeyLogged) {
    const remainingAfter = Math.max(0, gateResult.limit - gateResult.usedBefore - 1)
    let resetsAt: string | null = null
    if (!gateResult.trial && remainingAfter === 0 && gateResult.paidWindowStartIso) {
      const paidWindowMs = AI_CLIENT_PAID_WINDOW_MINUTES * 60 * 1000
      const adm = admin ?? createServiceAdmin()
      if (adm) {
        try {
          const earliest = await earliestSuccessCreatedAtInWindow(
            adm,
            orderId,
            blockKeyLogged,
            gateResult.paidWindowStartIso,
          )
          if (earliest)
            resetsAt = new Date(new Date(earliest).getTime() + paidWindowMs).toISOString()
        } catch {
          resetsAt = null
        }
      }
    }

    quota = {
      remaining: remainingAfter,
      limit: gateResult.limit,
      resetsAt,
      tier: gateResult.trial ? 'trial' : 'full',
    }
  }

  return NextResponse.json({
    text: polished,
    html: plainTextToParagraphHtml(polished),
    wordsBefore,
    wordsAfter,
    processingMs,
    ...(quota ? { quota } : {}),
  })
}
