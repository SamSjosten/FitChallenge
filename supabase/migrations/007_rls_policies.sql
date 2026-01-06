-- =============================================================================
-- MIGRATION 007: ROW LEVEL SECURITY POLICIES
-- This is the security boundary - all authorization enforced here
-- =============================================================================

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.profiles_public enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.activity_logs enable row level security;
alter table public.friends enable row level security;
alter table public.achievements enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_log enable row level security;

-- =============================================================================
-- PROFILES (Self-only)
-- =============================================================================
create policy "Users can view their own full profile"
on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id) with check (auth.uid() = id);

-- =============================================================================
-- PROFILES_PUBLIC (Global read, no client write)
-- =============================================================================
create policy "Public profiles are viewable by everyone"
on public.profiles_public for select using (true);

-- =============================================================================
-- CHALLENGES (Creator or participant)
-- =============================================================================
create policy "Users can view challenges they are part of"
on public.challenges for select
using (
  creator_id = auth.uid()
  or exists (
    select 1 from public.challenge_participants cp
    where cp.challenge_id = challenges.id
      and cp.user_id = auth.uid()
      and cp.invite_status in ('pending', 'accepted')
  )
);

create policy "Users can create challenges"
on public.challenges for insert
with check (creator_id = auth.uid());

create policy "Creators can update their challenges"
on public.challenges for update
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

-- =============================================================================
-- CHALLENGE PARTICIPANTS (Role-based visibility)
-- =============================================================================
create policy "Participants visibility scoped by role"
on public.challenge_participants for select
using (
  -- Creator sees all participants (pending + accepted)
  exists (
    select 1 from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.creator_id = auth.uid()
  )
  -- Accepted participants see only accepted peers
  or (
    invite_status = 'accepted'
    and exists (
      select 1 from public.challenge_participants cp
      where cp.challenge_id = challenge_participants.challenge_id
        and cp.user_id = auth.uid()
        and cp.invite_status = 'accepted'
    )
  )
  -- Users always see their own row
  or user_id = auth.uid()
);

create policy "Creators can invite participants"
on public.challenge_participants for insert
with check (
  exists (
    select 1 from public.challenges c
    where c.id = challenge_id and c.creator_id = auth.uid()
  )
);

create policy "Users can respond to their own invitations"
on public.challenge_participants for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- =============================================================================
-- ACTIVITY LOGS (Self-only)
-- =============================================================================
create policy "Users can view their own activity"
on public.activity_logs for select using (user_id = auth.uid());

create policy "Users can insert their own activity"
on public.activity_logs for insert with check (user_id = auth.uid());

-- =============================================================================
-- FRIENDS (Directional with recipient-only update)
-- =============================================================================
create policy "Friends viewable by participants"
on public.friends for select
using (auth.uid() = requested_by or auth.uid() = requested_to);

create policy "Users can send friend requests"
on public.friends for insert
with check (auth.uid() = requested_by and status = 'pending');

create policy "Recipients can respond to requests"
on public.friends for update
using (auth.uid() = requested_to)
with check (auth.uid() = requested_to);

create policy "Participants can delete friendships"
on public.friends for delete
using (auth.uid() = requested_by or auth.uid() = requested_to);

-- =============================================================================
-- ACHIEVEMENTS (Self-only read, no client write)
-- =============================================================================
create policy "Users can view their own achievements"
on public.achievements for select using (user_id = auth.uid());

-- =============================================================================
-- NOTIFICATIONS (Self-only, no client insert/delete)
-- =============================================================================
create policy "Users can read their notifications"
on public.notifications for select using (auth.uid() = user_id);

create policy "Users can mark notifications read"
on public.notifications for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NOTE: No INSERT/DELETE policies - notifications are server-created, immutable

-- =============================================================================
-- PUSH TOKENS (Self-managed)
-- =============================================================================
create policy "Users can manage their push tokens"
on public.push_tokens for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- CONSENT RECORDS (Self-only)
-- =============================================================================
create policy "Users can view their own consent records"
on public.consent_records for select using (user_id = auth.uid());

create policy "Users can insert their own consent records"
on public.consent_records for insert with check (user_id = auth.uid());

-- =============================================================================
-- AUDIT LOG (Self-only read)
-- =============================================================================
create policy "Users can view their own audit log"
on public.audit_log for select using (user_id = auth.uid());
