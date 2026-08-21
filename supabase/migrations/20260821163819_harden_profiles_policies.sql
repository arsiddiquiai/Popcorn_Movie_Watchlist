-- The two profiles policies didn't specify a target role, so Postgres
-- applied them to PUBLIC (every role, including anon). This was never
-- exploitable — auth.uid() evaluates to NULL for anon requests, so
-- `auth.uid() = id` is NULL (never true) and anon still saw zero rows —
-- but leaving policies unrestricted-by-role is a bad pattern to let later
-- tables copy. Scoping them to `authenticated` makes the intent explicit
-- and means the policy isn't even evaluated for anon requests.
alter policy "Users can view own profile" on public.profiles to authenticated;
alter policy "Users can update own profile" on public.profiles to authenticated;
