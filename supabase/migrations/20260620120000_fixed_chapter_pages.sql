-- Fixed chapter page: paired with chapter subtitle; admin phrase + user photo + shared rect color.

alter table chapters add column if not exists fixed_phrase_id uuid references category_phrases(id) on delete set null;

create unique index if not exists chapters_fixed_phrase_id_unique
  on chapters (fixed_phrase_id)
  where fixed_phrase_id is not null;

comment on column chapters.fixed_phrase_id is 'Optional category_phrases row for the fixed 60/40 photo+rectangle page after this chapter subtitle; one phrase at most per chapter globally.';

alter table orders add column if not exists fixed_rectangle_color text;

comment on column orders.fixed_rectangle_color is 'Hex #RRGGBB for bottom band on all fixed chapter pages; client chooses one color per book.';

create table if not exists order_chapter_fixed_photos (
  order_id uuid not null references orders(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  photo_path text,
  updated_at timestamptz not null default now(),
  primary key (order_id, chapter_id)
);

comment on table order_chapter_fixed_photos is 'User image for the fixed page paired with each chapter that has fixed_phrase_id.';

alter table custom_pages add column if not exists selected_phrase_id uuid references category_phrases(id) on delete set null;

comment on column custom_pages.selected_phrase_id is 'Reserves a category phrase for this custom page overlay; mutually exclusive with other uses in the order UI.';
