-- Global trial templates: any client order for a listed category enters trial_mode automatically.
-- Admins maintain the list (one row per category). Clients cannot toggle trial_mode.

begin;

create table public.trial_global_categories (
  category_id uuid primary key references public.categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.trial_global_categories is
  'Book types enabled for automatic free trial; client inserts pick up trial_mode from this list via trigger.';

alter table public.trial_global_categories enable row level security;

create policy trial_global_categories_read_auth on public.trial_global_categories
  for select to authenticated using (true);

create policy trial_global_categories_admin_write on public.trial_global_categories
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy trial_global_categories_admin_update on public.trial_global_categories
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy trial_global_categories_admin_delete on public.trial_global_categories
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- PostgREST / Supabase клиент үшін келелі рөлдердің кестеге жолы болуы шарт.
grant select on table public.trial_global_categories to authenticated;
grant insert, update, delete on table public.trial_global_categories to authenticated;
grant all on table public.trial_global_categories to service_role;

alter table public.orders add column if not exists trial_whatsapp_clicked_at timestamptz;

comment on column public.orders.trial_whatsapp_clicked_at is
  'First time the client opened the trial WhatsApp CTA from the locked overlay / preview UI.';

-- Replace gate: clients get trial automatically when category is listed; still cannot flip trial flags themselves.

create or replace function public.orders_trial_mode_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.client_id = auth.uid() and not public.is_staff() then
      new.trial_mode := exists (
        select 1
        from public.trial_global_categories tgc
        where tgc.category_id = new.category_id
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.trial_mode is distinct from old.trial_mode then
    if auth.uid() is not null and new.client_id = auth.uid() and not public.is_staff() then
      new.trial_mode := old.trial_mode;
    end if;
  end if;

  return new;
end;
$$;

commit;
