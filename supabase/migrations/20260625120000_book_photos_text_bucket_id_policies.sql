-- Some Supabase projects store `storage.buckets.id` as text equal to the bucket name
-- (e.g. id = 'book-photos'). Policies use `bucket_id = 'book-photos'` (text).
-- `createSignedUrl` requires SELECT on storage.objects → the SELECT policy below.
-- INSERT/UPDATE/DELETE use the same bucket check + helper for uploads.
--
-- `user_can_read_book_photos_object` matches the object path’s first segment to
-- `orders.id` via text (lower(o.id::text) = lower(segment)), not ::uuid on the
-- path segment, so minor formatting/case differences do not raise cast errors.

begin;

create or replace function public.user_can_read_book_photos_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
  order_segment text;
begin
  if object_name is null then
    return false;
  end if;

  normalized := trim(object_name);
  if normalized = '' then
    return false;
  end if;

  order_segment := nullif(trim(split_part(normalized, '/', 1)), '');
  if order_segment is null then
    return false;
  end if;

  return exists (
    select 1
      from public.orders o
     where lower(o.id::text) = lower(order_segment)
       and (
         o.client_id = (select auth.uid())
         or public.is_staff()
       )
  );
end;
$$;

grant execute on function public.user_can_read_book_photos_object(text) to authenticated;

drop policy if exists "book_photos_authenticated_select_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_insert_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_update_order_or_staff" on storage.objects;
drop policy if exists "book_photos_authenticated_delete_order_or_staff" on storage.objects;

create policy "book_photos_authenticated_select_order_or_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
);

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

create policy "book_photos_authenticated_delete_order_or_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
);

commit;
