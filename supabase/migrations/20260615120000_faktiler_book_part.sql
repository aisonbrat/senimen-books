-- Фактілер: optional book section (text + full-page photo), per category + per order.
alter table categories add column if not exists faktiler_enabled boolean not null default false;
alter table categories add column if not exists faktiler_example_facts text;

comment on column categories.faktiler_enabled is 'When true, orders of this type may include the Фактілер block (inserted at faktiler chapter marker).';
comment on column categories.faktiler_example_facts is 'Admin-authored example lines shown to editors as guidance (plain text, often one fact per line).';

alter table orders add column if not exists faktiler_text text;
alter table orders add column if not exists faktiler_photo_path text;

comment on column orders.faktiler_text is 'Rich HTML facts body for the Фактілер text page.';
comment on column orders.faktiler_photo_path is 'Public or storage path for the full-page Фактілер photo.';

alter table chapters add column if not exists part_kind text not null default 'standard';

comment on column chapters.part_kind is 'standard = normal Q&A chapter; faktiler = inserts divider + facts text + photo pages (content from orders.faktiler_*).';

alter table chapters drop constraint if exists chapters_part_kind_check;
alter table chapters add constraint chapters_part_kind_check
  check (part_kind in ('standard', 'faktiler'));
