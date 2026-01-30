-- =============================================================================
-- MIGRATION 014: ATOMIC CHALLENGE CREATION
-- Creates a challenge and its creator participant in a single transaction
-- Prevents partial state where challenge exists without creator participation
-- =============================================================================

-- =============================================================================
-- CREATE_CHALLENGE_WITH_PARTICIPANT RPC FUNCTION
-- Single transaction: insert challenge + insert creator as accepted participant
-- Returns the created challenge row
--
-- Parameter order: Required params first, optional params with defaults last
-- =============================================================================
create or replace function public.create_challenge_with_participant(
  -- Required parameters (no defaults)
  p_title text,
  p_challenge_type text,
  p_goal_value integer,
  p_goal_unit text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  -- Optional parameters (with defaults)
  p_description text default null,
  p_custom_activity_name text default null,
  p_win_condition text default 'highest_total',
  p_daily_target integer default null
)
returns public.challenges
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_challenge public.challenges;
begin
  -- Get authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  -- Validate dates
  if p_end_date <= p_start_date then
    raise exception 'invalid_dates: end_date must be after start_date';
  end if;

  -- Validate goal_value
  if p_goal_value <= 0 then
    raise exception 'invalid_goal_value: must be positive';
  end if;

  -- Insert challenge
  insert into public.challenges (
    creator_id,
    title,
    description,
    challenge_type,
    custom_activity_name,
    goal_value,
    goal_unit,
    win_condition,
    daily_target,
    start_date,
    end_date,
    status
  ) values (
    v_user_id,
    p_title,
    p_description,
    p_challenge_type::challenge_type,
    case when p_challenge_type = 'custom' then p_custom_activity_name else null end,
    p_goal_value,
    p_goal_unit,
    p_win_condition::win_condition,
    p_daily_target,
    p_start_date,
    p_end_date,
    'pending'
  )
  returning * into v_challenge;

  -- Insert creator as accepted participant (atomic with challenge creation)
  insert into public.challenge_participants (
    challenge_id,
    user_id,
    invite_status
  ) values (
    v_challenge.id,
    v_user_id,
    'accepted'
  );

  return v_challenge;
end;
$$;

-- Set safe search path
alter function public.create_challenge_with_participant(text, text, integer, text, timestamptz, timestamptz, text, text, text, integer)
set search_path = public;

-- Add function comment for documentation
comment on function public.create_challenge_with_participant is 
'Atomically creates a challenge and adds the creator as an accepted participant.
Returns the created challenge row.
CONTRACT: If either insert fails, the entire transaction is rolled back.';