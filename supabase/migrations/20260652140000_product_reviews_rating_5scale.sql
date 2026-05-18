-- Change rating scale from 1-10 to 1-5
alter table public.product_reviews
  drop constraint if exists product_reviews_rating_check;

alter table public.product_reviews
  add constraint product_reviews_rating_check check (rating between 1 and 5);
