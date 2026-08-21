-- movies_cache, watchlist_items, ratings, ai_sessions — the remaining
-- tables from CLAUDE.md's data model. Same RLS pattern as profiles:
-- RLS enabled on every table, policies scoped `to authenticated`, one
-- policy per operation (no permissive FOR ALL), INSERT/UPDATE paired
-- with WITH CHECK so a row can never be attributed to someone else.

-- ============================================================
-- movies_cache — shared reference data
-- ============================================================
-- Not user-owned: it's a local cache of TMDB metadata keyed by tmdb_id,
-- and the same row is shared by every user who has that movie in their
-- watchlist or ratings (two users adding "Oppenheimer" both point at one
-- movies_cache row). So policies here are keyed on being authenticated
-- at all, not on a user_id column — there isn't one, ownership doesn't
-- apply. Any authenticated user may read and upsert; nobody may delete,
-- since a row may still be referenced by other users' watchlist_items or
-- ratings rows.
create table public.movies_cache (
  tmdb_id integer primary key,
  title text not null,
  poster_path text,
  backdrop_path text,
  release_year integer,
  runtime_minutes integer,
  genres text[],
  overview text,
  tmdb_rating numeric,
  original_language text,
  trailer_key text,
  credits jsonb,
  cached_at timestamptz default now()
);

alter table public.movies_cache enable row level security;

create policy "Authenticated users can view movies_cache"
  on public.movies_cache
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert movies_cache rows"
  on public.movies_cache
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update movies_cache rows"
  on public.movies_cache
  for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy, and no policy at all for the anon role: cached rows
-- are shared and may be referenced by other users; deletion is left out
-- entirely for now rather than opened up unnecessarily.

-- ============================================================
-- watchlist_items
-- ============================================================
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null references public.movies_cache (tmdb_id),
  status text not null default 'want' check (status in ('want', 'watched', 'dropped')),
  added_at timestamptz not null default now(),
  watched_at timestamptz,
  unique (user_id, tmdb_id)
);

alter table public.watchlist_items enable row level security;

create policy "Users can view own watchlist items"
  on public.watchlist_items
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist items"
  on public.watchlist_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own watchlist items"
  on public.watchlist_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own watchlist items"
  on public.watchlist_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index watchlist_items_user_id_status_idx on public.watchlist_items (user_id, status);

-- ============================================================
-- ratings
-- ============================================================
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null references public.movies_cache (tmdb_id),
  score integer not null check (score between 1 and 10),
  reason_tags text[],
  review_text text,
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

alter table public.ratings enable row level security;

create policy "Users can view own ratings"
  on public.ratings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own ratings"
  on public.ratings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own ratings"
  on public.ratings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own ratings"
  on public.ratings
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index ratings_user_id_idx on public.ratings (user_id);

-- ============================================================
-- ai_sessions
-- ============================================================
create table public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('pick', 'bridge', 'taste')),
  mood_text text,
  energy_level integer,
  minutes_available integer,
  company text,
  tier integer,
  recommended_tmdb_id integer,
  reason_text text,
  accepted boolean,
  created_at timestamptz not null default now()
);

alter table public.ai_sessions enable row level security;

create policy "Users can view own ai sessions"
  on public.ai_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own ai sessions"
  on public.ai_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own ai sessions"
  on public.ai_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own ai sessions"
  on public.ai_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index ai_sessions_user_id_created_at_idx on public.ai_sessions (user_id, created_at desc);
