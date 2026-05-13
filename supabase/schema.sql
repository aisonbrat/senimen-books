-- Canonical schema for a **new** empty database (local reset / greenfield).
-- On an **existing** Supabase project, do **not** paste this whole file: use
-- `supabase/migrations/*.sql` only. Re-running this file will skip enums below
-- but will still error if tables/policies/triggers already exist.

create extension if not exists "uuid-ossp";

-- Idempotent enum creation (42710 duplicate_object when type already exists).
do $$ begin
  create type user_role as enum ('client', 'editor', 'admin', 'designer', 'manager');
exception when duplicate_object then null; end $$;
do $$ begin
  create type order_status as enum ('filling', 'checking', 'completed', 'design', 'printing', 'delivered');
exception when duplicate_object then null; end $$;
do $$ begin
  create type question_type as enum ('text', 'textarea', 'photo', 'photo_with_text');
exception when duplicate_object then null; end $$;
do $$ begin
  create type photo_overlay_position as enum ('top', 'center', 'bottom');
exception when duplicate_object then null; end $$;
do $$ begin
  create type page_type as enum ('question', 'custom_text', 'custom_photo', 'custom_poem', 'foreword', 'afterword', 'chapter_break');
exception when duplicate_object then null; end $$;

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  role         user_role not null default 'client',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table profile_phones (
  profile_id uuid primary key references profiles(id) on delete cascade,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profile_phones_phone_lower_unique
  on profile_phones (lower(trim(phone)))
  where phone is not null and trim(phone) <> '';

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create or replace function profile_phones_ensure_row()
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

create trigger tr_profile_phones_after_profile_insert
  after insert on profiles
  for each row execute procedure profile_phones_ensure_row();

create table categories (
  id           uuid primary key default uuid_generate_v4(),
  title_kk     text not null,
  description_kk text,
  cover_image  text,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  faktiler_enabled boolean not null default false,
  faktiler_example_facts text,
  /** Last PDF-only page (not in preview). Placeholders {{author}}, {{date}} DD.MM.YYYY */
  pdf_colophon_template_kk text,
  created_at   timestamptz not null default now()
);

create table chapters (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid not null references categories(id) on delete cascade,
  title_kk     text not null,
  sort_order   int not null default 0,
  is_foreword  boolean not null default false,
  is_afterword boolean not null default false,
  part_kind    text not null default 'standard' check (part_kind in ('standard', 'faktiler')),
  created_at   timestamptz not null default now()
);

create table questions (
  id              uuid primary key default uuid_generate_v4(),
  chapter_id      uuid not null references chapters(id) on delete cascade,
  question_kk     text not null,
  hint_kk         text,
  question_type   question_type not null default 'textarea',
  is_required     boolean not null default false,
  sort_order      int not null default 0,
  max_chars       int,
  created_at      timestamptz not null default now()
);

create table orders (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid not null references profiles(id) on delete cascade,
  category_id      uuid references categories(id),
  author_name      text not null,
  book_title       text not null,
  recipient_name   text not null,
  delivery_address text not null,
  status           order_status not null default 'filling',
  assigned_editor  uuid references profiles(id),
  assigned_designer uuid references profiles(id),
  editor_notes     text,
  designer_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  completed_at     timestamptz,
  faktiler_text       text,
  faktiler_photo_path text,
  faktiler_facts      jsonb not null default '[]'::jsonb,
  client_ai_enabled   boolean not null default false,
  trial_mode          boolean not null default false,
  trial_whatsapp_clicked_at timestamptz,
  /** book-photos path; admin print download only — not in preview/pdf spreads */
  admin_cover_print_path text
);

create table trial_global_categories (
  category_id uuid primary key references categories(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table answers (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references orders(id) on delete cascade,
  question_id     uuid not null references questions(id) on delete cascade,
  text_content    text,
  photo_path      text,
  photo_dpi       int,
  overlay_text    text,
  overlay_position photo_overlay_position,
  is_skipped      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(order_id, question_id)
);

create table custom_pages (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references orders(id) on delete cascade,
  page_type       page_type not null default 'custom_text',
  title_kk        text,
  text_content    text,
  photo_path      text,
  overlay_text    text,
  overlay_position photo_overlay_position,
  poem_stanza_lines smallint,
  hidden_from_book boolean not null default false,
  qr_url          text,
  qr_size         text default 'lg',
  qr_vertical     text,
  overlay_in_book boolean not null default false,
  qr_in_book      boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles for each row execute procedure set_updated_at();
create trigger orders_updated_at before update on orders for each row execute procedure set_updated_at();
create trigger answers_updated_at before update on answers for each row execute procedure set_updated_at();
create trigger custom_pages_updated_at before update on custom_pages for each row execute procedure set_updated_at();
create trigger profile_phones_updated_at before update on profile_phones for each row execute procedure set_updated_at();

create table ai_enhancement_logs (
  id              uuid primary key default uuid_generate_v4(),
  editor_id       uuid not null references profiles(id) on delete cascade,
  order_id        uuid references orders(id) on delete set null,
  block_key       text,
  source          text not null default 'answer',
  enhancement_mode text,
  words_before    integer not null,
  words_after     integer not null,
  chars_before    integer not null,
  chars_after     integer not null,
  processing_ms   integer not null,
  success         boolean not null default true,
  error_message   text,
  model           text not null default 'gemini-2.5-flash',
  created_at      timestamptz not null default now()
);
create index ai_enhancement_logs_editor_id_idx on ai_enhancement_logs(editor_id);
create index ai_enhancement_logs_created_at_idx on ai_enhancement_logs(created_at desc);

create index if not exists ai_enhancement_logs_order_block_created_idx
  on ai_enhancement_logs (order_id, block_key, created_at desc)
  where block_key is not null;

-- Hot-path indexes (mirrored in 20260613120000_performance_indexes.sql).
create index if not exists profiles_role_idx               on profiles(role);
create index if not exists orders_client_id_idx            on orders(client_id);
create index if not exists orders_assigned_editor_idx      on orders(assigned_editor) where assigned_editor is not null;
create index if not exists orders_assigned_designer_idx    on orders(assigned_designer) where assigned_designer is not null;
create index if not exists orders_status_idx               on orders(status);
create index if not exists orders_category_id_idx          on orders(category_id);
create index if not exists orders_created_at_idx           on orders(created_at desc);
create index if not exists chapters_category_id_idx        on chapters(category_id);
create index if not exists chapters_sort_idx               on chapters(category_id, sort_order);
create index if not exists questions_chapter_id_idx        on questions(chapter_id);
create index if not exists questions_sort_idx              on questions(chapter_id, sort_order);
create index if not exists answers_order_id_idx            on answers(order_id);
create index if not exists answers_question_id_idx         on answers(question_id);
create index if not exists custom_pages_order_sort_idx     on custom_pages(order_id, sort_order);
create index if not exists categories_active_sort_idx      on categories(is_active, sort_order) where is_active = true;

alter table profiles enable row level security;
alter table profile_phones enable row level security;
alter table categories enable row level security;
alter table chapters enable row level security;
alter table questions enable row level security;
alter table orders enable row level security;
alter table trial_global_categories enable row level security;
alter table answers enable row level security;
alter table custom_pages enable row level security;
alter table ai_enhancement_logs enable row level security;

create or replace function is_staff()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role::text in ('admin', 'editor', 'designer', 'manager')
  );
$$;

create or replace function actor_is_admin_or_manager()
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

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Staff read directory profiles" on profiles for select to authenticated
  using (public.is_staff());
create policy "profile_phones_select_own_or_admin_manager" on profile_phones for select to authenticated
  using (
    profile_id = auth.uid()
    or public.actor_is_admin_or_manager()
  );
create policy "profile_phones_update_own" on profile_phones for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy "profile_phones_update_admin_manager" on profile_phones for update to authenticated
  using (public.actor_is_admin_or_manager())
  with check (true);
create policy "profile_phones_insert_own" on profile_phones for insert to authenticated
  with check (profile_id = auth.uid());
create policy "profile_phones_insert_admin_manager" on profile_phones for insert to authenticated
  with check (public.actor_is_admin_or_manager());
create policy "Admins insert profiles" on profiles for insert to authenticated
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "Admins update profiles" on profiles for update to authenticated
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
grant select, insert, update, delete on table profile_phones to authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table profiles to service_role;
grant all on table profile_phones to service_role;
create policy "Anyone authenticated can read categories" on categories for select using (auth.role() = 'authenticated');
create policy "Admins manage categories" on categories for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
grant select on table public.categories to anon;
create policy "Anon read trial offer categories" on public.categories for select to anon using (
  coalesce(is_active, true)
  and exists (select 1 from public.trial_global_categories t where t.category_id = categories.id)
);
create policy "Anyone authenticated can read chapters" on chapters for select using (auth.role() = 'authenticated');
create policy "Admins manage chapters" on chapters for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Anyone authenticated can read questions" on questions for select using (auth.role() = 'authenticated');
create policy "Admins manage questions" on questions for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Authenticated read trial_global_categories" on trial_global_categories for select to authenticated using (true);
grant select on table public.trial_global_categories to anon;
create policy "Anon read trial_global_categories catalog" on public.trial_global_categories for select to anon using (true);
create policy "Admins insert trial_global_categories" on trial_global_categories for insert to authenticated with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "Admins delete trial_global_categories" on trial_global_categories for delete to authenticated using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
grant select on table trial_global_categories to authenticated;
grant insert, update, delete on table trial_global_categories to authenticated;
grant all on table trial_global_categories to service_role;
create policy "Clients see own orders" on orders for select using (client_id = auth.uid());
create policy "Clients create own orders" on orders for insert to authenticated with check (
  client_id = auth.uid()
  and category_id is not null
  and exists (select 1 from trial_global_categories t where t.category_id = category_id)
);
create policy "Clients update own orders" on orders for update using (client_id = auth.uid() and status = 'filling');
create policy "Staff see all orders" on orders for select using (is_staff());
create policy "Staff update orders" on orders for update using (is_staff());
create policy "Clients manage own answers" on answers for all using (exists (select 1 from orders where id = answers.order_id and client_id = auth.uid()));
create policy "Staff access all answers" on answers for all using (is_staff());
create policy "Clients manage own custom pages" on custom_pages for all using (exists (select 1 from orders where id = custom_pages.order_id and client_id = auth.uid()));
create policy "Staff access all custom pages" on custom_pages for all using (is_staff());
create policy "Editors read own ai logs" on ai_enhancement_logs for select using (editor_id = auth.uid());
create policy "Admins read all ai logs" on ai_enhancement_logs for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
