-- supabase/migrations/20240101000046_health_activity_active_window.sql
-- =============================================================================
-- Health Activity Active-Window Enforcement
-- =============================================================================
-- Patches log_health_activity so challenge_participants.current_progress is
-- only incremented when:
--   1. The challenge is currently active (via challenge_effective_status)
--   2. recorded_at falls within the challenge's [start_date, end_date) window
--
-- This matches the enforcement already present in log_activity (migration 009)
-- and log_workout (migration 039). Without this gate, a delayed HealthKit
-- backfill could inflate progress on completed or upcoming challenges.
--
-- The INSERT into activity_logs is unchanged — health data is always recorded
-- regardless of challenge status. Only the progress increment is conditional.
-- =============================================================================

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

      -- Always insert health data into activity_logs regardless of challenge status
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

      -- Only increment progress when challenge is active AND recorded_at is
      -- within the challenge window [start_date, end_date).
      -- Matches log_activity (migration 009:64-79) enforcement.
      v_challenge_id := (v_activity->>'challenge_id')::uuid;
      IF v_challenge_id IS NOT NULL THEN
        UPDATE public.challenge_participants
        SET current_progress = current_progress + (v_activity->>'value')::integer,
            updated_at = v_now
        WHERE challenge_id = v_challenge_id
          AND user_id = v_user_id
          AND invite_status = 'accepted'
          AND EXISTS (
            SELECT 1
            FROM public.challenges c
            WHERE c.id = v_challenge_id
              AND public.challenge_effective_status(c.id) = 'active'
              AND v_recorded_at >= c.start_date
              AND v_recorded_at < c.end_date
          );
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
