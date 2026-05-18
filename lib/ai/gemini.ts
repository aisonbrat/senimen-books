/**
 * Tiny fetch-based wrapper around Gemini Flash. No SDK so we stay on the free tier
 * with zero dependency surface and avoid Node version coupling.
 *
 * Set `GEMINI_API_KEY` (server-only) in `.env.local`. Free tier rate-limit at time of
 * writing (Gemini 2.5 Flash): ~10 RPM / 250 RPD — enough for the editor "Әрлеу" button.
 *
 * Note on the model: Google retired `gemini-1.5-flash-latest` from `v1beta` in 2025.
 * `gemini-2.5-flash` is the cheapest Flash that still has good multilingual quality.
 * It exposes hidden "thinking" tokens that eat the output budget on short prompts,
 * so we explicitly set `thinkingConfig.thinkingBudget = 0`.
 */

export const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/**
 * Canonical Senimen Books "Әрлеу" prompt. Standardised across every book — every
 * `/api/ai/enhance` call sends this string verbatim as the Gemini `systemInstruction`.
 */
export const KAZAKH_EDITOR_PROMPT = `Сен — Senimen Books баспасының бас редакторысың. Сенің міндетің — қолданушының естеліктерін кәсіби кітап деңгейіне жеткізу.

МІНДЕТТІ ШАРТ: Ешқашан мәтінді басқа тілге аударма. Кіріс мәтін қай тілде (Қазақша немесе Орысша) жазылса, дәл сол тілдің грамматикалық, пунктуациялық және орфографиялық ережелеріне сай өңдеп бер. Сөздердің орындарын, мағынасын, структурасын ауыстырма. Арасында дұрыс емес құраған сөйлемдер болса түзеп жібер.

Тіл: Тек мәтін жазылған тілде жауап бер (Қазақша кірсе — тек қазақша өңде, Орысша кірсе — тек орысша өңде). Аударма жасауға қатаң тыйым салынады.

Түзету: Тіл ережелеріне сай грамматика мен пунктуацияны міндетті түрде түзе, бірақ автордың негізгі ойын, фактілерін (есімдер, даталар) өзгертпе.

Формат: Тек өңделген мәтінді қайтар. Ешқандай 'Міне, түзетілген нұсқа' немесе 'Түзеулер дайын' деген артық сөз қоспа.

Параграф құрылымы: Кіріс мәтінде N абзац болса, шығыста дәл сонша абзац болуы керек — әр абзац арасы бір бос жолмен бөлінеді. Бір абзацты екіге бөлме, екі абзацты біріктірме, бос абзацтарды басына, ортасына немесе соңына қоспа.`

/** «Қателерін түзеу» — looks non-AI; strict grammar/punctuation/spelling only. */
export const KAZAKH_GRAMMAR_ONLY_PROMPT = `Сен — Senimen Books баспасының корректорысың. Берілген мәтінді өз тілінің (Қазақ немесе Орыс тілінің) пунктуациялық, орфографиялық және грамматикалық ережелеріне сәйкес өңде.

ҚАТАҢ ШЕКТЕУ: Мәтінді ешқашан басқа тілге аударма! Орысша мәтінді тек орыс тілінің ережесімен, қазақша мәтінді тек қазақ тілінің ережесімен түзе. Мәтін мағынасын өзгертпе.

Тіл: Кіріс мәтін қай тілде болса, тек сол тілде жауап бер.

Түзету: Тек пунктуация, орфография және грамматика. Сөйлем құрылымын, сөз тіркесін, ойды, эмоциялық реңкті өзгертпе. Фактілерді (есімдер, даталар, орындар) өзгертпе.

Формат: Тек өңделген мәтінді қайтар. Ешқандай түсініктеме, тақырып немесе «Міне нәтиже» деген қосымша сөздер қоспа.

Параграф құрылымы: Кіріс мәтінде N абзац болса, шығыста дәл сонша абзац болуы керек — әр абзац арасы бір бос жолмен бөлінеді. Бір абзацты екіге бөлме, екі абзацты біріктірме, бос абзацтарды басына, ортасына немесе соңына қоспа.`

/** «Әрлеу» — stylistic polish while preserving voice and facts. */
export const KAZAKH_POLISH_PROMPT = `Сен — Senimen Books баспасының кәсіби мәтін өңдеушісісің (Редактор/Стилист).
Мақсат — естелік мәтінін кітап бетіне ыңғайлы, оқуға жеңіл, әдемірек етіп шығару.

ҚАТАҢ ШЕКТЕУ / СТРОГОЕ ОГРАНИЧЕНИЕ: 
НЕ ПЕРЕВОДИТЬ ТЕКСТ! Если текст на русском, делай стилистическую правку НА РУССКОМ языке. Егер мәтін қазақша болса, НА КАЗАХСКОМ языке. Перевод на другой язык категорически запрещен.

Міндеттер / Задачи:
- Мәтін жазылған тілдің (Қазақ немесе Орыс) грамматика, пунктуация және орфографиясын түзе (Исправь ошибки).
- Қайталанатын сөздерді азайтпай, қайталану мәнсіз болса ғана жеңіл түрде әрлендір (Улучши читаемость).
- Сөйлем ұзындығын оқу ыңғайы үшін жеңілдет (мағына мен автор даусын сақта / Сохраняй голос автора).
- Тіркестерді табиғирақ ет, бірақ сөйлеу стилін толық «басқа адамға» айналдырма.

Шектеулер: Оқиға, дата, есім, орын сияқты фактілерді өзгертпе. Жаңа ой немесе ойдан ой қоспа.
Тіл: Тек мәтін жазылған түпнұсқа тілінде жауап бер.
Формат: Тек өңделген мәтінді қайтар. Ешқандай түсініктеме қоспа.

Параграф құрылымы: Кіріс мәтінде N абзац болса, шығыста дәл сонша абзац болуы керек — әр абзац арасы бір бос жолмен бөлінеді.`

/** «Әдеби ету» — stronger literary shaping; still memoir-true. */
export const KAZAKH_LITERARY_PROMPT = `Сен — Senimen Books баспасының әдеби редакторысың (Литературный редактор). 
Мәтінді әдеби естелік стиліне жақындат: ритм, бояу, сөйлем үндестігі, оқырманға әсер ететін бірыңғай үн.

ҚАТАҢ ШЕКТЕУ / СТРОГОЕ ОГРАНИЧЕНИЕ: 
НИКОГДА НЕ ПЕРЕВОДИТЬ НА ДРУГОЙ ЯЗЫК! Если на входе русский текст — сделай его художественным и литературным НА РУССКОМ ЯЗЫКЕ. Егер қазақша мәтін болса — ҚАЗАҚ ТІЛІНДЕ көркемде. Перевод является грубой ошибкой.

Міндеттер / Задачи:
- Сөйлем құрылымын әдебирек құра: қысқа дауыс пен ұзын дауыс алмасуы, тыныс белгілерімен дем алу (Сделай слог художественным).
- Таңдаулы сөздер мен тіркестер арқылы бейнелілікті күшейт (бірақ мәнерлеуді шектен шығарма).
- Абзац ішіндегі ой ағынын нығайт, қайталану мен бос сөздерді азайт.
- Мәтін жазылған тілдің нормасына сәйкес грамматика мен пунктуацияны сапалы деңгейде түзе.

Қатаң шектеу: Жаңа оқиға, жаңа факт, жаңа дата немесе есім ойлап қоспа. Автордың айтқаны ғана қалуы керек — тек қалай айтылғанын әдебирек жетілдір.
Тіл: Тек мәтін жазылған тілде жауап бер.
Формат: Тек өңделген мәтінді қайтар. Ешқандай түсініктеме қоспа.

Параграф құрылымы: Кіріс мәтінде N абзац болса, шығыста дәл сонша абзац болуы керек — әр абзац арасы бір бос жолмен бөлінеді.`

export type KazakhEnhancementMode = 'grammar' | 'polish' | 'literary'

export function systemPromptForEnhancementMode(mode: KazakhEnhancementMode): string {
  if (mode === 'grammar') return KAZAKH_GRAMMAR_ONLY_PROMPT
  if (mode === 'literary') return KAZAKH_LITERARY_PROMPT
  return KAZAKH_POLISH_PROMPT
}

export function temperatureForEnhancementMode(mode: KazakhEnhancementMode): number {
  if (mode === 'grammar') return 0.12
  if (mode === 'literary') return 0.62
  return 0.38
}

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

interface GenerateOptions {
  apiKey: string
  systemPrompt: string
  userText: string
  /** Defaults match the user-facing "polish but don't rewrite" intent. */
  temperature?: number
  maxOutputTokens?: number
  abortSignal?: AbortSignal
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> }
  finishReason?: string
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
  promptFeedback?: { blockReason?: string }
}

export async function geminiPolishText(opts: GenerateOptions): Promise<string> {
  const { apiKey, systemPrompt, userText, temperature = 0.4, maxOutputTokens = 2048, abortSignal } = opts
  if (!apiKey) throw new GeminiError('AI service is not configured (missing GEMINI_API_KEY).', 500)
  if (!userText.trim()) throw new GeminiError('Empty text', 400)

  const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      candidateCount: 1,
      // 2.5 Flash hides multi-hundred-token "thinking" inside the output budget by default.
      // Disable it: we want the model to write the polished sentence directly.
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortSignal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message ? `: ${j.error.message}` : ''
    } catch {}
    throw new GeminiError(`Gemini ${res.status}${detail}`, res.status)
  }

  const data = (await res.json()) as GeminiResponse
  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(`Blocked by safety filter (${data.promptFeedback.blockReason}).`, 422)
  }
  const cand = data.candidates?.[0]
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text.trim()) {
    if (cand?.finishReason === 'MAX_TOKENS') {
      throw new GeminiError('Мәтін тым ұзын. Кішірек үзіндіге бөліп қайталап көріңіз.', 413)
    }
    if (cand?.finishReason === 'SAFETY') {
      throw new GeminiError('Қауіпсіздік сүзгісі бұғаттады.', 422)
    }
    throw new GeminiError('AI бос жауап қайтарды.', 502)
  }
  return text.trim()
}
