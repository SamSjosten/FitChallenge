-- Migration: 017_server_time_challenge_filters.sql
-- Server-authoritative time filtering for challenge lists
--
-- Problem: Client-side time filtering with getServerNow() can drift from actual
-- server time, causing challenges to appear in wrong lists near boundaries.
--
-- Solution: RPCs that use PostgreSQL now() for authoritative time filtering.
-- Client fetches IDs from RPC, then fetches full challenge data by ID.

-- =============================================================================
-- get_active_challenge_ids()
-- =============================================================================
-- Returns IDs of challenges where:
--   - User is accepted participant
--   - Challenge is in active window: start_date <= now() < end_date (half-open)
--   - Not cancelled/archived
--
-- Ordered by start_date ASC (matches existing getMyActiveChallenges behavior)

CREATE OR REPLACE FUNCTION public.get_active_challenge_ids()
RETURNS TABLE(challenge_id uuid)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT c.id
  FROM public.challenges c
  INNER JOIN public.challenge_participants cp ON cp.challenge_id = c.id
  WHERE cp.user_id = auth.uid()
    AND cp.invite_status = 'accepted'
    AND c.start_date <= now()
    AND c.end_date > now()
    AND c.status NOT IN ('cancelled', 'archived')
  ORDER BY c.start_date ASC;
$$;

ALTER FUNCTION public.get_active_challenge_ids()
SET search_path = public;

COMMENT ON FUNCTION public.get_active_challenge_ids() IS 
'Returns active challenge IDs for current user using server now() for authoritative time filtering.';

-- =============================================================================
-- get_completed_challenge_ids()
-- =============================================================================
-- Returns IDs of challenges where:
--   - User is accepted participant
--   - Challenge has ended: end_date <= now()
--   - Not cancelled/archived
--   - Limited to 20 most recent (matches existing getCompletedChallenges behavior)
--
-- Ordered by end_date DESC (most recently completed first)

CREATE OR REPLACE FUNCTION public.get_completed_challenge_ids()
RETURNS TABLE(challenge_id uuid)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT c.id
  FROM public.challenges c
  INNER JOIN public.challenge_participants cp ON cp.challenge_id = c.id
  WHERE cp.user_id = auth.uid()
    AND cp.invite_status = 'accepted'
    AND c.end_date <= now()
    AND c.status NOT IN ('cancelled', 'archived')
  ORDER BY c.end_date DESC
  LIMIT 20;
$$;

ALTER FUNCTION public.get_completed_challenge_ids()
SET search_path = public;

COMMENT ON FUNCTION public.get_completed_challenge_ids() IS 
'Returns completed challenge IDs for current user using server now() for authoritative time filtering. Limited to 20 most recent.';