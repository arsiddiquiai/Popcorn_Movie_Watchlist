-- profiles table: one row per auth.users row, created automatically by
-- the trigger below (never created client-side).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  theme_pref text not null default 'nightcap',
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can only read their own profile row.
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can only update their own profile row. No insert policy is
-- defined on purpose: profile rows are created exclusively by the
-- handle_new_user trigger (via security definer), never by the client,
-- so creation can't be skipped or duplicated.
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Creates a matching profiles row whenever a new user signs up.
-- security definer + a locked search_path so it runs with the
-- privileges needed to bypass RLS for this one insert, safely.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
