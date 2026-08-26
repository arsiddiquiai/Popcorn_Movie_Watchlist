-- TV shows, web series & anime — CLAUDE.md's Coming Soon item. v1 scope
-- agreed with the project owner: search + watchlist + rating only, whole-
-- series granularity (no per-episode tracking), Pick For Me/Cinema Bridge/
-- Taste DNA stay movies-only for now.
--
-- DELIBERATELY FULLY PARALLEL to movies_cache/watchlist_items/ratings,
-- not a shared/unified schema with a media_type column bolted on. Reason:
-- watchlist_items.tmdb_id and ratings.tmdb_id both carry a REAL foreign
-- key to movies_cache(tmdb_id) (see 20260821184749_create_core_tables.sql)
-- — a live constraint on tables already holding real production users'
-- data. TMDB's movie and TV id spaces are separate and can collide
-- numerically, so making those existing columns TV-aware would mean
-- either widening/altering that FK (Postgres can't express "references
-- table A OR table B" in one constraint) or dropping it outright and
-- trusting the application layer instead — both are real ALTERs on
-- tables the live app depends on every single day. Three new,
-- independent tables cost some duplicated schema and application code,
-- but touch nothing that already exists: zero ALTER statements anywhere
-- in this migration, and if anything about this feature needs to be
-- unwound later, it's a matter of not using these three tables, not
-- reversing a change to shared ones.
--
-- Same RLS/grant shape as their movie equivalents throughout, and the
-- same "no FK enforcement" pattern api/ai.ts's ai_sessions.recommended_
-- tmdb_id already uses for a tmdb_id reference that doesn't need one —
-- tv_watchlist_items/tv_ratings DO get a real FK to tv_cache, exactly
-- like the movie tables have to movies_cache, since that's a genuinely
-- new constraint on a genuinely new table, not a retrofit onto an
-- existing one.

-- ============================================================
-- tv_cache — shared reference data, mirrors movies_cache exactly
-- ============================================================
create table public.tv_cache (
  tmdb_id integer primary key,
  name text not null,
  poster_path text,
  backdrop_path text,
  first_air_year integer,
  episode_run_minutes integer,
  genres text[],
  overview text,
  tmdb_rating numeric,
  original_language text,
  trailer_key text,
  credits jsonb,
  cached_at timestamptz default now()
);

alter table public.tv_cache enable row level security;

create policy "Authenticated users can view tv_cache"
  on public.tv_cache
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert tv_cache rows"
  on public.tv_cache
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update tv_cache rows"
  on public.tv_cache
  for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- tv_watchlist_items — mirrors watchlist_items exactly
-- ============================================================
create table public.tv_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null references public.tv_cache (tmdb_id),
  status text not null default 'want' check (status in ('want', 'watched', 'dropped')),
  added_at timestamptz not null default now(),
  watched_at timestamptz,
  unique (user_id, tmdb_id)
);

alter table public.tv_watchlist_items enable row level security;

create policy "Users can view own tv watchlist items"
  on public.tv_watchlist_items
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own tv watchlist items"
  on public.tv_watchlist_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own tv watchlist items"
  on public.tv_watchlist_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own tv watchlist items"
  on public.tv_watchlist_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index tv_watchlist_items_user_id_status_idx on public.tv_watchlist_items (user_id, status);

-- ============================================================
-- tv_ratings — mirrors ratings exactly
-- ============================================================
create table public.tv_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null references public.tv_cache (tmdb_id),
  score integer not null check (score between 1 and 10),
  reason_tags text[],
  review_text text,
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

alter table public.tv_ratings enable row level security;

create policy "Users can view own tv ratings"
  on public.tv_ratings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own tv ratings"
  on public.tv_ratings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own tv ratings"
  on public.tv_ratings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own tv ratings"
  on public.tv_ratings
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index tv_ratings_user_id_idx on public.tv_ratings (user_id);

-- Explicit grants, not assumed defaults — see 20260825090000's own
-- reasoning for why this project stopped relying on Postgres/Supabase
-- table-creation defaults for a brand-new table. (The original movie
-- tables in 20260821184749 predate that hardening and rely on RLS alone;
-- these new tables get the stricter, current convention from day one.)
grant select, insert, update on public.tv_cache to authenticated;
revoke delete on public.tv_cache from authenticated;
revoke select, insert, update, delete on public.tv_cache from anon;

grant select, insert, update, delete on public.tv_watchlist_items to authenticated;
revoke select, insert, update, delete on public.tv_watchlist_items from anon;

grant select, insert, update, delete on public.tv_ratings to authenticated;
revoke select, insert, update, delete on public.tv_ratings from anon;

-- No explicit step in api/delete-account.ts. Unlike the movie tables
-- (which get explicit ordered deletes there, checked before proceeding —
-- see that file's own header for why), these two are new and lower-
-- stakes for v1; the on delete cascade FKs above are sufficient to
-- guarantee a deleted account's rows never outlive it. Worth promoting to
-- an explicit step alongside ratings/watchlist_items if TV usage grows.

-- ------------------------------------------------------------------
-- Policies on public.tv_cache / tv_watchlist_items / tv_ratings after
-- this migration (for the record) — identical shape to their movie
-- equivalents throughout.
-- ------------------------------------------------------------------
--   tv_cache: select/insert/update to authenticated using/with check
--             (true) — shared reference data, no delete policy, no anon
--             grants (same as movies_cache).
--   tv_watchlist_items: select/insert/update/delete to authenticated,
--             all scoped to auth.uid() = user_id.
--   tv_ratings: select/insert/update/delete to authenticated, all scoped
--             to auth.uid() = user_id.
