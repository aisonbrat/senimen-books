-- Add is_rejected column to product_reviews for moderation workflow
alter table public.product_reviews
  add column if not exists is_rejected boolean not null default false;
