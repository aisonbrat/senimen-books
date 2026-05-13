-- Per-order flag: client may use AI tools in their book editor; staff editors cannot edit that order.
alter table public.orders add column if not exists client_ai_enabled boolean not null default false;

comment on column public.orders.client_ai_enabled is
  'When true, the book owner may use AI polish/grammar in the client editor; editors (role editor) cannot edit this order. Admins/managers toggle this.';

create or replace function public.orders_enforce_client_ai_flag()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    return new;
  end if;
  if new.client_ai_enabled is not distinct from old.client_ai_enabled then
    return new;
  end if;
  -- Service role / server actions often have no JWT subject.
  if auth.uid() is null then
    return new;
  end if;
  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('admin', 'manager')
  ) then
    return new;
  end if;
  raise exception 'client_ai_enabled тек админ немесе менеджер өзгерте алады'
    using errcode = '42501';
end;
$$;

drop trigger if exists orders_enforce_client_ai_flag_tr on public.orders;
create trigger orders_enforce_client_ai_flag_tr
  before insert or update on public.orders
  for each row execute procedure public.orders_enforce_client_ai_flag();
