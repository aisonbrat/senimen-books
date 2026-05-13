-- Clients may only self-create orders for categories listed in trial_global_categories.
-- Managers/admins/service_role bypass RLS and can still insert any category.

begin;

drop policy if exists "Clients create own orders" on public.orders;

create policy "Clients create own orders" on public.orders
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and category_id is not null
    and exists (
      select 1
      from public.trial_global_categories t
      where t.category_id = category_id
    )
  );

commit;
