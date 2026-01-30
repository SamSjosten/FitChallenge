-- =============================================================================
-- MIGRATION 018: Consolidated Challenge Data RPC
-- =============================================================================
-- Problem: Multi-step fetches (IDs → challenges → participants) create race
-- windows where data can drift between queries, causing "ghost data" and
-- inconsistent counts/ranks.
--
-- Solution: Single RPC that executes in one database snapshot, returning
-- challenge data with participation info, counts, and ranks atomically.
--
-- Replaces the 3-step flow:
--   1. get_active_challenge_ids() / get_completed_challenge_ids()
--   2. SELECT challenges WHERE id IN (...)
--   3. SELECT participants for counts/ranks
-- =============================================================================

-- =============================================================================
-- get_my_challenges RPC
-- =============================================================================
-- Returns challenges with participation data, counts, and ranks in one query.
--
-- Parameters:
--   p_filter: 'active' | 'completed'
--     - 'active': start_date <= now() < end_date (half-open interval)
--     - 'completed': end_date <= now() (limited to 20 most recent)
--
-- Security: INVOKER - RLS policies on challenges/challenge_participants apply
-- Ranking: Standard competition ranking (RANK) - ties get same rank, gaps after
-- Filters: Excludes cancelled/archived challenges (matches existing behavior)
--
-- Returns: One row per challenge where current user is accepted participant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_challenges(p_filter text)
RETURNS TABLE (
  -- Challenge fields
  id uuid,
  creator_id uuid,
  title text,
  description text,
  challenge_type challenge_type,
  goal_value integer,
  goal_unit text,
  win_condition win_condition,
  daily_target integer,
  start_date timestamptz,
  end_date timestamptz,
  status challenge_status,
  xp_reward integer,
  max_participants integer,
  is_public boolean,
  custom_activity_name text,
  created_at timestamptz,
  updated_at timestamptz,
  -- Participation fields
  my_invite_status text,
  my_current_progress integer,
  -- Aggregations
  participant_count integer,
  my_rank integer
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  -- Validate filter parameter
  IF p_filter NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'Invalid filter: %. Must be ''active'' or ''completed''', p_filter;
  END IF;

  RETURN QUERY
  WITH my_challenges AS (
    -- Get challenges where current user is accepted participant
    -- Filter by time window and exclude cancelled/archived
    SELECT 
      c.id,
      c.creator_id,
      c.title,
      c.description,
      c.challenge_type,
      c.goal_value,
      c.goal_unit,
      c.win_condition,
      c.daily_target,
      c.start_date,
      c.end_date,
      c.status,
      c.xp_reward,
      c.max_participants,
      c.is_public,
      c.custom_activity_name,
      c.created_at,
      c.updated_at,
      cp.invite_status AS my_invite_status,
      COALESCE(cp.current_progress, 0) AS my_current_progress
    FROM public.challenges c
    INNER JOIN public.challenge_participants cp 
      ON cp.challenge_id = c.id 
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
    WHERE 
      c.status NOT IN ('cancelled', 'archived')
      AND CASE p_filter
        WHEN 'active' THEN c.start_date <= now() AND c.end_date > now()
        WHEN 'completed' THEN c.end_date <= now()
      END
  ),
  participant_counts AS (
    -- Count accepted participants per challenge
    SELECT 
      cp.challenge_id,
      COUNT(*)::integer AS cnt
    FROM public.challenge_participants cp
    WHERE cp.invite_status = 'accepted'
      AND cp.challenge_id IN (SELECT mc.id FROM my_challenges mc)
    GROUP BY cp.challenge_id
  ),
  ranked_participants AS (
    -- Rank all accepted participants by progress (standard competition ranking)
    -- Tie-breaker: user_id ASC for deterministic ordering
    SELECT 
      cp.challenge_id,
      cp.user_id,
      RANK() OVER (
        PARTITION BY cp.challenge_id 
        ORDER BY COALESCE(cp.current_progress, 0) DESC, cp.user_id ASC
      )::integer AS rnk
    FROM public.challenge_participants cp
    WHERE cp.invite_status = 'accepted'
      AND cp.challenge_id IN (SELECT mc.id FROM my_challenges mc)
  ),
  ordered_challenges AS (
    SELECT 
      mc.id,
      mc.creator_id,
      mc.title,
      mc.description,
      mc.challenge_type,
      mc.goal_value,
      mc.goal_unit,
      mc.win_condition,
      mc.daily_target,
      mc.start_date,
      mc.end_date,
      mc.status,
      mc.xp_reward,
      mc.max_participants,
      mc.is_public,
      mc.custom_activity_name,
      mc.created_at,
      mc.updated_at,
      mc.my_invite_status,
      mc.my_current_progress,
      COALESCE(pc.cnt, 1) AS participant_count,
      COALESCE(rp.rnk, 1) AS my_rank
    FROM my_challenges mc
    LEFT JOIN participant_counts pc ON pc.challenge_id = mc.id
    LEFT JOIN ranked_participants rp ON rp.challenge_id = mc.id AND rp.user_id = auth.uid()
    ORDER BY 
      -- Active: earliest started first (ASC)
      -- Completed: most recently ended first (DESC, achieved via negative epoch)
      CASE p_filter
        WHEN 'active' THEN EXTRACT(EPOCH FROM mc.start_date)
        WHEN 'completed' THEN -EXTRACT(EPOCH FROM mc.end_date)
      END ASC NULLS LAST
  )
  SELECT * FROM ordered_challenges
  -- Completed challenges: limit to 20 most recent (matches existing behavior)
  -- Active challenges: no limit
  LIMIT CASE WHEN p_filter = 'completed' THEN 20 ELSE NULL END;
END;
$$;

-- Set search path for security
ALTER FUNCTION public.get_my_challenges(text) SET search_path = public;

-- Documentation
COMMENT ON FUNCTION public.get_my_challenges(text) IS 
'Atomic fetch of user challenges with participation data, counts, and ranks.

Parameters:
  p_filter: ''active'' (in progress) or ''completed'' (ended, max 20)

Features:
  - Single database snapshot (no race conditions)
  - Excludes cancelled/archived challenges
  - Standard competition ranking (ties share rank, gaps after)
  - Server-authoritative time filtering via now()

Order: Active by start_date ASC, Completed by end_date DESC.
Security: INVOKER - respects RLS policies.';