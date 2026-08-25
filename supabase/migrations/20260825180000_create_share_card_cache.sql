-- Caches the AI-generated "verdict line" shown on the shareable watchlist
-- card (extends the share-card feature — see ShareWatchlistCard.tsx and
-- api/ai.ts's mode:'verdict'). One short, dry sentence describing the
-- user's list, e.g. "Mostly thrillers, one romance you're not proud of".
--
-- Cached rather than regenerated on every card open, per the brief: a fresh
-- Claude call every time someone reopens the You tab would be a real,
-- recurring per-open cost for a decorative line that rarely needs to
-- change. mode:'verdict' (api/ai.ts) checks this row first and only calls
-- Claude again when BOTH a cooldown has elapsed AND the underlying list has
-- moved enough to matter — see VERDICT_COOLDOWN_HOURS /
-- VERDICT_CHANGE_THRESHOLD there for the exact numbers.
--
-- One row per user (user_id is the primary key, not a separate id/created_at
-- history table) — there is only ever one "current" verdict to show, so
-- there is nothing to gain from keeping old ones around.
--
-- Written server-side through the caller's own JWT-scoped Supabase client
-- (the same client mode:'verdict' already holds for reading watchlist_items/
-- ratings and for the existing ai_sessions insert other modes do) — not the
-- service-role client. RLS below scopes it to the row's own owner, same
-- shape as every other per-user table in this project.
--
-- Degrades gracefully if this migration hasn't been run yet: mode:'verdict'
-- wraps every query against this table in its own try/catch and falls back
-- to generating live (uncached) on any failure, logging a console.error
-- rather than failing the request — see api/ai.ts's own comment at that
-- call site.

create table public.share_card_cache (
  user_id uuid primary key references auth.users (id) on delete cascade,
  verdict_text text,
  -- Snapshot of (want-list + watched-list) item count at the moment
  -- verdict_text was generated — compared against the current count on the
  -- next request to decide whether enough has changed to regenerate.
  verdict_item_count integer not null default 0,
  verdict_generated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.share_card_cache enable row level security;

create policy "Users can view their own share card cache"
  on public.share_card_cache
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own share card cache"
  on public.share_card_cache
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own share card cache"
  on public.share_card_cache
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Explicit grants, not assumed defaults — see 20260825090000's own reasoning
-- for why this project never relies on Postgres/Supabase table-creation
-- defaults for a brand-new table.
grant select, insert, update on public.share_card_cache to authenticated;
revoke delete on public.share_card_cache from authenticated;
revoke select, insert, update, delete on public.share_card_cache from anon;

-- No explicit step in api/delete-account.ts — same call as share_links'
-- own migration: this table isn't important enough on its own to add an
-- explicit ordered-delete step for, but the FK cascade above means it can
-- never outlive the account either way.

-- ------------------------------------------------------------------
-- Policies on public.share_card_cache after this migration (for the record)
-- ------------------------------------------------------------------
--   "Users can view their own share card cache"    select to authenticated
--                                                   using (auth.uid() = user_id)
--   "Users can create their own share card cache"  insert to authenticated
--                                                   with check (auth.uid() = user_id)
--   "Users can update their own share card cache"  update to authenticated
--                                                   using (auth.uid() = user_id)
--                                                   with check (auth.uid() = user_id)
--   (no delete policy; that grant is revoked — cascade on account deletion
--   is the only way a row is ever removed)
--   anon: no grants at all.
