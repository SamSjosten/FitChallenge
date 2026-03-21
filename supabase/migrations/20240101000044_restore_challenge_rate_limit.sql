-- =============================================================================
-- MIGRATION 044: RESTORE CHALLENGE CREATION RATE LIMIT
-- =============================================================================
-- Migration 041 recreated create_challenge_with_participant with only the
-- start_date guard, dropping the rate-limit guard added in migration 018.
-- This migration restores the complete function with both guards.
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_challenge_with_participant(text, text, integer, text, timestamptz, timestamptz, text, text, text, integer, boolean, text[]);

CREATE OR REPLACE FUNCTION public.create_challenge_with_participant(
  -- Required parameters (no defaults)
  p_title text,
  p_challenge_type text,
  p_goal_value integer,
  p_goal_unit text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  -- Optional parameters (with defaults)
  p_description text DEFAULT NULL,
  p_custom_activity_name text DEFAULT NULL,
  p_win_condition text DEFAULT 'highest_total',
  p_daily_target integer DEFAULT NULL,
  p_is_solo boolean DEFAULT false,
  p_allowed_workout_types text[] DEFAULT NULL
)
RETURNS public.challenges
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_challenge public.challenges;
  v_active_count integer;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  -- Rate limit: max 20 creator-owned non-ended challenges
  SELECT count(*) INTO v_active_count
  FROM public.challenges c
  WHERE c.creator_id = v_user_id
    AND c.status NOT IN ('cancelled', 'archived')
    AND c.end_date > now();

  IF v_active_count >= 20 THEN
    RAISE EXCEPTION 'challenge_limit_reached'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate start_date is not in the past
  IF p_start_date < now() THEN
    RAISE EXCEPTION 'start_date_in_past'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate dates
  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'invalid_dates: end_date must be after start_date';
  END IF;

  -- Validate goal_value
  IF p_goal_value <= 0 THEN
    RAISE EXCEPTION 'invalid_goal_value: must be positive';
  END IF;

  -- Insert challenge
  INSERT INTO public.challenges (
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
    status,
    is_solo,
    allowed_workout_types
  ) VALUES (
    v_user_id,
    p_title,
    p_description,
    p_challenge_type::challenge_type,
    CASE WHEN p_challenge_type = 'custom' THEN p_custom_activity_name ELSE NULL END,
    p_goal_value,
    p_goal_unit,
    p_win_condition::win_condition,
    p_daily_target,
    p_start_date,
    p_end_date,
    'pending',
    COALESCE(p_is_solo, false),
    CASE WHEN p_challenge_type = 'workouts' THEN p_allowed_workout_types ELSE NULL END
  )
  RETURNING * INTO v_challenge;

  -- Insert creator as accepted participant (atomic with challenge creation)
  INSERT INTO public.challenge_participants (
    challenge_id,
    user_id,
    invite_status
  ) VALUES (
    v_challenge.id,
    v_user_id,
    'accepted'
  );

  RETURN v_challenge;
END;
$$;

ALTER FUNCTION public.create_challenge_with_participant SET search_path = public;

COMMENT ON FUNCTION public.create_challenge_with_participant IS
'Atomic challenge creation + creator participation in single transaction.
V4: Restores rate-limit guard (max 20 active creator-owned challenges) lost in migration 041.';
