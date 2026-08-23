-- Closes a confirmed bypass of the AI Movie Assistant's 30-messages-per-UTC-day
-- usage cap (CLAUDE.md, mode: assistant).
--
-- The cap is computed as: count of ai_sessions rows WHERE user_id = me
-- AND mode = 'assistant' AND created_at >= start of today (UTC). Nothing about
-- that count was server-authoritative, and the table's own policies let the
-- client drive it back down. A security audit demonstrated all three vectors
-- live, using nothing but the public anon key:
--
--   1. DELETE the quota rows        -> count 30 -> 0, capped user served again
--   2. UPDATE created_at into the past -> row leaves today's window
--   3. UPDATE mode 'assistant'->'pick' -> row stops matching the filter
--
-- So dropping the DELETE policy alone would NOT have fixed this. The UPDATE
-- policy has to be narrowed too.
--
-- The app only ever needs to update ONE column on this table: pickClient.ts
-- writes `accepted` when the user accepts/rejects a Pick For Me result
-- (src/lib/pickClient.ts). Nothing in the app deletes ai_sessions rows at all.
-- RLS cannot express "only this column", so column privileges do that job,
-- while the existing row-scoped RLS policy continues to restrict which rows
-- are reachable. Both apply together.

-- ------------------------------------------------------------------
-- 1. Remove client deletion entirely.
-- ------------------------------------------------------------------
drop policy if exists "Users can delete own ai sessions" on public.ai_sessions;

-- ------------------------------------------------------------------
-- 2. Narrow UPDATE to the single column the app actually writes.
-- ------------------------------------------------------------------
-- Supabase grants table-wide UPDATE to `authenticated` by default; that is
-- what made created_at and mode writable. Replace it with a column grant.
revoke update on public.ai_sessions from authenticated;
grant  update (accepted) on public.ai_sessions to authenticated;

-- The row-scoped UPDATE policy is deliberately left in place and unchanged:
--
--   "Users can update own ai sessions"  for update to authenticated
--                                       using (auth.uid() = user_id)
--                                       with check (auth.uid() = user_id)
--
-- Net effect: an authenticated user may set `accepted` on their own rows and
-- nothing else. created_at, mode, user_id and the rest are no longer writable
-- from the client, and rows cannot be removed, so the daily count is
-- monotonic and the cap holds.

-- ------------------------------------------------------------------
-- Policies on public.ai_sessions after this migration (for the record)
-- ------------------------------------------------------------------
--   "Users can view own ai sessions"    for select to authenticated
--                                       using (auth.uid() = user_id)
--   "Users can insert own ai sessions"  for insert to authenticated
--                                       with check (auth.uid() = user_id)
--   "Users can update own ai sessions"  for update to authenticated
--                                       using (auth.uid() = user_id)
--                                       with check (auth.uid() = user_id)
--                                       + column grant limited to (accepted)
--   (no delete policy)
--
-- INSERT is intentionally left open to the user's own rows: a client can only
-- add rows against itself, which can raise its own usage count but never
-- lower it, so it cannot be used to gain quota.
