import type { SupabaseClient } from '@supabase/supabase-js'

import {
  computeOrderProgress,
  isAnswerRowFilled,
  type AnswerProgressRow,
  type OrderProgress,
} from '@/lib/admin/orderBookProgress'
import { ANSWERS_PROGRESS_SELECT } from '@/lib/supabase/querySelects'

export type OrderProgressInput = { id: string; category_id: string | null | undefined }

const ANSWERS_PAGE_SIZE = 1000

function asQuestionList(raw: unknown): { id: string }[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((q): q is { id: string } => !!q && typeof q.id === 'string')
  if (typeof raw === 'object' && raw !== null && 'id' in raw && typeof (raw as { id: unknown }).id === 'string') {
    return [{ id: String((raw as { id: string }).id) }]
  }
  return []
}

/** Same chapter/question load as admin PDF helper — avoids brittle nested PostgREST embeds. */
async function loadQuestionIdsByCategory(
  supabase: SupabaseClient,
  categoryIds: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  await Promise.all(
    categoryIds.map(async (categoryId) => {
      // Match `fetchOrderData` in admin orders — known-good embed shape for this project.
      const { data: chaptersData, error } = await supabase
        .from('chapters')
        .select('id, part_kind, questions(id)')
        .eq('category_id', categoryId)

      if (error) {
        throw error
      }

      const ids = new Set<string>()
      for (const ch of chaptersData || []) {
        const row = ch as { part_kind?: string; questions?: unknown }
        const partKind = row.part_kind === 'faktiler' ? 'faktiler' : 'standard'
        if (partKind === 'faktiler') continue
        for (const q of asQuestionList(row.questions)) ids.add(q.id)
      }
      map.set(categoryId, ids)
    }),
  )
  return map
}

async function loadAnswersForOrders(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<AnswerProgressRow[]> {
  if (orderIds.length === 0) return []

  const all: AnswerProgressRow[] = []
  let from = 0
  while (true) {
    const to = from + ANSWERS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('answers')
      .select(ANSWERS_PROGRESS_SELECT)
      .in('order_id', orderIds)
      .range(from, to)

    if (error) throw error
    const batch = (data || []) as AnswerProgressRow[]
    all.push(...batch)
    if (batch.length < ANSWERS_PAGE_SIZE) break
    from += ANSWERS_PAGE_SIZE
  }
  return all
}

/**
 * Batched book progress for admin order list (staff Supabase client / RLS).
 */
export async function fetchOrderBookProgressMap(
  supabase: SupabaseClient,
  orders: OrderProgressInput[],
): Promise<{ progress: Record<string, OrderProgress>; error?: string }> {
  try {
    const uniqueOrders = orders.filter((o) => o.id && o.category_id)
    if (uniqueOrders.length === 0) return { progress: {} }

    const orderIds = [...new Set(uniqueOrders.map((o) => o.id))]
    const categoryIds = [...new Set(uniqueOrders.map((o) => String(o.category_id)))]

    const questionIdsByCategory = await loadQuestionIdsByCategory(supabase, categoryIds)
    const answerRows = await loadAnswersForOrders(supabase, orderIds)

    const progress: Record<string, OrderProgress> = {}
    for (const order of uniqueOrders) {
      const catId = String(order.category_id)
      const questionSet = questionIdsByCategory.get(catId) ?? new Set<string>()
      const total = questionSet.size
      let answered = 0
      for (const row of answerRows) {
        if (row.order_id !== order.id) continue
        if (!questionSet.has(String(row.question_id))) continue
        if (isAnswerRowFilled(row)) answered++
      }
      progress[order.id] = computeOrderProgress(answered, total)
    }

    return { progress }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Progress load failed'
    return { progress: {}, error: message }
  }
}
