-- Private bucket `book-photos`: uploads already work for authenticated users, but
-- `<img>` / fetch must use signed URLs. `createSignedUrl` requires SELECT on
-- storage.objects for matching paths.

begin;

drop policy if exists "book_photos_authenticated_select_order_or_staff" on storage.objects;

create policy "book_photos_authenticated_select_order_or_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'book-photos'
  and (
    is_staff()
    or exists (
      select 1
        from public.orders o
       where o.id::text = split_part(name, '/', 1)
         and o.client_id = auth.uid()
    )
  )
);

commit;
