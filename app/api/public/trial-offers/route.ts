import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createValidatedServiceRoleClient } from '@/lib/supabase/serviceRoleClient'

export const runtime = 'nodejs'

export type PublicTrialOffer = {
  id: string
  title_kk: string
  description_kk: string | null
}

function mergeTrialOffers(
  trialRows: { category_id: unknown }[] | null,
  catRows: { id: unknown; title_kk: unknown; description_kk: unknown }[] | null,
): PublicTrialOffer[] {
  const byId = new Map(
    (catRows ?? []).map((c) => [
      String(c.id),
      {
        id: String(c.id),
        title_kk: String(c.title_kk ?? ''),
        description_kk: (typeof c.description_kk === 'string' ? c.description_kk : null) as string | null,
      },
    ]),
  )

  const offers: PublicTrialOffer[] = []
  const seen = new Set<string>()
  for (const row of trialRows ?? []) {
    const id = typeof row.category_id === 'string' ? row.category_id : null
    if (!id || seen.has(id)) continue
    const c = byId.get(id)
    if (!c?.title_kk) continue
    seen.add(id)
    offers.push(c)
  }
  return offers
}

/**
 * Catalog of category templates eligible for client self-start (trial).
 * Prefers anonymous Supabase (no service key); falls back to service_role if old DB without anon policies.
 */
export async function GET() {
  const supabase = await createClient()
  const [trialRes, catRes] = await Promise.all([
    supabase.from('trial_global_categories').select('category_id, created_at').order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, title_kk, description_kk, is_active')
      .eq('is_active', true),
  ])

  if (!trialRes.error && !catRes.error) {
    const offers = mergeTrialOffers(trialRes.data, catRes.data)
    return NextResponse.json(
      { ok: true, offers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    )
  }

  console.warn(
    '[api/public/trial-offers] anon read failed, falling back to service_role',
    trialRes.error?.message ?? trialRes.error,
    catRes.error?.message ?? catRes.error,
  )

  const init = createValidatedServiceRoleClient()
  if (!init.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Үлгілерді жүктеу мүмкін болмады. Дерекқорға жария каталог саясаты қосылғанын тексеріңіз немесе серверде SUPABASE_SERVICE_ROLE_KEY болсын.',
        offers: [] satisfies PublicTrialOffer[],
        detail: process.env.NODE_ENV === 'development' ? init.error : undefined,
      },
      { status: 503 },
    )
  }

  const admin = init.client
  const [t2, c2] = await Promise.all([
    admin.from('trial_global_categories').select('category_id, created_at').order('created_at', { ascending: true }),
    admin.from('categories').select('id, title_kk, description_kk, is_active').eq('is_active', true),
  ])

  if (t2.error || c2.error) {
    console.error('[api/public/trial-offers] service_role', t2.error, c2.error)
    return NextResponse.json(
      { ok: false, error: 'Үлгілерді жүктеу мүмкін болмады', offers: [] satisfies PublicTrialOffer[] },
      { status: 500 },
    )
  }

  const offers = mergeTrialOffers(t2.data, c2.data)
  return NextResponse.json(
    { ok: true, offers },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  )
}
