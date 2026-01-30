-- migrations/009_effective_status.sql
-- =============================================================================
-- EFFECTIVE STATUS FUNCTION
-- =============================================================================
-- Single source of truth for challenge status derived from time bounds.
-- Overrides (cancelled, archived) take precedence over time-based status.
--
-- BOUNDARY CONVENTION: Half-open interval [start, end)
--   Active range: start_date <= now() < end_date
--   This matches activity log queries: recorded_at >= start AND recorded_at < end
-- =============================================================================

CREATE OR REPLACE FUNCTION public.challenge_effective_status(p_challenge_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.status IN ('cancelled', 'archived') THEN c.status::text
    WHEN now() < c.start_date THEN 'upcoming'
    WHEN now() >= c.end_date THEN 'completed'
    ELSE 'active'
  END
  FROM public.challenges c
  WHERE c.id = p_challenge_id;
$$;

-- =============================================================================
-- UPDATED LOG_ACTIVITY FUNCTION
-- =============================================================================
-- Uses effective status (time-based) instead of status column.
-- Activity logging is only allowed when challenge is 'active'.
-- True idempotency: duplicate inserts succeed silently without double-counting.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_activity(
  p_challenge_id uuid,
  p_activity_type text,
  p_value integer,
  p_recorded_at timestamptz,
  p_source text,
  p_client_event_id uuid default null,
  p_source_external_id text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- 1) Validate participation (must be accepted) FIRST
  IF NOT EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  -- 2) Enforce active window (COALESCE avoids NULL fail-open)
  IF COALESCE(public.challenge_effective_status(p_challenge_id), 'forbidden') != 'active' THEN
    RAISE EXCEPTION 'challenge_not_active';
  END IF;

  -- 3) Validate recorded_at is within challenge bounds [start, end) and not future
  IF NOT EXISTS (
    SELECT 1
    FROM public.challenges c
    WHERE c.id = p_challenge_id
      AND p_recorded_at >= c.start_date
      AND p_recorded_at < c.end_date
      AND p_recorded_at <= now() + interval '5 minutes'  -- Small grace for clock drift
  ) THEN
    RAISE EXCEPTION 'recorded_at_out_of_bounds';
  END IF;

  -- 4) Require dedupe key based on source (prevents broken retries)
  IF p_source = 'manual' AND p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client_event_id_required_for_manual';
  END IF;
  IF p_source IN ('healthkit', 'googlefit') AND p_source_external_id IS NULL THEN
    RAISE EXCEPTION 'source_external_id_required_for_health_sync';
  END IF;

  -- 5) Insert log idempotently:
  -- If duplicate detected by unique index, succeed silently without incrementing.
  BEGIN
    INSERT INTO public.activity_logs (
      challenge_id, user_id, activity_type, value, unit, recorded_at,
      source, client_event_id, source_external_id
    )
    VALUES (
      p_challenge_id,
      auth.uid(),
      p_activity_type::public.challenge_type,
      p_value,
      p_activity_type,
      p_recorded_at,
      p_source,
      p_client_event_id,
      p_source_external_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Only treat as idempotent success if a dedupe key was provided
      IF p_client_event_id IS NOT NULL OR p_source_external_id IS NOT NULL THEN
        RETURN;
      END IF;
      -- No dedupe key but got unique_violation = unexpected, re-raise
      RAISE;
  END;

  -- 6) Update aggregated counter only if insert succeeded
  UPDATE public.challenge_participants
  SET current_progress = current_progress + p_value,
      updated_at = now()
  WHERE challenge_id = p_challenge_id
    AND user_id = auth.uid()
    AND invite_status = 'accepted';
END;
$$;