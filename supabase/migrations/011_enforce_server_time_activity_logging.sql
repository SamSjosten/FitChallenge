-- migrations/011_enforce_server_time_activity_logging.sql
-- =============================================================================
-- PATCH 2: ENFORCE SERVER TIME IN ACTIVITY LOGGING
-- =============================================================================
-- Problem:
--   Client-provided timestamps can corrupt progress/streak logic and reduce trust.
--
-- Goal:
--   For source='manual', recorded_at MUST be server time (now()).
--   For trusted sources (healthkit/googlefit), recorded_at may be provided.
--
-- Implementation:
--   - Drop the old log_activity signature (required p_recorded_at)
--   - Recreate with p_recorded_at DEFAULT NULL
--   - Internally select effective_recorded_at:
--       manual   -> now()
--       others   -> coalesce(p_recorded_at, now())
--   - Validate bounds using effective_recorded_at
-- =============================================================================

-- Drop the previous signature so CREATE OR REPLACE doesn't create an overload.
-- NOTE: If you have ever changed the function signature, you may need to drop
-- additional overloads here. Add extra DROP FUNCTION IF EXISTS lines as needed.
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, timestamptz, text, uuid, text);
-- Common historical variants (safe no-ops if they don't exist):
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, timestamptz, text, uuid);
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, timestamptz, text);
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, timestamptz);
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer);
-- Variants matching the reordered signature (p_source before defaulted args)
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, text, uuid, text, timestamptz);
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, text, uuid, text);
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, text, uuid);
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, integer, text);

CREATE OR REPLACE FUNCTION public.log_activity(
  p_challenge_id uuid,
  p_activity_type text,
  p_value integer,
  p_source text,                           -- Required param - no default
  p_client_event_id uuid DEFAULT NULL,     -- Optional
  p_source_external_id text DEFAULT NULL,  -- Optional
  p_recorded_at timestamptz DEFAULT NULL   -- Optional (ignored for manual source)
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  effective_recorded_at timestamptz;
BEGIN
  -- 0) Determine effective recorded_at
  -- Manual logs are NOT trusted: always use server time.
  -- Trusted sources may provide a timestamp; if omitted, fall back to server time.
  IF p_source = 'manual' THEN
    effective_recorded_at := now();
  ELSE
    effective_recorded_at := COALESCE(p_recorded_at, now());
  END IF;

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
      AND effective_recorded_at >= c.start_date
      AND effective_recorded_at < c.end_date
      AND effective_recorded_at <= now() + interval '5 minutes'  -- Small grace for clock drift
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
      effective_recorded_at,
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