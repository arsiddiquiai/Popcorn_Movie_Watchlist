-- Public shareable watchlist links (/w/{token}) — CLAUDE.md's Scope
-- Discipline section previously listed "public share links" under Parked
-- ("do not build"); this migration exists because the project owner
-- explicitly reversed that call and asked for it directly. See CLAUDE.md's
-- own Scope Discipline section, updated in the same change, for the note
-- moving it off Parked.
--
-- LIVE list, not a snapshot: this table stores only the token -> user_id
-- mapping, nothing else. The public page (served by api/share.ts's GET,
-- via the service-role client — see server/serviceClient.ts) reads the
-- sharer's CURRENT status='want' rows at view time. A snapshot approach
-- would need an extra tmdb_ids array/column captured at share-creation and
-- would leave the shared page permanently stale the moment the sharer's
-- real list changes — the live approach reuses the exact same watchlist
-- query shape the rest of the app already has, and needs nothing else
-- stored here.
--
-- Every row is owned by exactly one user, deleted with the rest of their
-- data on account deletion (the FK cascade is the backstop, per this
-- project's usual explicit-delete-plus-cascade pattern — see
-- api/delete-account.ts's own header comment for that reasoning; this
-- table wasn't important enough on its own to add an explicit deletion
-- step there, but the cascade means it can never outlive the account).
--
-- The token itself is generated server-side (api/share.ts, Node's
-- crypto.randomBytes, base64url-encoded — not this table's default, and
-- deliberately not sequential or derived from the row id/timestamp) and is
-- the only thing that ever reaches the client in a shareable URL. The
-- mapping to user_id never leaves the server — GET /api/share returns
-- display name + poster list, never the user_id or token->user lookup
-- itself.

create table public.share_links (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.share_links enable row level security;

-- These policies exist for a possible future "manage my share links" UI
-- (see one link, revoke it) — the actual public-facing GET never goes
-- through them at all; it reads via the service-role client, which
-- bypasses RLS entirely, precisely because an anonymous visitor has no
-- session for one of these policies to key off of.
create policy "Users can view their own share links"
  on public.share_links
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own share links"
  on public.share_links
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own share links"
  on public.share_links
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Explicit grants, not assumed defaults — 20260825090000 exists precisely
-- because that assumption failed once already for a brand-new table.
grant select, insert, delete on public.share_links to authenticated;
revoke update on public.share_links from authenticated;
revoke select, insert, update, delete on public.share_links from anon;

create index share_links_user_id_idx on public.share_links (user_id);

-- ------------------------------------------------------------------
-- Policies on public.share_links after this migration (for the record)
-- ------------------------------------------------------------------
--   "Users can view their own share links"    select to authenticated
--                                              using (auth.uid() = user_id)
--   "Users can create their own share links"  insert to authenticated
--                                              with check (auth.uid() = user_id)
--   "Users can delete their own share links"  delete to authenticated
--                                              using (auth.uid() = user_id)
--   (no update policy; that grant is revoked)
--   anon: no grants at all — the public /w/{token} page is served by
--   api/share.ts's GET using the service-role client, never the anon key.
