/**
 * Browser-side fetch helper for the editor "Әрлеу" button.
 * Server-side auth/role check + Gemini call lives in `app/api/ai/enhance/route.ts`.
 */

export type EnhanceMode = 'grammar' | 'polish' | 'literary'

export type AiEnhanceQuota = {
  remaining: number
  limit: number
  resetsAt: string | null
  tier: 'trial' | 'full'
}

export interface EnhanceResult {
  text: string
  html: string
  wordsBefore: number
  wordsAfter: number
  processingMs: number
  quota?: AiEnhanceQuota
}

export interface EnhanceParams {
  html?: string
  text?: string
  source?: 'answer' | 'algy' | 'hat' | 'custom_text' | 'overlay'
  orderId?: string
  /** Block id for per-section client quotas; optional for staff flows. */
  blockKey?: string
  /** Defaults to `polish` (Әрлеу). */
  mode?: EnhanceMode
  signal?: AbortSignal
}

/** Failed enhance request — includes HTTP status (use 429 for quota). */
export class EnhanceRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'EnhanceRequestError'
    this.status = status
  }
}

export async function enhanceTextWithAi(params: EnhanceParams): Promise<EnhanceResult> {
  const res = await fetch('/api/ai/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: params.html,
      text: params.text,
      source: params.source ?? 'answer',
      orderId: params.orderId,
      blockKey: params.blockKey,
      mode: params.mode ?? 'polish',
    }),
    signal: params.signal,
  })

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const msg =
      (payload as { error?: string } | null)?.error ?? `AI қызметінде қате (${res.status})`
    throw new EnhanceRequestError(msg, res.status)
  }

  const p =
    (payload as Partial<EnhanceResult> & { quota?: Partial<AiEnhanceQuota> | null }) ?? {}
  if (!p.text || !p.html) {
    throw new Error('Жауап бос келді')
  }

  let quota: AiEnhanceQuota | undefined
  if (
    p.quota &&
    typeof p.quota.remaining === 'number' &&
    typeof p.quota.limit === 'number' &&
    (p.quota.tier === 'trial' || p.quota.tier === 'full')
  ) {
    quota = {
      remaining: p.quota.remaining,
      limit: p.quota.limit,
      resetsAt: p.quota.resetsAt ?? null,
      tier: p.quota.tier,
    }
  }

  return {
    text: String(p.text),
    html: String(p.html),
    wordsBefore: Number(p.wordsBefore ?? 0),
    wordsAfter: Number(p.wordsAfter ?? 0),
    processingMs: Number(p.processingMs ?? 0),
    ...(quota ? { quota } : {}),
  }
}
