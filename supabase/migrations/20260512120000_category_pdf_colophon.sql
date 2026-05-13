-- Per book-type (category): optional closing imprint for exported PDF only (not shown in editor preview).

begin;

alter table public.categories
  add column if not exists pdf_colophon_template_kk text;

comment on column public.categories.pdf_colophon_template_kk is
  'Kazakh sentence for the last PDF-only page. Placeholders: {{author}}, {{date}} (DD.MM.YYYY). Empty = no colophon page.';

commit;
