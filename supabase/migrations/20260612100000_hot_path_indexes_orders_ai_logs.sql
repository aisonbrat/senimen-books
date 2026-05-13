-- Extra indexes for list + editor hot paths (admin orders, client dashboard, analytics).
-- Existing migration 20260613120000 already covers answers, custom_pages, chapters, questions,
-- orders(client_id), orders(created_at desc), etc. This file adds composites and order_id on logs.

-- Client dashboard / profile: filter by client + sort by created_at (index-only friendly).
create index if not exists orders_client_created_at_idx
  on public.orders (client_id, created_at desc);

-- Admin / manager lists filtered by status then newest first.
create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);

-- Admin analytics or future per-order log queries.
create index if not exists ai_enhancement_logs_order_id_idx
  on public.ai_enhancement_logs (order_id)
  where order_id is not null;
