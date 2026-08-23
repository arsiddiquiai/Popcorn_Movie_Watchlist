-- Closes a confirmed integrity hole in movies_cache, the one shared,
-- non-user-owned table in the schema.
--
-- The policies created in 20260821184749_create_core_tables.sql were:
--
--   "Authenticated users can view movies_cache"    select  using (true)
--   "Authenticated users can insert movies_cache rows"  insert  with check (true)
--   "Authenticated users can update movies_cache rows"  update  using (true)
--                                                               with check (true)
--   (no delete policy)
--
-- The UPDATE policy meant ANY authenticated user could rewrite ANY column of
-- ANY row, for every other user. A security audit demonstrated this live
-- against the production database using only the public anon key: it renamed
-- "Oppenheimer" (tmdb_id 872585) and restored it. Since the client owns the
-- write path (src/lib/watchlist.ts getOrCacheMovie upserts a
-- browser-controlled payload), nothing constrained the content to real TMDB
-- data.
--
-- The fix rests on an observation about how the cache is actually used: NO
-- code path ever legitimately updates an existing row. Both getOrCacheMovie
-- and ensureMovieCached (api/ai.ts, netlify/functions/ai.ts) SELECT first and
-- return early when the row is present, so their .upsert() is only ever
-- reached when the row is ABSENT. The UPDATE privilege existed solely to
-- absorb the race where two users add the same film at once — and that race
-- is better handled with ON CONFLICT DO NOTHING, which needs only INSERT.
--
-- Those call sites are updated in the same commit to pass
-- { onConflict: 'tmdb_id', ignoreDuplicates: true } and then re-select, so
-- they no longer depend on UPDATE at all.

-- ------------------------------------------------------------------
-- 1. No client may modify or remove an existing cached row.
-- ------------------------------------------------------------------
drop policy if exists "Authenticated users can update movies_cache rows" on public.movies_cache;

-- Supabase grants these table-wide to `authenticated` by default; the policy
-- was only half the story. DELETE already had no policy, but revoking the
-- grant too means the intent is enforced at both layers.
revoke update, delete on public.movies_cache from authenticated;

-- ------------------------------------------------------------------
-- 2. INSERT stays open — that is how the cache legitimately fills — but is
--    bounded to plausible shapes so a new row cannot be arbitrary junk.
-- ------------------------------------------------------------------
-- Verified against all 90 existing rows before writing this: zero violations,
-- so these apply cleanly to current data.
alter table public.movies_cache
  add constraint movies_cache_tmdb_id_positive  check (tmdb_id > 0),
  add constraint movies_cache_title_nonempty    check (length(btrim(title)) > 0),
  add constraint movies_cache_rating_range      check (tmdb_rating is null or tmdb_rating between 0 and 10),
  add constraint movies_cache_year_plausible    check (release_year is null or release_year between 1870 and 2100),
  add constraint movies_cache_runtime_positive  check (runtime_minutes is null or runtime_minutes > 0);

-- ------------------------------------------------------------------
-- Policies on public.movies_cache after this migration (for the record)
-- ------------------------------------------------------------------
--   "Authenticated users can view movies_cache"          select to authenticated using (true)
--   "Authenticated users can insert movies_cache rows"   insert to authenticated with check (true)
--   (no update policy, and the update grant is revoked)
--   (no delete policy, and the delete grant is revoked)
--
-- ACCEPTED RESIDUAL RISK, recorded deliberately rather than left implicit:
-- a user can still INSERT a row for a tmdb_id nobody has cached yet, with a
-- fake (but well-shaped) title. Whoever adds that film later reads the
-- poisoned row, because the read path returns early on any existing row.
-- Closing that would require routing all cache writes through the server
-- function under a service-role key, which this project does not have and
-- which would add a round-trip to search. Corruption of films already in the
-- cache — the demonstrated attack — is fully closed by this migration.
