-- =============================================================================
-- MIGRATION 021: Fix ambiguous column reference in get_leaderboard RPC
-- =============================================================================
-- Problem: The `user_id` in the IF NOT EXISTS check conflicts with the
-- `user_id` declared in RETURNS TABLE, causing PostgreSQL error 42702:
-- "column reference 'user_id' is ambiguous"
--
-- Solution: Qualify the column reference with table alias `cp`
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
  -- NOTE: Use table alias to avoid ambiguity with RETURNS TABLE column
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
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