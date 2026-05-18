'use server'

import { revalidatePath } from 'next/cache'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

export async function approveReview(id: string): Promise<void> {
  const init = createValidatedServiceRoleClient()
  if (!init.ok) throw new Error(init.error)

  const { error } = await init.client
    .from('product_reviews')
    .update({ is_published: true, is_rejected: false })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/reviews')
  revalidatePath('/feedback')
}

export async function rejectReview(id: string): Promise<void> {
  const init = createValidatedServiceRoleClient()
  if (!init.ok) throw new Error(init.error)

  const { error } = await init.client
    .from('product_reviews')
    .update({ is_published: false, is_rejected: true })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/reviews')
  revalidatePath('/feedback')
}

export async function unrejectReview(id: string): Promise<void> {
  const init = createValidatedServiceRoleClient()
  if (!init.ok) throw new Error(init.error)

  const { error } = await init.client
    .from('product_reviews')
    .update({ is_rejected: false })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/reviews')
}

export async function deleteReview(id: string): Promise<void> {
  const init = createValidatedServiceRoleClient()
  if (!init.ok) throw new Error(init.error)

  const { error } = await init.client
    .from('product_reviews')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/reviews')
  revalidatePath('/feedback')
}
