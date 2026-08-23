-- The AI Movie Assistant (mode: 'assistant') logs to ai_sessions like every
-- other mode, but the column's CHECK constraint only allowed
-- ('pick', 'bridge', 'taste') — inserting an 'assistant' row would fail.
--
-- Postgres auto-names an inline column CHECK constraint
-- "<table>_<column>_check" when none is given explicitly, which is exactly
-- how it was defined in 20260821184749_create_core_tables.sql
-- (`mode text not null check (mode in ('pick', 'bridge', 'taste'))`), so
-- the constraint being dropped below is ai_sessions_mode_check.
--
-- No RLS changes: the four existing ai_sessions policies are row-scoped on
-- user_id and apply to every column/mode alike, so 'assistant' rows are
-- already covered by the same policies 'pick'/'bridge'/'taste' rows use.

alter table public.ai_sessions
  drop constraint ai_sessions_mode_check;

alter table public.ai_sessions
  add constraint ai_sessions_mode_check
  check (mode in ('pick', 'bridge', 'taste', 'assistant'));
