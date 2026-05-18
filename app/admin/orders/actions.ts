'use server'

import { fetchOrderBookProgressMap } from '@/lib/admin/fetchOrderBookProgress'
import type { OrderProgress } from '@/lib/admin/orderBookProgress'
import { requireAdminOrManager } from '@/lib/auth/requireStaff'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

function makeServiceClient() {
  const r = createValidatedServiceRoleClient()
  if (!r.ok) return { client: null, error: r.error }
  return { client: r.client, error: null }
}

/**
 * Bypass RLS so admins/managers can move orders between statuses.
 * Caller must be `admin` or `manager` (verified before service role is used).
 */
export async function adminUpdateOrderStatus(orderId: string, status: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  const { error } = await (admin as any).from('orders').update({ status }).eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function adminSetOrderClientAiEnabled(orderId: string, enabled: boolean) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }

  const { error } = await admin.from('orders').update({ client_ai_enabled: !!enabled }).eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function adminDeleteOrder(orderId: string) {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { error: keyErr }
  const { error } = await admin.from('orders').delete().eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true as const }
}

type OrderProgressInput = { id: string; category_id: string | null | undefined }

/** Server fallback when client-side staff queries are blocked. */
export async function adminFetchOrderProgressMap(
  orders: OrderProgressInput[],
): Promise<{ progress: Record<string, OrderProgress>; error?: string }> {
  const gate = await requireAdminOrManager()
  if (!gate.ok) return { progress: {}, error: gate.error }

  const { client: admin, error: keyErr } = makeServiceClient()
  if (!admin) return { progress: {}, error: keyErr }

  return fetchOrderBookProgressMap(admin, orders)
}
