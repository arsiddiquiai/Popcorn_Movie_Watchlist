-- Fixes a real bug in 20260824160000_create_feedback.sql: INSERT on
-- public.feedback is refused for `authenticated` with "permission denied for
-- table feedback" (42501) — a missing table-level GRANT, not an RLS policy
-- rejection (which reads "new row violates row-level security policy...").
--
-- Every earlier table in this schema got a working INSERT purely from
-- Supabase's default schema privileges, and no prior migration ever needed
-- to GRANT it explicitly. feedback is the first case where that default
-- apparently didn't apply. Rather than guess why, this grants it explicitly
-- so the table doesn't depend on an assumption that just failed once.

grant insert on public.feedback to authenticated;

-- Unchanged from 20260824160000: still insert-only, still row-scoped to the
-- caller's own user_id via "Users can submit their own feedback", still no
-- select/update/delete grant or policy.
