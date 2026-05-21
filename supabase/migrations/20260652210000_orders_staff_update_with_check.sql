-- Fix staff order updates: explicit WITH CHECK so PostgREST UPDATE returns rows for editors.

drop policy if exists "Staff update orders" on public.orders;

create policy "Staff update orders"
  on public.orders
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
