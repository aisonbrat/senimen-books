#!/usr/bin/env node
/**
 * Delete all users except those with role `admin` in `public.profiles`.
 *
 * Stack: Supabase (PostgreSQL + Auth + Storage).
 *
 * What it does (when run with --execute):
 *  1. Finds profile IDs where role IS DISTINCT FROM 'admin'.
 *  2. Clears FK references on orders (assigned_editor / assigned_designer) — otherwise PG blocks deletes.
 *  3. Collects storage object keys under bucket `book-photos` for orders owned by those clients
 *     (answers.photo_path, custom_pages.photo_path pipe-lists, orders faktiler/admin cover,
 *     order_chapter_fixed_photos.photo_path).
 *  4. Removes those objects from Storage (best-effort; missing keys ignored).
 *  5. Deletes each user via Auth Admin API → cascades public.profiles, profile_phones, client orders,
 *     answers, custom_pages, ai_enhancement_logs for editors, etc. (per your migrations).
 *
 * Usage:
 *   node scripts/delete-non-admin-users.mjs                  # dry-run (default)
 *   node scripts/delete-non-admin-users.mjs --execute        # perform deletes
 *
 * Env (required):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service_role — never commit)
 *
 * Optional: load from repo root .env.local when present (simple KEY=VAL parser).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUCKET = 'book-photos'

function loadDotEnvLocal() {
  const root = join(__dirname, '..')
  const p = join(root, '.env.local')
  if (!existsSync(p)) return
  const raw = readFileSync(p, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function splitPipe(s) {
  if (!s || typeof s !== 'string') return []
  return s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Keep only plausible storage keys for book-photos (not full URLs we can't delete by key). */
function normalizeStorageKey(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s)
      const mark = `/object/public/${BUCKET}/`
      const markSign = `/object/sign/${BUCKET}/`
      let pathPart = ''
      if (u.pathname.includes(mark)) pathPart = u.pathname.split(mark)[1]
      else if (u.pathname.includes(markSign)) pathPart = u.pathname.split(markSign)[1]
      if (pathPart) return decodeURIComponent(pathPart.split('?')[0])
    } catch {
      return null
    }
    return null
  }
  if (s.includes('<') && s.includes('>')) return null
  if (!s.includes('/')) return null
  return s.replace(/^\/+/, '')
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))]
}

async function main() {
  loadDotEnvLocal()

  const execute = process.argv.includes('--execute')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profiles, error: pe } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .neq('role', 'admin')

  if (pe) {
    console.error('Failed to list profiles:', pe.message)
    process.exit(1)
  }

  const targets = profiles ?? []
  if (targets.length === 0) {
    console.log('No non-admin profiles found. Nothing to do.')
    return
  }

  const targetIds = targets.map((p) => p.id)
  console.log(`Found ${targetIds.length} non-admin profile(s).`)

  if (!execute) {
    console.log('\nDry run. Sample (up to 15):')
    targets.slice(0, 15).forEach((p) => console.log(`  - ${p.id}  role=${p.role}  ${p.full_name || ''}`))
    if (targets.length > 15) console.log(`  ... and ${targets.length - 15} more`)
    console.log('\nRe-run with --execute to unassign orders, delete storage objects, and delete auth users.')
    return
  }

  // 1) Clear optional FKs on orders (no ON DELETE on assigned_* in schema — defaults to NO ACTION)
  const { error: u1 } = await supabase.from('orders').update({ assigned_editor: null }).in('assigned_editor', targetIds)
  if (u1) console.warn('Warning clearing assigned_editor:', u1.message)
  const { error: u2 } = await supabase.from('orders').update({ assigned_designer: null }).in('assigned_designer', targetIds)
  if (u2) console.warn('Warning clearing assigned_designer:', u2.message)

  // 2) Orders that will disappear when we delete the client user (client_id -> profiles CASCADE)
  const { data: clientOrders, error: oe } = await supabase.from('orders').select('id').in('client_id', targetIds)
  if (oe) {
    console.error('Failed to list client orders:', oe.message)
    process.exit(1)
  }
  const orderIds = (clientOrders ?? []).map((r) => r.id)
  console.log(`Orders owned by deleted clients: ${orderIds.length}`)

  const keys = []

  if (orderIds.length > 0) {
    const [{ data: ans }, { data: cpg }, { data: ordRows }, { data: fixed }] = await Promise.all([
      supabase.from('answers').select('photo_path').in('order_id', orderIds),
      supabase.from('custom_pages').select('photo_path').in('order_id', orderIds),
      supabase
        .from('orders')
        .select('id, faktiler_photo_path, admin_cover_print_path')
        .in('id', orderIds),
      supabase.from('order_chapter_fixed_photos').select('photo_path').in('order_id', orderIds),
    ])

    for (const row of ans ?? []) {
      for (const seg of splitPipe(row.photo_path)) {
        const k = normalizeStorageKey(seg)
        if (k) keys.push(k)
      }
    }
    for (const row of cpg ?? []) {
      for (const seg of splitPipe(row.photo_path)) {
        const k = normalizeStorageKey(seg)
        if (k) keys.push(k)
      }
    }
    for (const row of ordRows ?? []) {
      for (const seg of splitPipe(row.faktiler_photo_path)) {
        const k = normalizeStorageKey(seg)
        if (k) keys.push(k)
      }
      for (const seg of splitPipe(row.admin_cover_print_path)) {
        const k = normalizeStorageKey(seg)
        if (k) keys.push(k)
      }
    }
    for (const row of fixed ?? []) {
      const k = normalizeStorageKey(row.photo_path)
      if (k) keys.push(k)
    }
  }

  const uniqueKeys = dedupe(keys)
  console.log(`Storage objects to remove (unique keys): ${uniqueKeys.length}`)

  const chunkSize = 90
  for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
    const chunk = uniqueKeys.slice(i, i + chunkSize)
    const { error: se } = await supabase.storage.from(BUCKET).remove(chunk)
    if (se) console.warn(`Storage remove chunk ${i / chunkSize + 1}:`, se.message)
  }

  // 3) Delete auth users (profile + dependent rows cascade / already cleared)
  let ok = 0
  let failed = 0
  for (const id of targetIds) {
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      console.error(`deleteUser ${id}:`, error.message)
      failed++
    } else {
      ok++
    }
  }

  console.log(`\nDone. Deleted auth users: ${ok}, failed: ${failed}`)
  if (failed) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
