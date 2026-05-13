-- Allow unauthenticated visitors to read the public trial template catalog (/start, /api/public/trial-offers).
-- Supabase PostgREST uses role "anon" for requests without a user JWT.

grant select on table public.trial_global_categories to anon;
grant select on table public.categories to anon;

drop policy if exists "Anon read trial_global_categories catalog" on public.trial_global_categories;
create policy "Anon read trial_global_categories catalog"
  on public.trial_global_categories
  for select
  to anon
  using (true);

-- Only expose category rows that are both active and linked as a trial self-serve template.
drop policy if exists "Anon read trial offer categories" on public.categories;
create policy "Anon read trial offer categories"
  on public.categories
  for select
  to anon
  using (
    coalesce(is_active, true)
    and exists (
      select 1 from public.trial_global_categories t
      where t.category_id = categories.id
    )
  );
