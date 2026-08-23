-- Cinema Bridge (mode: 'bridge') logs which film the user started from and
-- which industry/language they asked for. ai_sessions had nowhere to put
-- either, so the bridge handler was overloading `mood_text` with the target
-- and dropping the source film entirely — losing exactly the pairing needed
-- to evaluate or improve match quality later.
--
-- Purely additive: two nullable columns. No existing column, constraint,
-- index or policy is touched, and every existing row stays valid.

alter table public.ai_sessions
  add column if not exists source_tmdb_id integer,
  add column if not exists target text;

comment on column public.ai_sessions.source_tmdb_id is
  'mode=bridge only: the film the user asked for an equivalent of. Null for other modes.';
comment on column public.ai_sessions.target is
  'mode=bridge only: the requested industry/language, as the user typed it (e.g. "Malayalam", "Bollywood"). Null for other modes.';

-- No RLS changes required. The existing ai_sessions policies are row-scoped
-- on user_id and apply to every column, so both new columns are already
-- covered by the same four policies. Reprinted here for the record, exactly
-- as they exist today (see 20260821184749_create_core_tables.sql) — this
-- migration does NOT recreate them:
--
--   "Users can view own ai sessions"    for select to authenticated
--                                       using (auth.uid() = user_id)
--   "Users can insert own ai sessions"  for insert to authenticated
--                                       with check (auth.uid() = user_id)
--   "Users can update own ai sessions"  for update to authenticated
--                                       using (auth.uid() = user_id)
--                                       with check (auth.uid() = user_id)
--   "Users can delete own ai sessions"  for delete to authenticated
--                                       using (auth.uid() = user_id)

-- Backfill: rows written by the bridge handler before this migration carry
-- the target in mood_text. Move it into the new column so historic rows are
-- consistent with new ones. source_tmdb_id cannot be recovered for those
-- rows — it was never stored — so it stays null.
update public.ai_sessions
set target = mood_text,
    mood_text = null
where mode = 'bridge'
  and target is null
  and mood_text is not null;
