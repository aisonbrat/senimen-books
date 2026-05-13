-- When false, overlay text / QR are kept in the editor but omitted from preview + PDF.
alter table custom_pages add column if not exists overlay_in_book boolean not null default true;
alter table custom_pages add column if not exists qr_in_book boolean not null default true;

comment on column custom_pages.overlay_in_book is 'When false, overlay headline is hidden from preview/PDF but overlay_text is retained.';
comment on column custom_pages.qr_in_book is 'When false, QR is hidden from preview/PDF but qr_url is retained.';
