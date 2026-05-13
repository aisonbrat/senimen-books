-- Harden public schema RLS (Supabase advisor: "table publicly accessible" / RLS disabled).
-- - Ensures category_phrases exists with RLS + policies (referenced by chapters / custom_pages).
-- - Re-affirms RLS on core app tables.
-- - Adds manager-side policies where only admin existed (categories, chapters, questions, phrases).
-- - Editors may insert their own ai_enhancement_logs rows (service_role still bypasses RLS).

begin;

-- ---------------------------------------------------------------------------
-- category_phrases (catalog rows per category; FK from chapters, custom_pages)
-- ---------------------------------------------------------------------------
create table if not exists public.category_phrases (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories (id) on delete cascade,
  phrase_kk text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists category_phrases_category_sort_idx
  on public.category_phrases (category_id, sort_order);

alter table public.category_phrases enable row level security;

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
-- Managers: same catalog write access as admins (policies OR with existing admin-only)
-- ---------------------------------------------------------------------------
drop policy if exists "Managers manage categories" on public.categories;
create policy "Managers manage categories"
  on public.categories
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

drop policy if exists "Managers manage chapters" on public.chapters;
create policy "Managers manage chapters"
  on public.chapters
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

drop policy if exists "Managers manage questions" on public.questions;
create policy "Managers manage questions"
  on public.questions
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

-- Trial catalog: managers maintain alongside admins
drop policy if exists "Managers insert trial_global_categories" on public.trial_global_categories;
create policy "Managers insert trial_global_categories"
  on public.trial_global_categories
  for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

drop policy if exists "Managers update trial_global_categories" on public.trial_global_categories;
create policy "Managers update trial_global_categories"
  on public.trial_global_categories
  for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

drop policy if exists "Managers delete trial_global_categories" on public.trial_global_categories;
create policy "Managers delete trial_global_categories"
  on public.trial_global_categories
  for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager'));

-- ---------------------------------------------------------------------------
-- ai_enhancement_logs: allow editors to insert their own analytics rows (JWT client)
-- ---------------------------------------------------------------------------
drop policy if exists "Editors insert own ai logs" on public.ai_enhancement_logs;
create policy "Editors insert own ai logs"
  on public.ai_enhancement_logs
  for insert
  to authenticated
  with check (editor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Idempotent: ensure RLS is ON for core app tables (no-op if already enabled)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_phones enable row level security;
alter table public.categories enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.orders enable row level security;
alter table public.trial_global_categories enable row level security;
alter table public.answers enable row level security;
alter table public.custom_pages enable row level security;
alter table public.ai_enhancement_logs enable row level security;

do $$
begin
  alter table public.order_chapter_fixed_photos enable row level security;
exception
  when undefined_table then null;
end $$;

commit;
