-- =============================================================================
-- MIGRATION 039: LOG_WORKOUT TIME-DERIVED STATUS CHECK
-- =============================================================================
-- Replaces stored-status gate in log_workout() with time-derived check.
--
-- BEFORE: IF v_challenge_status IN ('archived', 'completed', 'cancelled')
--   Risk: Ended challenges accept logs if cached status didn't roll over;
--         active challenges rejected if status drifted.
--
-- AFTER:  start_date <= now() AND end_date > now()
--         AND status NOT IN ('cancelled', 'archived')
--   Only truly time-active, non-cancelled challenges accept workout logs.
--
-- Depends on: migration 034 (log_workout original definition)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_workout(
  p_challenge_id uuid,
  p_workout_type text,
  p_duration_minutes integer,
  p_recorded_at timestamptz,
  p_source text,
  p_client_event_id uuid DEFAULT NULL,
  p_source_external_id text DEFAULT NULL
)
RETURNS integer  -- Returns calculated points
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_challenge_type text;
  v_allowed_types text[];
  v_start_date timestamptz;
  v_end_date timestamptz;
  v_status text;
  v_multiplier numeric;
  v_points integer;
BEGIN
  -- 0) Validate inputs
  IF p_duration_minutes <= 0 OR p_duration_minutes > 1440 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;

  -- 1) Fetch challenge details in one query
  SELECT c.challenge_type::text, c.allowed_workout_types,
         c.start_date, c.end_date, c.status
  INTO v_challenge_type, v_allowed_types,
       v_start_date, v_end_date, v_status
  FROM public.challenges c
  WHERE c.id = p_challenge_id;

  IF v_challenge_type IS NULL THEN
    RAISE EXCEPTION 'challenge_not_found';
  END IF;

  -- Must be a workouts challenge
  IF v_challenge_type != 'workouts' THEN
    RAISE EXCEPTION 'not_workout_challenge';
  END IF;

  -- TIME-DERIVED: Challenge must be currently active based on dates
  -- Exclude explicit cancellation/archival
  IF v_status IN ('cancelled', 'archived') THEN
    RAISE EXCEPTION 'challenge_not_active';
  END IF;

  IF v_start_date > now() THEN
    RAISE EXCEPTION 'challenge_not_active';
  END IF;

  IF v_end_date <= now() THEN
    RAISE EXCEPTION 'challenge_not_active';
  END IF;

  -- 2) Validate participation (must be accepted)
  IF NOT EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  -- 3) Check workout type is allowed for this challenge
  -- NULL or empty array = all types allowed (backward compatible)
  IF v_allowed_types IS NOT NULL AND array_length(v_allowed_types, 1) > 0 THEN
    IF NOT (p_workout_type = ANY(v_allowed_types)) THEN
      RAISE EXCEPTION 'workout_type_not_allowed';
    END IF;
  END IF;

  -- 4) Look up multiplier from catalog (default 1.0 for unknown types)
  SELECT wtc.multiplier
  INTO v_multiplier
  FROM public.workout_type_catalog wtc
  WHERE wtc.workout_type = p_workout_type
    AND wtc.is_active = true;

  IF v_multiplier IS NULL THEN
    v_multiplier := 1.0;  -- Unknown type gets standard multiplier
  END IF;

  -- 5) Calculate points: floor(duration × multiplier)
  v_points := floor(p_duration_minutes * v_multiplier);

  -- 6) Insert activity log with metadata audit trail
  -- Idempotency enforced by existing unique indexes on client_event_id + source_external_id
  INSERT INTO public.activity_logs (
    challenge_id, user_id, activity_type, value, unit, recorded_at,
    source, client_event_id, source_external_id, metadata
  ) VALUES (
    p_challenge_id, auth.uid(), 'workouts'::challenge_type, v_points,
    'points', p_recorded_at, p_source, p_client_event_id, p_source_external_id,
    jsonb_build_object(
      'workout_type', p_workout_type,
      'duration_minutes', p_duration_minutes,
      'multiplier', v_multiplier,
      'points', v_points
    )
  );

  -- 7) Update aggregated counter atomically
  UPDATE public.challenge_participants
  SET current_progress = current_progress + v_points,
      updated_at = now()
  WHERE challenge_id = p_challenge_id
    AND user_id = auth.uid()
    AND invite_status = 'accepted';

  RETURN v_points;
END;
$$;

ALTER FUNCTION public.log_workout SET search_path = public;

COMMENT ON FUNCTION public.log_workout IS
'Server-authoritative workout scoring function.
Inputs: workout_type + duration_minutes → Output: calculated points.
Formula: floor(duration_minutes × multiplier_from_catalog).
Validates: challenge is workouts type, is TIME-DERIVED active
(start_date <= now() AND end_date > now(), not cancelled/archived),
user is participant, workout type is in allowed list.
Idempotent via client_event_id.
Stores full calculation breakdown in activity_logs.metadata for audit.';
