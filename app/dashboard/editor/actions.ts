'use server'

import { createClient } from '@/lib/supabase/server'

/** Marks that the client opened the trial WhatsApp link (first interaction only updates the row). */
export async function recordTrialWhatsappClick(orderId: string) {
  if (!orderId) return { error: 'orderId қажет' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Жүйеге кіріңіз' }

  const { error } = await supabase
    .from('orders')
    .update({ trial_whatsapp_clicked_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('client_id', user.id)
    .is('trial_whatsapp_clicked_at', null)

  if (error) return { error: error.message }
  return {}
}
