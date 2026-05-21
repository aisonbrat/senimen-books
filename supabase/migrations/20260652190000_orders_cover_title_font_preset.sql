-- Staff-adjustable main title size on the first (cover) page.

alter table public.orders
  add column if not exists cover_title_font_preset text;

comment on column public.orders.cover_title_font_preset is
  'Cover main title print size in mm (e.g. 13.5); null = default 13.5mm.';
