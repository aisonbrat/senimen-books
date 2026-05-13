'use server'

import { createClient } from '@/lib/supabase/server'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

/**
 * Editors complete work → status `completed` in DB (service role; avoids RLS blocking client updates).
 * Only `editor` or `admin` profiles may call this (verified with the user session, not via admin server actions).
 */
export async function completeEditorOrder(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Кіру қажет' }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr || !profile) return { error: 'Профиль табылмады' }
  if (profile.role !== 'editor' && profile.role !== 'admin') {
    return { error: 'Тек редактор немесе әкімші бұл әрекетті орындай алады' }
  }

  const adminInit = createValidatedServiceRoleClient()
  if (!adminInit.ok) return { error: adminInit.error }

  const { error } = await adminInit.client.from('orders').update({ status: 'completed' }).eq('id', orderId)
  if (error) return { error: error.message }
  return { success: true as const }
}
