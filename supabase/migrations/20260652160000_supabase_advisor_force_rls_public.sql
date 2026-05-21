-- Supabase Security Advisor: rls_disabled_in_public
-- Idempotent: enable (and force) RLS on every public heap table that still has it off,
-- then ensure category_phrases + order_chapter_fixed_photos have policies.
-- Safe to run on production even if 20260651120000 was partially applied.

begin;

-- ---------------------------------------------------------------------------
-- 1) Force RLS on all public tables currently exposed without RLS
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
      and c.relname not like 'pg_%'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
    raise notice 'RLS enabled on public.%', r.tablename;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Re-affirm core app tables (no-op when already enabled)
-- ---------------------------------------------------------------------------
alter table if exists public.profiles enable row level security;
alter table if exists public.profile_phones enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.chapters enable row level security;
alter table if exists public.questions enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.trial_global_categories enable row level security;
alter table if exists public.answers enable row level security;
alter table if exists public.custom_pages enable row level security;
alter table if exists public.ai_enhancement_logs enable row level security;
alter table if exists public.product_reviews enable row level security;

alter table if exists public.profiles force row level security;
alter table if exists public.profile_phones force row level security;
alter table if exists public.categories force row level security;
alter table if exists public.chapters force row level security;
alter table if exists public.questions force row level security;
alter table if exists public.orders force row level security;
alter table if exists public.trial_global_categories force row level security;
alter table if exists public.answers force row level security;
alter table if exists public.custom_pages force row level security;
alter table if exists public.ai_enhancement_logs force row level security;
alter table if exists public.product_reviews force row level security;

-- ---------------------------------------------------------------------------
-- 3) category_phrases (often created before RLS migration ran)
-- ---------------------------------------------------------------------------
create table if not exists public.category_phrases (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  phrase_kk text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists category_phrases_category_sort_idx
  on public.category_phrases (category_id, sort_order);

alter table public.category_phrases enable row level security;
alter table public.category_phrases force row level security;

grant select on table public.category_phrases to authenticated;
grant insert, update, delete on table public.category_phrases to authenticated;
grant all on table public.category_phrases to service_role;

drop policy if exists "category_phrases_select_authenticated" on public.category_phrases;
create policy "category_phrases_select_authenticated"
  on public.category_phrases
  for select
  to authenticated
  using (true);

drop policy if exists "category_phrases_insert_admin_or_manager" on public.category_phrases;
create policy "category_phrases_insert_admin_or_manager"
  on public.category_phrases
  for insert
  to authenticated
  with check (public.actor_is_admin_or_manager());

drop policy if exists "category_phrases_update_admin_or_manager" on public.category_phrases;
create policy "category_phrases_update_admin_or_manager"
  on public.category_phrases
  for update
  to authenticated
  using (public.actor_is_admin_or_manager())
  with check (public.actor_is_admin_or_manager());

drop policy if exists "category_phrases_delete_admin_or_manager" on public.category_phrases;
create policy "category_phrases_delete_admin_or_manager"
  on public.category_phrases
  for delete
  to authenticated
  using (public.actor_is_admin_or_manager());

-- ---------------------------------------------------------------------------
-- 4) order_chapter_fixed_photos
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.order_chapter_fixed_photos enable row level security;
  alter table public.order_chapter_fixed_photos force row level security;
exception
  when undefined_table then null;
end $$;

do $$
begin
  grant select, insert, update, delete on table public.order_chapter_fixed_photos to authenticated;
  grant select, insert, update, delete on table public.order_chapter_fixed_photos to service_role;

  drop policy if exists "Clients manage own chapter fixed photos" on public.order_chapter_fixed_photos;
  create policy "Clients manage own chapter fixed photos"
    on public.order_chapter_fixed_photos
    for all
    using (
      exists (
        select 1 from public.orders o
        where o.id = order_chapter_fixed_photos.order_id
          and o.client_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.orders o
        where o.id = order_chapter_fixed_photos.order_id
          and o.client_id = auth.uid()
      )
    );

  drop policy if exists "Staff access all chapter fixed photos" on public.order_chapter_fixed_photos;
  create policy "Staff access all chapter fixed photos"
    on public.order_chapter_fixed_photos
    for all
    using (public.is_staff())
    with check (public.is_staff());
exception
  when undefined_table then null;
end $$;

commit;
