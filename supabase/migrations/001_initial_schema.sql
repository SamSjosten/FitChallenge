-- =============================================================================
-- MIGRATION 001: INITIAL SCHEMA
-- FitChallenge Core Tables
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================
create type challenge_type as enum (
  'steps', 'active_minutes', 'workouts', 'distance', 'custom'
);

create type win_condition as enum (
  'highest_total', 'first_to_goal', 'longest_streak', 'all_complete'
);

create type challenge_status as enum (
  'draft', 'pending', 'active', 'completed', 'archived', 'cancelled'
);

-- =============================================================================
-- PROFILES (Private - self-only access)
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  xp_total integer default 0,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_activity_date date,
  is_premium boolean default false,
  preferred_language text default 'en',
  timezone text default 'UTC',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- CHALLENGES
-- =============================================================================
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  challenge_type challenge_type not null,
  goal_value integer not null,
  goal_unit text not null,
  win_condition win_condition not null default 'highest_total',
  daily_target integer,
  start_date timestamptz not null,
  end_date timestamptz not null,
  status challenge_status default 'pending',
  xp_reward integer default 100,
  max_participants integer default 50,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint valid_dates check (end_date > start_date),
  constraint valid_goal check (goal_value > 0),
  constraint valid_xp check (xp_reward >= 0 and xp_reward <= 10000)
);

-- =============================================================================
-- CHALLENGE PARTICIPANTS
-- =============================================================================
create table public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  invite_status text default 'pending' 
    check (invite_status in ('pending', 'accepted', 'declined', 'removed')),
  current_progress integer default 0,
  current_streak integer default 0,
  completed boolean default false,
  completed_at timestamptz,
  final_rank integer,
  joined_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(challenge_id, user_id)
);

-- =============================================================================
-- ACTIVITY LOGS (Append-only, immutable)
-- =============================================================================
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  challenge_id uuid references public.challenges(id) on delete cascade,
  activity_type challenge_type not null,
  value integer not null,
  unit text not null,
  source text not null check (source in ('manual', 'healthkit', 'googlefit')),
  recorded_at timestamptz not null,
  created_at timestamptz default now(),
  
  constraint valid_value check (value != 0 and value between -10000000 and 10000000)
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================================================
-- ACHIEVEMENTS
-- =============================================================================
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_type text not null,
  unlocked_at timestamptz default now(),
  
  unique(user_id, achievement_type)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index idx_challenges_status on public.challenges(status);
create index idx_challenges_creator on public.challenges(creator_id);
create index idx_challenges_dates on public.challenges(start_date, end_date);
create index idx_participants_user on public.challenge_participants(user_id);
create index idx_participants_challenge on public.challenge_participants(challenge_id);
create index idx_participants_status on public.challenge_participants(challenge_id, invite_status);
create index idx_activity_user_date on public.activity_logs(user_id, recorded_at);
create index idx_activity_challenge on public.activity_logs(challenge_id) where challenge_id is not null;
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;
create index idx_notifications_unsent_push on public.notifications(created_at) where push_sent_at is null;

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at();
create trigger challenges_updated_at before update on public.challenges
  for each row execute function update_updated_at();
create trigger participants_updated_at before update on public.challenge_participants
  for each row execute function update_updated_at();

-- =============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- CHALLENGE STATUS UPDATE FUNCTION (for scheduled jobs)
-- =============================================================================
create or replace function public.update_challenge_statuses()
returns void
language plpgsql
security definer
as $$
begin
  -- Activate challenges that have started
  update public.challenges
  set status = 'active', updated_at = now()
  where status = 'pending'
    and start_date <= now();

  -- Complete challenges that have ended
  update public.challenges
  set status = 'completed', updated_at = now()
  where status = 'active'
    and end_date <= now();
end;
$$;
