-- =============================================================================
-- MIGRATION 002: PROFILES PUBLIC SPLIT
-- Separates public identity from private profile data
-- =============================================================================

-- =============================================================================
-- PROFILES_PUBLIC (Read-only public identity)
-- =============================================================================
create table public.profiles_public (
  id uuid primary key references public.profiles(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- =============================================================================
-- BACKFILL EXISTING USERS
-- =============================================================================
insert into public.profiles_public (id, username, display_name, avatar_url, updated_at)
select id, username, display_name, avatar_url, now()
from public.profiles
on conflict (id) do nothing;

-- =============================================================================
-- SYNC TRIGGER: profiles -> profiles_public
-- =============================================================================
create or replace function public.sync_profiles_public()
returns trigger as $$
begin
  insert into public.profiles_public (id, username, display_name, avatar_url, updated_at)
  values (new.id, new.username, new.display_name, new.avatar_url, now())
  on conflict (id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = excluded.updated_at;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_sync_profiles_public
after insert or update of username, display_name, avatar_url
on public.profiles for each row
execute function public.sync_profiles_public();
