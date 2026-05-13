-- Reads were fixed with SELECT policies; uploads still require INSERT + UPDATE on
-- `storage.objects` (Supabase Storage `.upload` uses INSERT; `upsert: true` also UPDATE).

begin;

drop policy if exists "book_photos_authenticated_insert_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_update_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_delete_order_or_staff" on storage.objects;

create policy "book_photos_authenticated_insert_order_or_staff"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
);

create policy "book_photos_authenticated_update_order_or_staff"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
)
with check (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
);

-- Replace / remove existing object in the same folder (some clients issue DELETE before INSERT).
create policy "book_photos_authenticated_delete_order_or_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
);

commit;
