-- supabase/migrations/024_log_health_activity_rpc.sql
-- =============================================================================
-- Health Activity Logging RPC
-- =============================================================================
-- Separate RPC for health provider data with different requirements than
-- manual activity logging:
-- 1. Accepts client-provided timestamps (with validation bounds)
-- 2. Uses source_external_id for deduplication (SHA-256 hash from client)
-- 3. Supports batch inserts for efficiency
-- 4. Does NOT require active challenge (stores for future matching)
-- =============================================================================

-- =============================================================================
-- LOG HEALTH ACTIVITY (Batch Insert)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_health_activity(
  p_activities jsonb  -- Array of activity objects
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

  -- Validate input is array
  IF jsonb_typeof(p_activities) != 'array' THEN
    RAISE EXCEPTION 'invalid_input: p_activities must be an array';
  END IF;

  -- Process each activity in the batch
  FOR v_activity IN SELECT * FROM jsonb_array_elements(p_activities)
  LOOP
    BEGIN
      -- Validate required fields
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

      -- Extract and validate recorded_at
      v_recorded_at := (v_activity->>'recorded_at')::timestamptz;
      
      IF v_recorded_at IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'missing_recorded_at'
        );
        CONTINUE;
      END IF;
      
      -- Validation: timestamp must be within reasonable bounds
      -- Not more than 90 days in the past
      IF v_recorded_at < (v_now - INTERVAL '90 days') THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'timestamp_too_old',
          'recorded_at', v_recorded_at::text
        );
        CONTINUE;
      END IF;
      
      -- Not more than 1 hour in the future (clock drift tolerance)
      IF v_recorded_at > (v_now + INTERVAL '1 hour') THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'timestamp_in_future',
          'recorded_at', v_recorded_at::text
        );
        CONTINUE;
      END IF;

      -- Validate value is positive
      IF (v_activity->>'value')::integer <= 0 THEN
        v_errors := v_errors || jsonb_build_object(
          'source_external_id', v_activity->>'source_external_id',
          'error', 'invalid_value',
          'value', v_activity->>'value'
        );
        CONTINUE;
      END IF;

      -- Attempt insert (unique constraint handles deduplication)
      INSERT INTO public.activity_logs (
        user_id,
        challenge_id,
        activity_type,
        value,
        unit,
        source,
        source_external_id,
        recorded_at,
        created_at
      ) VALUES (
        v_user_id,
        (v_activity->>'challenge_id')::uuid,  -- Can be NULL
        (v_activity->>'activity_type')::challenge_type,
        (v_activity->>'value')::integer,
        COALESCE(v_activity->>'unit', v_activity->>'activity_type'),
        COALESCE(v_activity->>'source', 'healthkit'),
        v_activity->>'source_external_id',  -- SHA-256 hash from client
        v_recorded_at,
        v_now
      );
      
      v_inserted := v_inserted + 1;
      
      -- If challenge_id provided and valid, update participant progress
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
        -- Duplicate entry based on source_external_id, skip (idempotent)
        v_deduplicated := v_deduplicated + 1;
      WHEN invalid_text_representation THEN
        -- Invalid enum value or UUID
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
-- GET ACTIVE CHALLENGES FOR HEALTH SYNC
-- =============================================================================
-- Returns challenges where user is accepted participant and challenge is active.
-- Used by health sync to determine which challenges to attribute activities to.
-- Includes challenge type for filtering (only sync relevant activity types).

CREATE OR REPLACE FUNCTION public.get_challenges_for_health_sync()
RETURNS TABLE (
  challenge_id uuid,
  challenge_type challenge_type,
  start_date timestamptz,
  end_date timestamptz,
  goal_value integer,
  current_progress integer
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
    c.goal_value,
    cp.current_progress
  FROM public.challenges c
  INNER JOIN public.challenge_participants cp 
    ON c.id = cp.challenge_id
  WHERE cp.user_id = auth.uid()
    AND cp.invite_status = 'accepted'
    AND c.status = 'active'
  ORDER BY c.end_date ASC;
$$;

-- =============================================================================
-- GET RECENT HEALTH ACTIVITIES
-- =============================================================================
-- Returns recent health-synced activities for display in UI.
-- Filtered to health sources only (excludes manual entries).

CREATE OR REPLACE FUNCTION public.get_recent_health_activities(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  activity_type challenge_type,
  value integer,
  unit text,
  source text,
  recorded_at timestamptz,
  challenge_id uuid,
  challenge_title text
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT 
    al.id,
    al.activity_type,
    al.value,
    al.unit,
    al.source,
    al.recorded_at,
    al.challenge_id,
    c.title AS challenge_title
  FROM public.activity_logs al
  LEFT JOIN public.challenges c ON al.challenge_id = c.id
  WHERE al.user_id = auth.uid()
    AND al.source IN ('healthkit', 'googlefit')
  ORDER BY al.recorded_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- =============================================================================
-- START HEALTH SYNC LOG
-- =============================================================================
-- Creates a sync log entry when starting a health sync operation.
-- Returns the log ID for subsequent updates.

CREATE OR REPLACE FUNCTION public.start_health_sync(
  p_provider text,
  p_sync_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.health_sync_logs (
    user_id,
    provider,
    sync_type,
    status
  ) VALUES (
    auth.uid(),
    p_provider,
    p_sync_type,
    'in_progress'
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- =============================================================================
-- COMPLETE HEALTH SYNC LOG
-- =============================================================================
-- Updates a sync log entry when sync completes (success or failure).

CREATE OR REPLACE FUNCTION public.complete_health_sync(
  p_log_id uuid,
  p_status text,
  p_records_processed integer DEFAULT 0,
  p_records_inserted integer DEFAULT 0,
  p_records_deduplicated integer DEFAULT 0,
  p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.health_sync_logs
  SET completed_at = now(),
      status = p_status,
      records_processed = p_records_processed,
      records_inserted = p_records_inserted,
      records_deduplicated = p_records_deduplicated,
      error_message = p_error_message,
      metadata = p_metadata
  WHERE id = p_log_id
    AND user_id = auth.uid();
    
  -- Also update last_sync_at on health_connections if successful
  IF p_status = 'completed' THEN
    UPDATE public.health_connections
    SET last_sync_at = now(),
        updated_at = now()
    WHERE user_id = auth.uid()
      AND provider = (
        SELECT provider FROM public.health_sync_logs WHERE id = p_log_id
      )
      AND is_active = true;
  END IF;
END;
$$;