-- Fix "infinite recursion detected in policy for relation 'profiles'":
-- `Staff read directory profiles` must not use a plain `EXISTS (SELECT … FROM profiles …)` —
-- that re-enters RLS on `profiles`. Use `is_staff()` (SECURITY DEFINER) instead, and a
-- definer helper for admin/manager checks on `profile_phones`.

begin;

create or replace function public.actor_is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text in ('admin', 'manager')
  );
$$;

grant execute on function public.actor_is_admin_or_manager() to authenticated;

drop policy if exists "profile_phones_select_own_or_admin_manager" on public.profile_phones;
create policy "profile_phones_select_own_or_admin_manager"
  on public.profile_phones for select to authenticated
  using (
    profile_id = auth.uid()
    or public.actor_is_admin_or_manager()
  );

drop policy if exists "profile_phones_update_admin_manager" on public.profile_phones;
create policy "profile_phones_update_admin_manager"
  on public.profile_phones for update to authenticated
  using (public.actor_is_admin_or_manager())
  with check (true);

drop policy if exists "profile_phones_insert_admin_manager" on public.profile_phones;
create policy "profile_phones_insert_admin_manager"
  on public.profile_phones for insert to authenticated
  with check (public.actor_is_admin_or_manager());

drop policy if exists "Staff read directory profiles" on public.profiles;
create policy "Staff read directory profiles"
  on public.profiles for select to authenticated
  using (public.is_staff());

commit;
