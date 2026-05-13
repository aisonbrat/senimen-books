-- Print-only cover file (client upload). Not used in preview or PDF composition; admins download beside PDF.

alter table public.orders add column if not exists admin_cover_print_path text;

comment on column public.orders.admin_cover_print_path is
  'Storage path in book-photos bucket (same rules as chapter photos); for admin/print downloads only — excluded from preview and generated PDF spreads.';
