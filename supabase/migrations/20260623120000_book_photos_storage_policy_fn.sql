-- Previous policy used a plain EXISTS on `orders`, which can fail if RLS or
-- casts behave unexpectedly. Use a SECURITY DEFINER helper that validates the
-- first path segment as UUID and checks client ownership or staff (auth.uid()
-- is still the caller’s JWT).

begin;

create or replace function public.user_can_read_book_photos_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  order_uuid uuid;
begin
  if object_name is null or length(trim(object_name)) = 0 then
    return false;
  end if;
  begin
    order_uuid := split_part(object_name, '/', 1)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
      from public.orders o
     where o.id = order_uuid
       and (
         o.client_id = (select auth.uid())
         or public.is_staff()
       )
  );
end;
$$;

grant execute on function public.user_can_read_book_photos_object(text) to authenticated;

drop policy if exists "book_photos_authenticated_select_order_or_staff" on storage.objects;

create policy "book_photos_authenticated_select_order_or_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'book-photos'
  and public.user_can_read_book_photos_object(name)
);

commit;
