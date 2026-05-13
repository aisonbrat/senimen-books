alter table ai_enhancement_logs add column if not exists enhancement_mode text;

comment on column ai_enhancement_logs.enhancement_mode is 'Optional: grammar | polish | literary (editor text enhancement).';
