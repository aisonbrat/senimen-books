-- Follow-up to 20260611120000_ai_enhancement_logs.sql.
-- The first migration enabled RLS but forgot to GRANT table privileges. Without these grants,
-- the API route's service-role insert fails with `42501 permission denied`. RLS bypass alone
-- does not bypass GRANT.

grant select, insert on ai_enhancement_logs to service_role;
grant select on ai_enhancement_logs to authenticated;
