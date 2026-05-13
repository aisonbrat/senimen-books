-- AI text-enhancement analytics. One row per editor click on the "Әрлеу" button.
-- Editors can read their own rows; admins can read everything. Only the service role inserts.

create table if not exists ai_enhancement_logs (
  id              uuid primary key default gen_random_uuid(),
  editor_id       uuid not null references profiles(id) on delete cascade,
  order_id        uuid references orders(id) on delete set null,
  /** Source surface: 'answer' | 'algy' | 'hat' | 'custom_text' | 'overlay' (free-form). */
  source          text not null default 'answer',
  words_before    integer not null,
  words_after     integer not null,
  chars_before    integer not null,
  chars_after     integer not null,
  processing_ms   integer not null,
  success         boolean not null default true,
  error_message   text,
  /** Gemini 1.5 Flash was retired by Google in 2025; using `gemini-2.5-flash` (free tier). */
  model           text not null default 'gemini-2.5-flash',
  created_at      timestamptz not null default now()
);

create index if not exists ai_enhancement_logs_editor_id_idx on ai_enhancement_logs(editor_id);
create index if not exists ai_enhancement_logs_created_at_idx on ai_enhancement_logs(created_at desc);

alter table ai_enhancement_logs enable row level security;

create policy "Editors read own ai logs" on ai_enhancement_logs
  for select using (editor_id = auth.uid());

create policy "Admins read all ai logs" on ai_enhancement_logs
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Inserts come from the API route running with service-role JWT (bypasses RLS).
-- We still need the table-level GRANT, since RLS bypass alone does not bypass GRANT.
grant select, insert on ai_enhancement_logs to service_role;
grant select on ai_enhancement_logs to authenticated;

comment on table ai_enhancement_logs is 'Per-call analytics for the editor "Әрлеу" Gemini text-enhancement button.';
