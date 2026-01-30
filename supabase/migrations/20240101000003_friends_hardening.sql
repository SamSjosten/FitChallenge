-- =============================================================================
-- MIGRATION 003: FRIENDS HARDENING
-- Directional friendship with recipient-only acceptance
-- =============================================================================

-- =============================================================================
-- FRIENDS TABLE
-- =============================================================================
create table public.friends (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_to uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' 
    check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Computed columns for bidirectional uniqueness
  user_low uuid generated always as (least(requested_by, requested_to)) stored,
  user_high uuid generated always as (greatest(requested_by, requested_to)) stored,
  
  -- Ensure requester and recipient are different
  constraint friends_no_self_request check (requested_by != requested_to),
  
  -- Exactly one row per directional request
  constraint friends_unique_request unique (requested_by, requested_to)
);

-- =============================================================================
-- PREVENT BIDIRECTIONAL DUPLICATES
-- Prevents A→B when B→A already exists (eliminates race conditions)
-- =============================================================================
create unique index friends_unique_pair_bidirectional 
on public.friends(user_low, user_high);

-- =============================================================================
-- INDEXES FOR EFFICIENT LOOKUPS
-- =============================================================================
create index friends_by_idx on public.friends(requested_by);
create index friends_to_idx on public.friends(requested_to);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
create trigger friends_updated_at before update on public.friends
  for each row execute function update_updated_at();
