-- Free trial: limited questions until admin clears trial_mode after purchase / grant.

begin;

alter table public.orders add column if not exists trial_mode boolean not null default false;

comment on column public.orders.trial_mode is
  'Demo/trial book: client may edit only the first N standard questions (app constant TRIAL_FREE_QUESTION_COUNT). Admin/service role clears after purchase.';

create or replace function public.orders_trial_mode_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Clients creating their own order cannot mark it trial (admin assigns trials via service role).
    if auth.uid() is not null and new.client_id = auth.uid() and not public.is_staff() then
      new.trial_mode := false;
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

drop trigger if exists orders_trial_mode_gate_tr on public.orders;
create trigger orders_trial_mode_gate_tr
  before insert or update on public.orders
  for each row execute procedure public.orders_trial_mode_gate();

commit;
