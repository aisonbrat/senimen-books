-- Poem custom page: stanza grouping for verse layout (4–8 lines per stanza).
do $$ begin
  alter type page_type add value 'custom_poem';
exception
  when duplicate_object then null;
end $$;

alter table custom_pages
  add column if not exists poem_stanza_lines smallint;

comment on column custom_pages.poem_stanza_lines is 'Lines per stanza for custom_poem pages (4–8); default 4';
