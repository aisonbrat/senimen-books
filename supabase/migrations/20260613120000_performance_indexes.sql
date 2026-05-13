-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes for hot-path foreign keys.
--
-- Until now only `ai_enhancement_logs` had indexes; every other foreign-key
-- lookup (admin/editor/manager dashboards, RLS subqueries, autosave) was
-- doing sequential scans. That is fine on an empty DB but becomes the
-- platform's #1 source of latency past ~1k orders.
--
-- All indexes use `if not exists` so the migration is safe to re-run and
-- safe to apply on a populated production DB. Postgres will use them for
-- both the dashboard SELECTs and the `is_staff()` RLS subqueries.
--
-- Notes:
--   * `concurrently` is intentionally NOT used because Supabase migrations
--     run inside a transaction. Live deployments with large tables can run
--     these manually (`create index concurrently …`) and skip this migration.
--   * Composite index on `custom_pages(order_id, sort_order)` is shaped after
--     the editor's actual query in `useEditorData.fetchData` and `addCustomPage`.
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles ────────────────────────────────────────────────────────────────────
create index if not exists profiles_role_idx on profiles(role);

-- orders ──────────────────────────────────────────────────────────────────────
create index if not exists orders_client_id_idx        on orders(client_id);
create index if not exists orders_assigned_editor_idx  on orders(assigned_editor) where assigned_editor is not null;
create index if not exists orders_assigned_designer_idx on orders(assigned_designer) where assigned_designer is not null;
create index if not exists orders_status_idx           on orders(status);
create index if not exists orders_category_id_idx      on orders(category_id);
create index if not exists orders_created_at_idx       on orders(created_at desc);

-- chapters / questions ────────────────────────────────────────────────────────
create index if not exists chapters_category_id_idx on chapters(category_id);
create index if not exists chapters_sort_idx        on chapters(category_id, sort_order);
create index if not exists questions_chapter_id_idx on questions(chapter_id);
create index if not exists questions_sort_idx       on questions(chapter_id, sort_order);

-- answers ─────────────────────────────────────────────────────────────────────
-- The (order_id, question_id) unique constraint already creates an index on the
-- pair, but a left-anchored index on `order_id` alone is needed for the
-- editor's "fetch all answers for this order" query.
create index if not exists answers_order_id_idx    on answers(order_id);
create index if not exists answers_question_id_idx on answers(question_id);

-- custom_pages ────────────────────────────────────────────────────────────────
-- Editor lists pages by `order_id` ordered by `sort_order`; the composite
-- supports both the lookup and the order-by in a single index.
create index if not exists custom_pages_order_sort_idx on custom_pages(order_id, sort_order);

-- categories ──────────────────────────────────────────────────────────────────
create index if not exists categories_active_sort_idx on categories(is_active, sort_order) where is_active = true;
