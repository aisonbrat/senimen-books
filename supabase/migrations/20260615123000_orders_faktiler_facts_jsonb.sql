-- Ordered fact spreads: each item is one text page + one full-page photo in the book.
alter table orders add column if not exists faktiler_facts jsonb not null default '[]'::jsonb;

comment on column orders.faktiler_facts is 'JSON array of {id, text, photo_path}; each entry is one fact spread. Legacy faktiler_text / faktiler_photo_path may be migrated on read.';
