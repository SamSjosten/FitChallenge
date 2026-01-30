-- Migration: 010_activity_summary_rpc.sql
-- Description: Add server-side aggregation function for activity summaries
-- Rationale: Avoids fetching all logs to client for aggregation (O(n) -> O(1) data transfer)

-- =============================================================================
-- ACTIVITY SUMMARY FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_activity_summary(
  p_challenge_id uuid
)
RETURNS TABLE (
  total_value bigint,
  count bigint,
  last_recorded_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    COALESCE(SUM(value), 0)::bigint AS total_value,
    COUNT(*)::bigint AS count,
    MAX(recorded_at) AS last_recorded_at
  FROM public.activity_logs
  WHERE challenge_id = p_challenge_id
    AND user_id = auth.uid();
$$;

-- Set safe search path
ALTER FUNCTION public.get_activity_summary(uuid) SET search_path = public;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_activity_summary IS 
  'Returns aggregated activity stats for a challenge. RLS-safe: only returns current user''s data.';