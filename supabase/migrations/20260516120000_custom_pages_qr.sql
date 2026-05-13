alter table custom_pages add column if not exists qr_url text;
alter table custom_pages add column if not exists qr_size text default 'md';
alter table custom_pages add column if not exists qr_vertical text;

comment on column custom_pages.qr_url is 'Optional URL encoded as QR overlay on custom_photo pages.';
comment on column custom_pages.qr_size is 'QR tile: sm | md | lg';
comment on column custom_pages.qr_vertical is 'QR anchor: top | center | bottom';
