  -- Run once in Supabase SQL Editor if cover title / «Кітаптан жасыру» do not persist.
  -- Then: Dashboard → Settings → API → Reload schema (or wait ~2 min).

  alter table public.orders
    add column if not exists editor_skipped_chapter_ids uuid[] not null default '{}';

  alter table public.orders
    add column if not exists cover_title_font_preset text;

  comment on column public.orders.editor_skipped_chapter_ids is
    'Chapter UUIDs excluded from preview/PDF by staff editor.';
comment on column public.orders.cover_title_font_preset is
  'Cover main title print size in mm (e.g. 11, 13.5); null = default 13.5mm.';

-- Also ensure staff can UPDATE (run 20260652210000_orders_staff_update_with_check.sql if saves still fail).
