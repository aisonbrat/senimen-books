-- Fix: без GRANT Postgres «permission denied for table trial_global_categories»
-- (еңгізу миграциясы қате кетсе де, бұл скриптті қайта орындауға болады).

begin;

grant select on table public.trial_global_categories to authenticated;
grant insert, update, delete on table public.trial_global_categories to authenticated;
grant all on table public.trial_global_categories to service_role;

commit;
