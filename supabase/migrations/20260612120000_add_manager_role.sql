-- Adds the new "manager" user role.
--
-- Managers can:
--   * create and remove client (book recipient) accounts,
--   * grant a client access to a book type (= create an order for that category),
--   * revoke access (= delete the order),
--   * remove the client account itself.
--
-- They CANNOT create other managers / editors / admins. That is enforced in
-- the server-action layer (`app/manager-dashboard/actions.ts`).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- About this migration
-- ─────────────────────────────────────────────────────────────────────────────
-- `alter type … add value` is only valid outside a transaction block on
-- Postgres < 12, and inside a transaction on Postgres ≥ 12 only if the new
-- value is **not referenced by literal** elsewhere in the same transaction.
-- Supabase runs PG 15+, but we still avoid using the literal `'manager'`
-- against `user_role` later in this file. The `is_staff()` rewrite below
-- compares against `role::text`, so the migration is safe to apply atomically.

alter type user_role add value if not exists 'manager';

-- Managers are staff for RLS purposes: they need to read profiles + orders
-- to manage clients. Cast role to text so the new enum value can be referenced
-- in the same transaction it was added in.
create or replace function is_staff()
returns boolean language sql security definer as $$
  select exists (
    select 1
      from profiles
     where id = auth.uid()
       and role::text in ('admin', 'editor', 'designer', 'manager')
  );
$$;
