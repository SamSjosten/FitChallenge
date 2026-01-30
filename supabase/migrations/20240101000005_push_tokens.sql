-- =============================================================================
-- MIGRATION 005: PUSH TOKENS
-- Separate token storage + notification enqueue function
-- =============================================================================

-- =============================================================================
-- PUSH TOKENS TABLE (Multi-device support)
-- =============================================================================
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz default now(),
  last_seen_at timestamptz,
  disabled_at timestamptz,
  
  unique(user_id, token)
);

create index push_tokens_user_idx on public.push_tokens(user_id);

-- =============================================================================
-- CHALLENGE INVITE NOTIFICATION FUNCTION
-- Server-side only notification creation
-- =============================================================================
create or replace function public.enqueue_challenge_invite_notification(
  p_challenge_id uuid,
  p_invited_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_creator_id uuid;
  v_creator_name text;
  v_challenge_title text;
begin
  -- Fetch challenge and verify caller is creator
  select c.creator_id, c.title
  into v_creator_id, v_challenge_title
  from public.challenges c
  where c.id = p_challenge_id;

  if v_creator_id is null then
    raise exception 'challenge_not_found';
  end if;

  if auth.uid() != v_creator_id then
    raise exception 'not_creator';
  end if;

  -- Get creator display name from profiles_public (safe, public data)
  select coalesce(pp.display_name, pp.username)
  into v_creator_name
  from public.profiles_public pp
  where pp.id = v_creator_id;

  -- Create notification record
  insert into public.notifications(user_id, type, title, body, data)
  values (
    p_invited_user_id,
    'challenge_invite_received',
    'New challenge invite',
    v_creator_name || ' invited you to "' || v_challenge_title || '".',
    jsonb_build_object('challenge_id', p_challenge_id)
  );
end;
$$;

-- Set safe search path
alter function public.enqueue_challenge_invite_notification(uuid, uuid)
set search_path = public;

-- =============================================================================
-- FRIEND REQUEST NOTIFICATION FUNCTION
-- =============================================================================
create or replace function public.enqueue_friend_request_notification(
  p_recipient_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_requester_name text;
begin
  -- Get requester display name from profiles_public
  select coalesce(pp.display_name, pp.username)
  into v_requester_name
  from public.profiles_public pp
  where pp.id = auth.uid();

  insert into public.notifications(user_id, type, title, body, data)
  values (
    p_recipient_user_id,
    'friend_request_received',
    'New friend request',
    v_requester_name || ' wants to be your friend.',
    jsonb_build_object('requester_id', auth.uid())
  );
end;
$$;

alter function public.enqueue_friend_request_notification(uuid)
set search_path = public;
