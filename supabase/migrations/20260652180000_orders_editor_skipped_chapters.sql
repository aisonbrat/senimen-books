-- Staff may omit chapter title + body from the book (e.g. client left a section empty).

alter table public.orders
  add column if not exists editor_skipped_chapter_ids uuid[] not null default '{}';

comment on column public.orders.editor_skipped_chapter_ids is
  'Chapter UUIDs excluded from preview/PDF by admin/editor after client submit; empty = show all eligible chapters.';
