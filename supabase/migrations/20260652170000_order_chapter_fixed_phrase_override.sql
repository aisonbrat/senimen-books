-- Per-order text on fixed chapter pages (60/40 band). Template default stays on chapters → category_phrases;
-- staff may override after the client submits the book.

alter table public.order_chapter_fixed_photos
  add column if not exists phrase_override_kk text;

comment on column public.order_chapter_fixed_photos.phrase_override_kk is
  'Optional per-order replacement for the category template phrase on the fixed chapter page; null = use template.';
