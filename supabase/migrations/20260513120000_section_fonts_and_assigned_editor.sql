-- Optional per-section / custom-page body font preset (small|medium|large); null = use order.answer_font_preset
alter table orders add column if not exists algy_font_preset text;
alter table orders add column if not exists hat_font_preset text;
alter table custom_pages add column if not exists text_font_preset text;

comment on column orders.algy_font_preset is 'Foreword body: small|medium|large; null inherits answer_font_preset';
comment on column orders.hat_font_preset is 'Hat letter body: small|medium|large; null inherits answer_font_preset';
comment on column custom_pages.text_font_preset is 'Custom text/poem body: small|medium|large; null inherits order.answer_font_preset';
