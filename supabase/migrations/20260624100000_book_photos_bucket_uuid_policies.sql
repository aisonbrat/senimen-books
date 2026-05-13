-- storage.objects.bucket_id is a UUID FK to storage.buckets(id), not the bucket
-- name string. Policies using `bucket_id = 'book-photos'` never match → uploads &
-- signed URLs fail. Scope policies via the bucket row instead.

begin;

drop policy if exists "book_photos_authenticated_select_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_insert_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_update_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_delete_order_or_staff" on storage.objects;

create policy "book_photos_authenticated_select_order_or_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id in (select id from storage.buckets where name = 'book-photos')
  and public.user_can_read_book_photos_object(name)
);

create policy "book_photos_authenticated_insert_order_or_staff"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (select id from storage.buckets where name = 'book-photos')
  and public.user_can_read_book_photos_object(name)
);

create policy "book_photos_authenticated_update_order_or_staff"
on storage.objects
for update
to authenticated
using (
  bucket_id in (select id from storage.buckets where name = 'book-photos')
  and public.user_can_read_book_photos_object(name)
)
with check (
  bucket_id in (select id from storage.buckets where name = 'book-photos')
  and public.user_can_read_book_photos_object(name)
);

create policy "book_photos_authenticated_delete_order_or_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id in (select id from storage.buckets where name = 'book-photos')
  and public.user_can_read_book_photos_object(name)
);

commit;
