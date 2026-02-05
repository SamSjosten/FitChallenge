-- =============================================================================
-- MIGRATION 033: Add today_change to get_leaderboard RPC
-- =============================================================================
-- Problem: Leaderboard shows only cumulative progress. The mockup design calls
-- for a "today's change" column per participant (e.g., "+4.2K") so users can
-- see daily momentum at a glance.
--
-- Solution: LEFT JOIN activity_logs filtered to today (UTC) and aggregate
-- per-user. LEFT JOIN ensures participants with no activity today still appear
-- with today_change = 0.
--
-- Performance: Uses existing idx_activity_challenge index. Challenge max is 50
-- participants, so the aggregation is bounded.
--
-- Security: No change — still INVOKER with explicit accepted-participant gate.
-- activity_logs join is internal to the function; no new RLS exposure.
-- =============================================================================

-- Drop old signature first: return type is changing (adding today_change column)
-- and PostgreSQL cannot alter OUT parameters via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.get_leaderboard(uuid);

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_challenge_id uuid)
RETURNS TABLE (
  user_id uuid,
  current_progress integer,
  current_streak integer,
  rank integer,
  today_change integer,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  -- Explicit gate: caller must be accepted participant
  -- Defense-in-depth alongside RLS policies
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cp.user_id,
    COALESCE(cp.current_progress, 0)::integer AS current_progress,
    COALESCE(cp.current_streak, 0)::integer AS current_streak,
    RANK() OVER (
      ORDER BY COALESCE(cp.current_progress, 0) DESC, cp.user_id ASC
    )::integer AS rank,
    COALESCE(today_al.today_sum, 0)::integer AS today_change,
    pp.username,
    pp.display_name,
    pp.avatar_url
  FROM public.challenge_participants cp
  INNER JOIN public.profiles_public pp ON pp.id = cp.user_id
  LEFT JOIN (
    SELECT
      al.user_id AS al_user_id,
      SUM(al.value)::integer AS today_sum
    FROM public.activity_logs al
    WHERE al.challenge_id = p_challenge_id
      AND al.recorded_at >= CURRENT_DATE
    GROUP BY al.user_id
  ) today_al ON today_al.al_user_id = cp.user_id
  WHERE cp.challenge_id = p_challenge_id
    AND cp.invite_status = 'accepted'
  ORDER BY rank ASC, cp.user_id ASC;
END;
$$;

ALTER FUNCTION public.get_leaderboard(uuid) SET search_path = public;

COMMENT ON FUNCTION public.get_leaderboard(uuid) IS
'Atomic leaderboard fetch with server-side ranking and daily activity delta.

Returns accepted participants with progress, streak, rank, today_change, and profile.
today_change is the sum of activity_logs.value for the current UTC day.

Security:
  - INVOKER: RLS policies apply
  - Explicit gate: returns empty if caller is not accepted participant

Order: rank ASC, user_id ASC (deterministic tie-breaker)';