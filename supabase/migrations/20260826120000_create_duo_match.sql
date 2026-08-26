-- Duo Match — CLAUDE.md's Coming Soon item, "find something to watch
-- together with a partner." Two people swipe the same fixed candidate
-- deck; a match is a film both of them liked.
--
-- candidates is a snapshot (jsonb array of {tmdb_id, title, poster_path,
-- release_year}) taken once, at session creation, from TMDB's trending
-- list — not re-fetched live on every read. TMDB's trending results shift
-- day to day, and both participants swiping through the SAME list is the
-- whole point; a live re-fetch could hand the guest a different deck than
-- the host saw an hour earlier.
--
-- RLS here has one genuine wrinkle the rest of this schema doesn't: a
-- brand-new guest joining via invite link is, at the moment they try to
-- join, neither the host nor an already-recorded participant — no
-- owner-based predicate can authorize that first write. Same shape as the
-- public share link's GET needing the service-role client (see
-- share_links' own migration): the ONE join transition goes through
-- api/duo-join.ts using the service-role client, enforced there (token
-- must resolve to a real session, caller can't be the host, the session
-- can't already have a different guest); every other read/write (voting,
-- checking for matches, reading the candidate deck) goes through the
-- caller's own JWT-scoped client under the RLS policies below, once
-- they're genuinely attached to the session as host or guest.
--
-- No anon grants at all, on either table — unlike the public share link,
-- an invite is never shown to a logged-out visitor. Someone who isn't
-- signed in yet is sent straight to sign-in/signup first (src/routes/
-- DuoInvite.tsx), with the token held in sessionStorage until they're
-- authenticated, then joined the same way a pending share-link import
-- happens post-signup (see src/lib/shareLink.ts's own pattern — src/lib/
-- duoMatch.ts's pending-join helpers mirror it directly).

create table public.duo_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_token text not null unique,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  guest_user_id uuid references auth.users (id) on delete cascade,
  candidates jsonb not null,
  created_at timestamptz not null default now()
);

create table public.duo_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.duo_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  liked boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, user_id, tmdb_id)
);

alter table public.duo_sessions enable row level security;
alter table public.duo_votes enable row level security;

create policy "Participants can view their session"
  on public.duo_sessions
  for select
  to authenticated
  using (auth.uid() = host_user_id or auth.uid() = guest_user_id);

create policy "Users can create their own session"
  on public.duo_sessions
  for insert
  to authenticated
  with check (auth.uid() = host_user_id);

-- No update/delete policy for `authenticated` at all — the only update
-- this table ever needs (attaching a guest) is exactly the transition
-- described above that RLS structurally can't authorize for the guest's
-- own sake, so it's handled by api/duo-join.ts's service-role client
-- instead, never by a client-side update() call.

create policy "Participants can view session votes"
  on public.duo_votes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.duo_sessions s
      where s.id = duo_votes.session_id
        and (s.host_user_id = auth.uid() or s.guest_user_id = auth.uid())
    )
  );

create policy "Participants can cast their own vote"
  on public.duo_votes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.duo_sessions s
      where s.id = duo_votes.session_id
        and (s.host_user_id = auth.uid() or s.guest_user_id = auth.uid())
    )
  );

-- Explicit grants, not assumed defaults — see 20260825090000's own
-- reasoning for why this project never relies on Postgres/Supabase
-- table-creation defaults for a brand-new table.
grant select, insert on public.duo_sessions to authenticated;
revoke update, delete on public.duo_sessions from authenticated;
revoke select, insert, update, delete on public.duo_sessions from anon;

grant select, insert on public.duo_votes to authenticated;
revoke update, delete on public.duo_votes from authenticated;
revoke select, insert, update, delete on public.duo_votes from anon;

create index duo_sessions_invite_token_idx on public.duo_sessions (invite_token);
create index duo_votes_session_id_idx on public.duo_votes (session_id);

-- No explicit step in api/delete-account.ts — same call as share_links'
-- own migration made: neither table is important enough on its own to add
-- an explicit ordered-delete step for, but the FK cascades above (both
-- host_user_id and guest_user_id on duo_sessions, user_id on duo_votes)
-- mean a deleted account's rows can never outlive it either way. A
-- session where only the host is deleted keeps existing for the guest,
-- with host_user_id cascaded to... actually removed entirely, since the
-- FK is ON DELETE CASCADE on the session row itself, not SET NULL — an
-- account deletion removes every duo_sessions row that account hosted or
-- guested, cleanly, rather than leaving an orphaned half-session behind.

-- ------------------------------------------------------------------
-- Policies on public.duo_sessions / public.duo_votes after this migration
-- (for the record)
-- ------------------------------------------------------------------
--   duo_sessions:
--     "Participants can view their session"     select to authenticated
--                                                using (auth.uid() = host_user_id or auth.uid() = guest_user_id)
--     "Users can create their own session"       insert to authenticated
--                                                with check (auth.uid() = host_user_id)
--     (no update/delete policy; those grants are revoked — joining a
--     session is done by api/duo-join.ts via the service-role client)
--     anon: no grants at all.
--
--   duo_votes:
--     "Participants can view session votes"      select to authenticated
--                                                using (exists (... host or guest of the session ...))
--     "Participants can cast their own vote"     insert to authenticated
--                                                with check (user_id = auth.uid() and exists (... participant ...))
--     (no update/delete policy; those grants are revoked — a vote is
--     final once cast, for v1)
--     anon: no grants at all.
