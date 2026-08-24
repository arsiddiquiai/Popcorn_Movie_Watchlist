-- Feedback form (nav item below Settings). One row per submission.
--
-- DEVIATION FROM THE BRIEF, flagged rather than made silently: the requested
-- columns were (id, user_id, message, created_at), but the form takes an
-- OPTIONAL email and the notification email is specified to include "user's
-- email if given". With only those four columns there is nowhere to put it
-- except concatenated into `message`, which would make it unqueryable and
-- mix user prose with contact data. Added `contact_email` as its own nullable
-- column instead.
--
-- user_id is nullable per the brief (leaves room for anonymous submissions
-- later), but every current route in the app sits behind ProtectedLayout, so
-- in practice it is always populated today.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null check (length(btrim(message)) between 1 and 4000),
  contact_email text check (contact_email is null or length(btrim(contact_email)) between 3 and 320),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Insert only, and only against your own user_id. There is deliberately NO
-- select policy: feedback is write-only from the client's perspective, the
-- same shape as the BYOK key. Nobody should be able to read the feedback
-- table through the anon key, including their own rows — it is read out of
-- band (the notification email, or the SQL editor).
create policy "Users can submit their own feedback"
  on public.feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No select / update / delete policies, and the grants are revoked too so a
-- missing policy fails loudly (42501) rather than silently returning zero
-- rows — the same lesson applied in 20260824120000.
revoke select, update, delete on public.feedback from authenticated;
revoke select, update, delete on public.feedback from anon;

create index feedback_created_at_idx on public.feedback (created_at desc);

-- ------------------------------------------------------------------
-- Policies on public.feedback after this migration (for the record)
-- ------------------------------------------------------------------
--   "Users can submit their own feedback"  insert to authenticated
--                                          with check (auth.uid() = user_id)
--   (no select, update or delete policy; those grants are revoked)
