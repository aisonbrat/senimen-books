-- Per-block quotas for client AI refinement (analytics + rate limits).
alter table public.ai_enhancement_logs add column if not exists block_key text;

comment on column public.ai_enhancement_logs.block_key is
  'Stable id for the editable block within an order (e.g. q:<uuid>, cp:<uuid>, algy, hat, fak:<id>). Null for legacy rows / staff flows.';

create index if not exists ai_enhancement_logs_order_block_created_idx
  on public.ai_enhancement_logs (order_id, block_key, created_at desc)
  where block_key is not null;
