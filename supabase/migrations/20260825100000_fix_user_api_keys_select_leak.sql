-- Fixes a real bug in 20260825093000_create_user_api_keys.sql: encrypted_key
-- was readable by any authenticated user for their own row, contradicting
-- that migration's own stated design ("encrypted_key is not a granted
-- column ... even with select *").
--
-- Confirmed live: `select encrypted_key from user_api_keys` succeeded and
-- returned the real ciphertext under a JWT-scoped client.
--
-- ROOT CAUSE: Postgres grants are additive, not restrictive. 20260825093000
-- added `grant select (id, user_id, provider, model_pref, created_at) ...`
-- but never revoked the blanket table-wide SELECT that Supabase's default
-- schema privileges already hand `authenticated` on every new table — the
-- exact same default-grant mechanism that gave every other table in this
-- schema working INSERT with no explicit grant at all (see 20260824160000's
-- and 20260825090000's history). A column-level grant only ADDS a
-- permission; it does not narrow one that already exists. The blanket
-- SELECT had to be explicitly revoked FIRST for the narrower column grant
-- to mean anything.
--
-- Practical severity: bounded, not a cross-user leak — RLS still correctly
-- scoped every read to the row's own owner, and the leaked value is AES-256-GCM
-- ciphertext, useless without BYOK_ENCRYPTION_KEY (a server secret with no
-- database counterpart). But it directly contradicts the "even the owner
-- can't read the raw key" design goal stated in CLAUDE.md and the original
-- migration, so it's fixed immediately rather than left as "low severity,
-- acceptable."

revoke select on public.user_api_keys from authenticated;
grant select (id, user_id, provider, model_pref, created_at) on public.user_api_keys to authenticated;

-- No RLS policy changes: "Users can view metadata of their own API keys"
-- already scopes rows correctly to auth.uid() = user_id. This migration is
-- purely a column-grant fix.
