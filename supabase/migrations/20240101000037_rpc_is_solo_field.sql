-- Migration 037: Add is_solo to get_my_challenges RPC
--
-- WHY: Migration 035 added is_solo to the challenges table, but the
-- get_my_challenges RPC was never updated to return it. Client code
-- (rematch, detail screen) needs this field to correctly preserve
-- solo status and display solo challenge badges.
--
-- ROOT CAUSE: Same class of bug as migration 036 — adding a column
-- to challenges without updating the RPC that serves it.
--
-- CHANGES:
--   - Recreate get_my_challenges() with is_solo in RETURNS TABLE
--   - Add COALESCE(c.is_solo, false) to the CTE (safe default for pre-035 rows)
--   - Add mc.is_solo to the final SELECT
--
-- BACKWARD COMPATIBLE: New column defaults to false; no client breakage.

-- Drop and recreate with new return column
DROP FUNCTION IF EXISTS public.get_my_challenges(text);

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
  starting_soon_notified_at timestamptz,
  ending_soon_notified_at timestamptz,
  status challenge_status,
  xp_reward integer,
  max_participants integer,
  is_public boolean,
  custom_activity_name text,
  created_at timestamptz,
  updated_at timestamptz,
  -- Workout configuration (added in migration 036)
  allowed_workout_types text[],
  -- Solo flag (added in migration 035, surfaced here)
  is_solo boolean,
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
      c.starting_soon_notified_at,
      c.ending_soon_notified_at,
      c.status,
      c.xp_reward,
      c.max_participants,
      c.is_public,
      c.custom_activity_name,
      c.created_at,
      c.updated_at,
      c.allowed_workout_types,
      COALESCE(c.is_solo, false) AS is_solo,
      cp.invite_status AS my_invite_status,
      COALESCE(cp.current_progress, 0) AS my_current_progress
    FROM public.challenges c
    INNER JOIN public.challenge_participants cp 
      ON cp.challenge_id = c.id 
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
    WHERE 
      -- Exclude explicit cancellation/archival
      c.status NOT IN ('cancelled', 'archived')
      -- TIME-DERIVED FILTERING (not dependent on status column)
      AND CASE 
        -- Active = challenge hasn't ended yet (includes upcoming and in-progress)
        WHEN p_filter = 'active' THEN c.end_date > now()
        -- Completed = challenge has ended
        WHEN p_filter = 'completed' THEN c.end_date <= now()
        ELSE FALSE
      END
  ),
  participant_counts AS (
    SELECT 
      cp.challenge_id,
      COUNT(*)::integer AS cnt
    FROM public.challenge_participants cp
    INNER JOIN my_challenges mc ON mc.id = cp.challenge_id
    WHERE cp.invite_status = 'accepted'
    GROUP BY cp.challenge_id
  ),
  rankings AS (
    SELECT 
      cp.challenge_id,
      cp.user_id,
      RANK() OVER (
        PARTITION BY cp.challenge_id 
        ORDER BY cp.current_progress DESC
      )::integer AS rank
    FROM public.challenge_participants cp
    INNER JOIN my_challenges mc ON mc.id = cp.challenge_id
    WHERE cp.invite_status = 'accepted'
  )
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
    mc.starting_soon_notified_at,
    mc.ending_soon_notified_at,
    mc.status,
    mc.xp_reward,
    mc.max_participants,
    mc.is_public,
    mc.custom_activity_name,
    mc.created_at,
    mc.updated_at,
    mc.allowed_workout_types,
    mc.is_solo,
    mc.my_invite_status,
    mc.my_current_progress,
    COALESCE(pc.cnt, 0) AS participant_count,
    COALESCE(r.rank, 0) AS my_rank
  FROM my_challenges mc
  LEFT JOIN participant_counts pc ON pc.challenge_id = mc.id
  LEFT JOIN rankings r ON r.challenge_id = mc.id AND r.user_id = auth.uid()
  ORDER BY 
    -- For active: sort by end_date ascending (soonest ending first)
    -- For completed: sort by end_date descending (most recent first)
    CASE WHEN p_filter = 'active' THEN mc.end_date END ASC,
    CASE WHEN p_filter = 'completed' THEN mc.end_date END DESC;
END;
$$;

ALTER FUNCTION public.get_my_challenges(text) SET search_path = public;

COMMENT ON FUNCTION public.get_my_challenges(text) IS
  'Returns challenges for current user with participation data, rankings, workout config, and solo flag. Filter: active|completed.';

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- After applying, verify with:
--   SELECT is_solo FROM get_my_challenges('active') LIMIT 1;
-- Should return false (default) for pre-existing challenges.