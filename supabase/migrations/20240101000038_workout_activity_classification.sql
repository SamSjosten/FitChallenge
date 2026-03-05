-- supabase/migrations/20240101000038_workout_activity_classification.sql
-- =============================================================================
-- Workout Activity Classification
-- =============================================================================
-- Phase 3: Store workout subtype data and enable filtered workout challenges.
--
-- Changes:
--   1. activity_logs.workout_activity_key — stores which specific workout type
--      (e.g. "running", "yoga", "strength_training") for workout activities
--   2. challenges.workout_activity_filter — optional text[] filter for workout
--      challenges. NULL = all workouts count. ['running'] = only running counts.
--   3. Updates log_health_activity RPC to write workout_activity_key
--   4. Updates get_challenges_for_health_sync to return workout_activity_filter
--      and fixes column alias (id → challenge_id) from migration 031
-- =============================================================================

-- =============================================================================
-- PART 1: SCHEMA CHANGES
-- =============================================================================

-- Stores the specific workout type for workout activities (e.g. "running", "yoga")
-- NULL for non-workout activities (steps, distance, calories, etc.)
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS workout_activity_key text DEFAULT NULL;

-- Index for filtering by workout type in queries
CREATE INDEX IF NOT EXISTS activity_logs_workout_key_idx
  ON public.activity_logs (workout_activity_key)
  WHERE workout_activity_key IS NOT NULL;

-- Optional filter: which workout types count toward this challenge.
-- NULL = all workouts count (catch-all "any workout" challenge)
-- ['running'] = only running workouts count
-- ['running', 'hiking'] = running and hiking count
-- Ignored when challenge_type != 'workouts'
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS workout_activity_filter text[] DEFAULT NULL;

-- =============================================================================
-- PART 2: UPDATE log_health_activity RPC
-- =============================================================================
-- Only change: INSERT now includes workout_activity_key column.
-- Everything else (validation, dedup, progress update) is identical.

CREATE OR REPLACE FUNCTION public.log_health_activity(
  p_activities jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_activity jsonb;
  v_inserted integer := 0;
  v_deduplicated integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_challenge_id uuid;
  v_recorded_at timestamptz;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF jsonb_typeof(p_activities) != 'array' THEN
    RAISE EXCEPTION 'invalid_input: p_activities must be an array';
  END IF;

  FOR v_activity IN SELECT * FROM jsonb_array_elements(p_activities)
  LOOP
    BEGIN
      IF v_activity->>'activity_type' IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'missing_activity_type'
        );
        CONTINUE;
      END IF;

      IF v_activity->>'value' IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'missing_value'
        );
        CONTINUE;
      END IF;

      IF v_activity->>'source_external_id' IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'index', v_activity,
          'error', 'missing_source_external_id'
        );
        CONTINUE;
      END IF;

      v_recorded_at := (v_activity->>'recorded_at')::timestamptz;
      
      IF v_recorded_at IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'missing_recorded_at'
        );
        CONTINUE;
      END IF;
      
      IF v_recorded_at < (v_now - INTERVAL '90 days') THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'timestamp_too_old',
          'recorded_at', v_recorded_at::text
        );
        CONTINUE;
      END IF;
      
      IF v_recorded_at > (v_now + INTERVAL '1 hour') THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'timestamp_in_future',
          'recorded_at', v_recorded_at::text
        );
        CONTINUE;
      END IF;

      IF (v_activity->>'value')::integer <= 0 THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'invalid_value',
          'value', v_activity->>'value'
        );
        CONTINUE;
      END IF;

      INSERT INTO public.activity_logs (
        user_id,
        challenge_id,
        activity_type,
        value,
        unit,
        source,
        source_external_id,
        recorded_at,
        created_at,
        workout_activity_key
      ) VALUES (
        v_user_id,
        (v_activity->>'challenge_id')::uuid,
        (v_activity->>'activity_type')::challenge_type,
        (v_activity->>'value')::integer,
        COALESCE(v_activity->>'unit', v_activity->>'activity_type'),
        COALESCE(v_activity->>'source', 'healthkit'),
        v_activity->>'source_external_id',
        v_recorded_at,
        v_now,
        v_activity->>'workout_activity_key'
      );
      
      v_inserted := v_inserted + 1;
      
      v_challenge_id := (v_activity->>'challenge_id')::uuid;
      IF v_challenge_id IS NOT NULL THEN
        UPDATE public.challenge_participants
        SET current_progress = current_progress + (v_activity->>'value')::integer,
            updated_at = v_now
        WHERE challenge_id = v_challenge_id
          AND user_id = v_user_id
          AND invite_status = 'accepted';
      END IF;

    EXCEPTION
      WHEN unique_violation THEN
        v_deduplicated := v_deduplicated + 1;
      WHEN invalid_text_representation THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'invalid_data_format',
          'details', SQLERRM
        );
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'deduplicated', v_deduplicated,
    'total_processed', v_inserted + v_deduplicated + jsonb_array_length(v_errors),
    'errors', v_errors
  );
END;
$$;

-- =============================================================================
-- PART 3: UPDATE get_challenges_for_health_sync RPC
-- =============================================================================
-- Changes:
--   1. Returns workout_activity_filter for smart challenge matching
--   2. Fixes column alias: id → challenge_id (broken in migration 031)
--      TypeScript ChallengeForSync expects challenge_id, not id

DROP FUNCTION IF EXISTS public.get_challenges_for_health_sync();

CREATE OR REPLACE FUNCTION public.get_challenges_for_health_sync()
RETURNS TABLE (
  challenge_id uuid,
  challenge_type challenge_type,
  start_date timestamptz,
  end_date timestamptz,
  workout_activity_filter text[]
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT 
    c.id AS challenge_id,
    c.challenge_type,
    c.start_date,
    c.end_date,
    c.workout_activity_filter
  FROM public.challenges c
  INNER JOIN public.challenge_participants cp 
    ON c.id = cp.challenge_id
  WHERE cp.user_id = auth.uid()
    AND cp.invite_status = 'accepted'
    -- TIME-DERIVED: Challenge is currently active
    AND c.start_date <= now()
    AND c.end_date > now()
    -- Exclude explicit cancellation/archival
    AND c.status NOT IN ('cancelled', 'archived')
  ORDER BY c.end_date ASC;
$$;

COMMENT ON FUNCTION public.get_challenges_for_health_sync() IS
'Returns active challenges for health sync with workout activity filter.
Uses TIME-DERIVED filtering (start_date <= now() AND end_date > now()).
Returns challenge_id alias to match TypeScript ChallengeForSync interface.';