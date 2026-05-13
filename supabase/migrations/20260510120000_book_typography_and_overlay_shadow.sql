-- Typography persisted per order (preview + PDF). Safe to run once on Supabase.
alter table orders add column if not exists answer_font_preset text default 'medium';
alter table orders add column if not exists answer_text_align text default 'justify';

alter table custom_pages add column if not exists overlay_shadow_opacity int;

comment on column orders.answer_font_preset is 'Book body: small|medium|large';
comment on column orders.answer_text_align is 'Book body: justify|left';
comment on column custom_pages.overlay_shadow_opacity is 'Overlay headline shadow 0-100; null uses default';
