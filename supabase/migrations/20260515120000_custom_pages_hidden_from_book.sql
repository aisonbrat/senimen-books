-- Hide custom text/poem/photo pages from preview/PDF/book output while keeping editor content.
alter table custom_pages add column if not exists hidden_from_book boolean not null default false;

comment on column custom_pages.hidden_from_book is 'When true, page is omitted from preview pagination and PDF export.';
