-- New books should default to left-aligned body text (not justify).
alter table public.orders
  alter column answer_text_align set default 'left';
