import { NextRequest, NextResponse } from 'next/server'

import { STORAGE_BUCKET_BOOK_PHOTOS } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

export const dynamic = 'force-dynamic'

/**
 * Streams a `book-photos` object. Auth is verified via the caller's session cookie;
 * ownership is checked against `orders.client_id`. The actual Storage download uses
 * the service-role client so it bypasses Storage RLS — which lets it work even before
 * the bucket SELECT policies are fully propagated on the Supabase project.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  const key = typeof path === 'string' ? path.trim() : ''
  if (
    !key ||
    key.includes('..') ||
    key.startsWith('/') ||
    key.startsWith('\\') ||
    key.length > 2000
  ) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller owns the order whose id is the first path segment, or is staff.
  const orderId = key.split('/')[0] ?? ''
  if (!orderId) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data: ownedOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('client_id', user.id)
    .maybeSingle()

  if (!ownedOrder) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('id', user.id)
      .maybeSingle()
    const staffRoles = ['admin', 'editor', 'manager']
    if (!profile || !staffRoles.includes(profile.user_role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Use service-role client for the actual download — bypasses Storage RLS so the
  // route works even when bucket SELECT policies have not been applied yet.
  const adminResult = createValidatedServiceRoleClient()
  const downloadClient = adminResult.ok ? adminResult.client : supabase

  const { data: blob, error } = await downloadClient.storage
    .from(STORAGE_BUCKET_BOOK_PHOTOS)
    .download(key)
  if (error || !blob) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[api/book-photo] download failed:', key.slice(0, 100), error?.message)
    }
    return NextResponse.json(
      { error: error?.message ?? 'Forbidden or not found' },
      { status: 403 }
    )
  }

  const buf = await blob.arrayBuffer()
  const type = blob.type && blob.type.length > 0 ? blob.type : 'application/octet-stream'
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=120',
    },
  })
}
