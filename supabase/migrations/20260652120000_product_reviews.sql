-- Product reviews table for the Feedback & Loyalty system
create table if not exists public.product_reviews (
  id           uuid        default gen_random_uuid() primary key,
  client_name  text        not null check (char_length(trim(client_name)) >= 1),
  book_format  text        not null check (char_length(trim(book_format)) >= 1),
  review_text  text        not null check (char_length(trim(review_text)) >= 1),
  rating       integer     not null check (rating between 1 and 10),
  is_published boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.product_reviews enable row level security;

-- Anyone (anon or authenticated) can read published reviews
create policy "public_read_published_reviews" on public.product_reviews
  for select
  using (is_published = true);

-- Anyone can submit a review (anon insert)
create policy "public_insert_review" on public.product_reviews
  for insert
  with check (
    char_length(trim(client_name)) >= 1
    and char_length(trim(book_format)) >= 1
    and char_length(trim(review_text)) >= 1
    and rating between 1 and 10
  );

-- Admins have full access (bypassed via service_role in server actions anyway)
create policy "admin_full_access_reviews" on public.product_reviews
  for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (true);

-- Grants
grant select, insert on table public.product_reviews to anon;
grant select, insert, update, delete on table public.product_reviews to authenticated;
grant all on table public.product_reviews to service_role;
