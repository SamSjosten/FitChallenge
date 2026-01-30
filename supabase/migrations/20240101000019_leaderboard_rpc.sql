-- =============================================================================
-- MIGRATION 019: Consolidated Leaderboard RPC
-- =============================================================================
-- Problem: getLeaderboard() does 2 sequential queries (participants → profiles)
-- with client-side ranking. This creates race windows and inconsistent data.
--
-- Solution: Single RPC that joins participants + profiles_public and computes
-- ranks server-side, executing in one database snapshot.
--
-- Security: INVOKER (RLS applies) + explicit accepted participant check
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_challenge_id uuid)
RETURNS TABLE (
  user_id uuid,
  current_progress integer,
  current_streak integer,
  rank integer,
  -- Flattened profile fields (from profiles_public)
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
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND user_id = auth.uid()
      AND invite_status = 'accepted'
  ) THEN
    -- Return empty set (not an error - matches RLS behavior)
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
    pp.username,
    pp.display_name,
    pp.avatar_url
  FROM public.challenge_participants cp
  INNER JOIN public.profiles_public pp ON pp.id = cp.user_id
  WHERE cp.challenge_id = p_challenge_id
    AND cp.invite_status = 'accepted'
  ORDER BY rank ASC, cp.user_id ASC;
END;
$$;

-- Set search path for security
ALTER FUNCTION public.get_leaderboard(uuid) SET search_path = public;

-- Documentation
COMMENT ON FUNCTION public.get_leaderboard(uuid) IS
'Atomic leaderboard fetch with server-side ranking.

Returns accepted participants with progress, streak, rank, and profile info.
Uses standard competition ranking (ties share rank, gaps after).

Security:
  - INVOKER: RLS policies apply
  - Explicit gate: returns empty if caller is not accepted participant

Order: rank ASC, user_id ASC (deterministic tie-breaker)';