-- Social feed / following — CLAUDE.md's Coming Soon item, "see what
-- friends are watching and rating." v1 scope, agreed with the project
-- owner before building: visibility is limited to exactly what a person
-- has ALREADY made public via their own share link — no new privacy
-- surface, no new consent model, nothing this project doesn't already
-- have signed off on.
--
-- Concretely: "following" someone means saving the /w/{token} link THEY
-- chose to share, the same opt-in action that already exists. There is no
-- user directory, no "find people" search, and no way to follow someone
-- who hasn't generated a share link — this table stores a token, not a
-- resolved user_id, so it can never expose ANYTHING api/share.ts's public
-- GET doesn't already return to anyone with that link.
--
-- The feed itself needs ZERO new server code: src/routes/SocialFeed.tsx
-- calls the exact same fetchSharedList(token) (src/lib/shareLink.ts,
-- already built for the public share page) once per followed row and
-- renders the results together. No ratings, no watched list, no other
-- profiles column ever reaches this feature — the public GET never
-- returned those in the first place, so there's nothing new to leak here.
--
-- Ordinary owner-scoped RLS throughout — unlike Duo Match, there is no
-- cross-user write to authorize here: the only write this table ever
-- needs is a user adding/removing their OWN follow row, which auth.uid() =
-- follower_user_id covers directly. No service-role exception needed.

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references auth.users (id) on delete cascade,
  share_token text not null,
  created_at timestamptz not null default now(),
  unique (follower_user_id, share_token)
);

alter table public.follows enable row level security;

create policy "Users can view their own follows"
  on public.follows
  for select
  to authenticated
  using (auth.uid() = follower_user_id);

create policy "Users can create their own follows"
  on public.follows
  for insert
  to authenticated
  with check (auth.uid() = follower_user_id);

create policy "Users can delete their own follows"
  on public.follows
  for delete
  to authenticated
  using (auth.uid() = follower_user_id);

-- Explicit grants, not assumed defaults — see 20260825090000's own
-- reasoning for why this project stopped relying on Postgres/Supabase
-- table-creation defaults for a brand-new table.
grant select, insert, delete on public.follows to authenticated;
revoke update on public.follows from authenticated;
revoke select, insert, update, delete on public.follows from anon;

create index follows_follower_user_id_idx on public.follows (follower_user_id);

-- No explicit step in api/delete-account.ts — same call as share_links'
-- own migration made: this table isn't important enough on its own to add
-- an explicit ordered-delete step for, but the FK cascade above means a
-- deleted account's own follow rows can never outlive it. Note this only
-- cleans up rows where the DELETED account was the follower — a row where
-- someone else follows the deleted account's now-dead share_token simply
-- starts resolving to nothing (api/share.ts's GET already returns 404 for
-- an unknown token, same as any other stale link), never an error.

-- ------------------------------------------------------------------
-- Policies on public.follows after this migration (for the record)
-- ------------------------------------------------------------------
--   "Users can view their own follows"     select to authenticated
--                                          using (auth.uid() = follower_user_id)
--   "Users can create their own follows"   insert to authenticated
--                                          with check (auth.uid() = follower_user_id)
--   "Users can delete their own follows"   delete to authenticated
--                                          using (auth.uid() = follower_user_id)
--   (no update policy; that grant is revoked — a follow row is
--   create/delete only, nothing about it is ever edited in place)
--   anon: no grants at all.
