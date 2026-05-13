-- Split phone off `profiles` so editors/designers can list users without reading phone numbers.

begin;

-- ── profile_phones ───────────────────────────────────────────────────────────
create table if not exists public.profile_phones (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profile_phones (profile_id, phone)
select p.id, p.phone
from public.profiles p
where exists (
  select 1
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'phone'
)
on conflict (profile_id) do update
set phone = coalesce(excluded.phone, profile_phones.phone),
    updated_at = now();

insert into public.profile_phones (profile_id, phone)
select p.id, null::text
from public.profiles p
where not exists (select 1 from public.profile_phones pp where pp.profile_id = p.id);

alter table public.profiles drop column if exists phone;

create unique index if not exists profile_phones_phone_lower_unique
  on public.profile_phones (lower(trim(phone)))
  where phone is not null and trim(phone) <> '';

create trigger profile_phones_updated_at
  before update on public.profile_phones
  for each row execute procedure public.set_updated_at();

create or replace function public.profile_phones_ensure_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_phones (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tr_profile_phones_after_profile_insert on public.profiles;
create trigger tr_profile_phones_after_profile_insert
  after insert on public.profiles
  for each row execute procedure public.profile_phones_ensure_row();

-- Caller role for RLS policies (must NOT subquery `profiles` from a `profiles` policy — infinite recursion).
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

-- Backfill any legacy rows missing a child row (defensive)
insert into public.profile_phones (profile_id)
select p.id from public.profiles p
where not exists (select 1 from public.profile_phones pp where pp.profile_id = p.id)
on conflict (profile_id) do nothing;

alter table public.profile_phones enable row level security;

grant select, insert, update, delete on table public.profile_phones to authenticated;
grant all on table public.profile_phones to service_role;

drop policy if exists "profile_phones_select_own_or_admin_manager" on public.profile_phones;
create policy "profile_phones_select_own_or_admin_manager"
  on public.profile_phones for select to authenticated
  using (
    profile_id = auth.uid()
    or public.actor_is_admin_or_manager()
  );

drop policy if exists "profile_phones_update_own" on public.profile_phones;
create policy "profile_phones_update_own"
  on public.profile_phones for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "profile_phones_update_admin_manager" on public.profile_phones;
create policy "profile_phones_update_admin_manager"
  on public.profile_phones for update to authenticated
  using (public.actor_is_admin_or_manager())
  with check (true);

drop policy if exists "profile_phones_insert_own" on public.profile_phones;
create policy "profile_phones_insert_own"
  on public.profile_phones for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "profile_phones_insert_admin_manager" on public.profile_phones;
create policy "profile_phones_insert_admin_manager"
  on public.profile_phones for insert to authenticated
  with check (public.actor_is_admin_or_manager());

-- ── profiles: remove broad staff phone access (phone column is gone) ─────────
drop policy if exists "Staff can view all profiles" on public.profiles;

drop policy if exists "Staff read directory profiles" on public.profiles;
create policy "Staff read directory profiles"
  on public.profiles for select to authenticated
  using (public.is_staff());

-- book-photos: current migrations only attach authenticated policies (see 20260625120000_*).
-- If your project ever added a custom anon policy on storage.objects, drop it manually in SQL.

commit;
