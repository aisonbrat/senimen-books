  -- ═══════════════════════════════════════════════════════════════════════════
  -- profiles: fixes "permission denied for table profiles"
  --
  --   • Recreate handle_new_user() as SECURITY DEFINER with search_path pinned
  --     (avoids brittle RLS interactions on insert from auth.users trigger).
  --   • GRANT DML on profiles to service_role (defensive).
  --   • RLS: allow authenticated admins to insert/update profiles — covers
  --     mis-configured service_role keys in dev and legitimate admin sessions.
  -- ═══════════════════════════════════════════════════════════════════════════

  create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  begin
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
    return new;
  end;
  $$;

  grant usage on schema public to service_role;
  grant select, insert, update, delete on table public.profiles to service_role;

  drop policy if exists "Admins insert profiles" on public.profiles;
  drop policy if exists "Admins update profiles" on public.profiles;

  create policy "Admins insert profiles"
    on public.profiles
    for insert
    to authenticated
    with check (
      exists (
        select 1 from public.profiles as p
        where p.id = auth.uid() and p.role = 'admin'
      )
    );

  create policy "Admins update profiles"
    on public.profiles
    for update
    to authenticated
    using (
      exists (
        select 1 from public.profiles as p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.profiles as p
        where p.id = auth.uid() and p.role = 'admin'
      )
    );
