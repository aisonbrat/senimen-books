-- Table existed without privileges / RLS → "permission denied for table order_chapter_fixed_photos".
-- Mirror custom_pages: clients own order rows; staff full access.

alter table order_chapter_fixed_photos enable row level security;

grant select, insert, update, delete on table order_chapter_fixed_photos to authenticated;
grant select, insert, update, delete on table order_chapter_fixed_photos to service_role;

drop policy if exists "Clients manage own chapter fixed photos" on order_chapter_fixed_photos;
drop policy if exists "Staff access all chapter fixed photos" on order_chapter_fixed_photos;

create policy "Clients manage own chapter fixed photos"
  on order_chapter_fixed_photos
  for all
  using (
    exists (
      select 1 from orders o
      where o.id = order_chapter_fixed_photos.order_id
        and o.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from orders o
      where o.id = order_chapter_fixed_photos.order_id
        and o.client_id = auth.uid()
    )
  );

create policy "Staff access all chapter fixed photos"
  on order_chapter_fixed_photos
  for all
  using (is_staff())
  with check (is_staff());
