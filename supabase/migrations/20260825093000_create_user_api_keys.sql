-- Bring Your Own Key (BYOK), multi-provider. One row per (user, provider) —
-- a user may save at most one key per provider, so switching providers is a
-- delete-and-re-add rather than an update-in-place ambiguity. (In practice
-- api/user-api-key.ts's "save" action clears ALL of a user's rows before
-- inserting the new one, so this stays at 0 or 1 rows per user — see that
-- file's own comment for why.)
--
-- INSERT and DELETE are allowed under normal RLS (save / replace / remove).
-- encrypted_key itself is NEVER selectable by anyone but the service role —
-- not even its own owner — enforced at the COLUMN level, not just by
-- omitting a select policy: the grant below explicitly lists which columns
-- authenticated may read, and encrypted_key is not one of them. Only
-- server/byok.ts, running under the service-role key
-- (SUPABASE_SERVICE_ROLE_KEY), ever reads encrypted_key, and only to
-- decrypt it server-side for a single Claude/OpenAI/Gemini call.
--
-- The narrow select IS needed, though: the brief asks for a masked "Key
-- saved ****" indicator in Settings, which has to survive a page reload —
-- session-only client state would forget it existed. So authenticated may
-- read id/provider/model_pref/created_at (enough to say "yes, an OpenAI key
-- is saved, added Aug 24") but structurally cannot read encrypted_key even
-- with `select *`, since that column was never granted.
--
-- encrypted_key holds AES-256-GCM ciphertext (iv:authTag:ciphertext, each
-- base64, colon-joined) — see server/crypto.ts. The encryption key
-- (BYOK_ENCRYPTION_KEY) is a server secret with no database counterpart, so
-- even a full dump of this table is useless without it regardless.

create table public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'gemini')),
  encrypted_key text not null check (length(encrypted_key) > 0),
  model_pref text,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_api_keys enable row level security;

create policy "Users can view metadata of their own API keys"
  on public.user_api_keys
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can save their own API keys"
  on public.user_api_keys
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own API keys"
  on public.user_api_keys
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Explicit grants, not assumed defaults — 20260825090000 exists precisely
-- because that assumption failed once already for a brand-new table.
grant insert, delete on public.user_api_keys to authenticated;

-- Column-level SELECT: everything except encrypted_key. This is the actual
-- enforcement point — the select POLICY above only decides which ROWS are
-- visible; this decides which COLUMNS are, and is what makes "never expose
-- the key to the client" true even for the row's own owner.
grant select (id, user_id, provider, model_pref, created_at) on public.user_api_keys to authenticated;

revoke update on public.user_api_keys from authenticated;
revoke select, insert, update, delete on public.user_api_keys from anon;

create index user_api_keys_user_id_idx on public.user_api_keys (user_id);

-- ------------------------------------------------------------------
-- Policies on public.user_api_keys after this migration (for the record)
-- ------------------------------------------------------------------
--   "Users can view metadata of their own API keys"  select to authenticated
--                                          using (auth.uid() = user_id)
--                                          -- but encrypted_key is not a
--                                          -- granted column at all
--   "Users can save their own API keys"    insert to authenticated
--                                          with check (auth.uid() = user_id)
--   "Users can delete their own API keys"  delete to authenticated
--                                          using (auth.uid() = user_id)
--   (no update policy; that grant is revoked)
