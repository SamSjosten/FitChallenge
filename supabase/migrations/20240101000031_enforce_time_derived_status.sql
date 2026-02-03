-- =============================================================================
-- MIGRATION 031: ENFORCE TIME-DERIVED STATUS PATTERN
-- =============================================================================
--
-- ARCHITECTURAL CONTRACT:
-- =======================
-- The `status` column on `challenges` MUST ONLY store EXPLICIT USER ACTIONS:
--   - 'cancelled' : User explicitly cancelled the challenge
--   - 'archived'  : Creator's account was deleted
--
-- The following states are TIME-DERIVED and MUST NEVER be read from the column:
--   - 'pending'   : Compute as `start_date > now()`
--   - 'active'    : Compute as `start_date <= now() AND end_date > now()`
--   - 'completed' : Compute as `end_date <= now()`
--
-- WHY THIS MATTERS:
-- =================
-- The status column requires a cron job to stay in sync with reality.
-- If the cron job fails, is delayed, or doesn't run:
--   - Challenges that should be "active" stay "pending"
--   - Challenges that should be "completed" stay "active"
--   - Notifications never fire
--   - UI shows incorrect state
--
-- By computing state from time boundaries, we guarantee correctness regardless
-- of whether any background job runs.
--
-- FUNCTIONS THAT CORRECTLY USE TIME-DERIVED LOGIC:
--   - challenge_effective_status()
--   - log_activity() 
--   - get_my_challenges()
--   - send_challenge_starting_soon_notifications()
--   - send_challenge_ending_soon_notifications()
--   - send_challenge_completed_notifications() [NEW]
--   - get_challenges_for_health_sync() [FIXED]
--
-- FUNCTIONS THAT UPDATE STATUS COLUMN (as cache/audit only):
--   - update_challenge_statuses() - Called by cron, NOT for correctness
--
-- =============================================================================

-- =============================================================================
-- PART 1: ADD completed_notified_at COLUMN
-- =============================================================================
-- This column enables idempotent "challenge completed" notifications.
-- Same pattern as starting_soon_notified_at and ending_soon_notified_at.

ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS completed_notified_at timestamptz;

COMMENT ON COLUMN public.challenges.completed_notified_at IS 
'Timestamp when challenge_completed notifications were sent. NULL = not yet sent.
Used for idempotency - ensures notifications are sent exactly once.';

-- =============================================================================
-- PART 2: FIX get_challenges_for_health_sync()
-- =============================================================================
-- BEFORE: Used `c.status = 'active'` (WRONG - status column may be stale)
-- AFTER:  Uses time-derived logic (CORRECT - always accurate)
--
-- NOTE: Must DROP first because return type may differ from existing function.
-- PostgreSQL does not allow CREATE OR REPLACE to change return types.

DROP FUNCTION IF EXISTS public.get_challenges_for_health_sync();

CREATE OR REPLACE FUNCTION public.get_challenges_for_health_sync()
RETURNS TABLE (
  id uuid,
  challenge_type challenge_type,
  start_date timestamptz,
  end_date timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.challenge_type,
    c.start_date,
    c.end_date
  FROM public.challenges c
  INNER JOIN public.challenge_participants cp 
    ON c.id = cp.challenge_id
  WHERE cp.user_id = auth.uid()
    AND cp.invite_status = 'accepted'
    -- TIME-DERIVED: Challenge is currently active
    AND c.start_date <= now()
    AND c.end_date > now()
    -- Exclude explicit cancellation/archival
    AND c.status NOT IN ('cancelled', 'archived')
  ORDER BY c.end_date ASC;
$$;

COMMENT ON FUNCTION public.get_challenges_for_health_sync() IS
'Returns active challenges for health sync. Uses TIME-DERIVED filtering
(start_date <= now() AND end_date > now()) instead of status column.
This ensures correctness even if status column is stale.';

-- =============================================================================
-- PART 3: CREATE send_challenge_completed_notifications()
-- =============================================================================
-- TIME-BASED notification function (replaces trigger-based approach).
-- Finds challenges where end_date <= now() AND completed_notified_at IS NULL.
--
-- NOTE: DROP first to ensure clean creation (function may not exist yet).

DROP FUNCTION IF EXISTS public.send_challenge_completed_notifications();

CREATE OR REPLACE FUNCTION public.send_challenge_completed_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
BEGIN
  -- Find challenges that:
  -- 1. Have ended (TIME-DERIVED: end_date <= now())
  -- 2. Haven't had completed notification sent yet
  -- 3. Not cancelled/archived
  FOR v_challenge IN
    SELECT c.id, c.title
    FROM public.challenges c
    WHERE c.status NOT IN ('cancelled', 'archived')
      AND c.end_date <= now()  -- TIME-DERIVED: has ended
      AND c.completed_notified_at IS NULL
  LOOP
    -- Notify all accepted participants
    FOR v_participant IN
      SELECT cp.user_id
      FROM public.challenge_participants cp
      WHERE cp.challenge_id = v_challenge.id
        AND cp.invite_status = 'accepted'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_participant.user_id,
        'challenge_completed',
        'Challenge completed!',
        '"' || v_challenge.title || '" has ended. Check out the final results!',
        jsonb_build_object('challenge_id', v_challenge.id)
      );
    END LOOP;

    -- Mark as notified to prevent duplicates
    UPDATE public.challenges
    SET completed_notified_at = now()
    WHERE id = v_challenge.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_challenge_completed_notifications() IS
'Scheduled function: Sends notifications for challenges that have completed.
Uses TIME-DERIVED filtering (end_date <= now()) instead of status column.
Idempotent via completed_notified_at column. Called by pg_cron.';

-- =============================================================================
-- PART 4: DROP TRIGGER-BASED notify_challenge_completed
-- =============================================================================
-- The trigger-based approach only fires when status column changes.
-- Since we don't read from status column for time-derived states,
-- we use the scheduled function instead.

DROP TRIGGER IF EXISTS trg_notify_challenge_completed ON public.challenges;

-- Keep the function for now (may be referenced elsewhere), but document deprecation
COMMENT ON FUNCTION public.notify_challenge_completed() IS
'DEPRECATED: This trigger-based function is no longer used.
Use send_challenge_completed_notifications() instead (scheduled, time-derived).
Kept for backwards compatibility - will be removed in future migration.';

-- =============================================================================
-- PART 5: UPDATE process_scheduled_notifications()
-- =============================================================================
-- Now calls all 4 functions:
-- 1. update_challenge_statuses() - Cache sync (not for correctness)
-- 2. send_challenge_starting_soon_notifications()
-- 3. send_challenge_ending_soon_notifications()
-- 4. send_challenge_completed_notifications() - NEW
--
-- NOTE: DROP first to ensure clean creation.

DROP FUNCTION IF EXISTS public.process_scheduled_notifications();

CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update status column as CACHE (for admin dashboards, legacy compatibility)
  -- This is NOT required for correctness - all queries use time-derived logic
  PERFORM public.update_challenge_statuses();
  
  -- 2. Send "starting soon" notifications (time-derived)
  PERFORM public.send_challenge_starting_soon_notifications();
  
  -- 3. Send "ending soon" notifications (time-derived)
  PERFORM public.send_challenge_ending_soon_notifications();
  
  -- 4. Send "completed" notifications (time-derived)
  PERFORM public.send_challenge_completed_notifications();
END;
$$;

COMMENT ON FUNCTION public.process_scheduled_notifications() IS
'Master scheduled function called by pg_cron every hour.

Execution order:
1. update_challenge_statuses() - Syncs status column (cache only, not for correctness)
2. send_challenge_starting_soon_notifications() - Time-derived
3. send_challenge_ending_soon_notifications() - Time-derived
4. send_challenge_completed_notifications() - Time-derived

All notification functions use TIME-DERIVED filtering (comparing start_date/end_date
with now()) rather than reading the status column. This ensures notifications
fire correctly even if the status column is stale.';

-- =============================================================================
-- PART 6: ENSURE send_challenge_starting_soon_notifications() IS TIME-DERIVED
-- =============================================================================
-- This recreates the function with time-derived logic (idempotent - safe to re-run)
--
-- NOTE: DROP first to ensure clean creation.

DROP FUNCTION IF EXISTS public.send_challenge_starting_soon_notifications();

CREATE OR REPLACE FUNCTION public.send_challenge_starting_soon_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
  v_hours_until_start integer;
BEGIN
  -- Find challenges that:
  -- 1. Haven't started yet (TIME-DERIVED: start_date > now())
  -- 2. Start within the next 24 hours
  -- 3. Haven't had starting_soon notification sent yet
  -- 4. Not cancelled/archived
  FOR v_challenge IN
    SELECT c.id, c.title, c.start_date
    FROM public.challenges c
    WHERE c.status NOT IN ('cancelled', 'archived')
      AND c.start_date > now()  -- TIME-DERIVED: hasn't started
      AND c.start_date <= now() + interval '24 hours'
      AND c.starting_soon_notified_at IS NULL
  LOOP
    -- Calculate hours until start (for message)
    v_hours_until_start := GREATEST(1, EXTRACT(EPOCH FROM (v_challenge.start_date - now())) / 3600)::integer;

    -- Notify all accepted participants
    FOR v_participant IN
      SELECT cp.user_id
      FROM public.challenge_participants cp
      WHERE cp.challenge_id = v_challenge.id
        AND cp.invite_status = 'accepted'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_participant.user_id,
        'challenge_starting_soon',
        'Challenge starting soon!',
        '"' || v_challenge.title || '" starts in ' || v_hours_until_start || ' hour' || 
          CASE WHEN v_hours_until_start = 1 THEN '' ELSE 's' END || '!',
        jsonb_build_object(
          'challenge_id', v_challenge.id,
          'starts_at', v_challenge.start_date
        )
      );
    END LOOP;

    -- Mark as notified to prevent duplicates
    UPDATE public.challenges
    SET starting_soon_notified_at = now()
    WHERE id = v_challenge.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_challenge_starting_soon_notifications() IS
'Scheduled function: Sends notifications for challenges starting within 24 hours.
Uses TIME-DERIVED filtering (start_date > now()) instead of status column.
Idempotent via starting_soon_notified_at column. Called by pg_cron.';

-- =============================================================================
-- PART 7: ENSURE send_challenge_ending_soon_notifications() IS TIME-DERIVED
-- =============================================================================
-- This recreates the function with time-derived logic (idempotent - safe to re-run)
--
-- NOTE: DROP first to ensure clean creation.

DROP FUNCTION IF EXISTS public.send_challenge_ending_soon_notifications();

CREATE OR REPLACE FUNCTION public.send_challenge_ending_soon_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
  v_hours_until_end integer;
BEGIN
  -- Find challenges that:
  -- 1. Have started but haven't ended (TIME-DERIVED)
  -- 2. End within the next 24 hours
  -- 3. Haven't had ending_soon notification sent yet
  -- 4. Not cancelled/archived
  FOR v_challenge IN
    SELECT c.id, c.title, c.end_date
    FROM public.challenges c
    WHERE c.status NOT IN ('cancelled', 'archived')
      AND c.start_date <= now()  -- TIME-DERIVED: has started
      AND c.end_date > now()     -- TIME-DERIVED: hasn't ended
      AND c.end_date <= now() + interval '24 hours'
      AND c.ending_soon_notified_at IS NULL
  LOOP
    -- Calculate hours until end (for message)
    v_hours_until_end := GREATEST(1, EXTRACT(EPOCH FROM (v_challenge.end_date - now())) / 3600)::integer;

    -- Notify all accepted participants
    FOR v_participant IN
      SELECT cp.user_id
      FROM public.challenge_participants cp
      WHERE cp.challenge_id = v_challenge.id
        AND cp.invite_status = 'accepted'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_participant.user_id,
        'challenge_ending_soon',
        'Challenge ending soon!',
        '"' || v_challenge.title || '" ends in ' || v_hours_until_end || ' hour' || 
          CASE WHEN v_hours_until_end = 1 THEN '' ELSE 's' END || '. Final push!',
        jsonb_build_object(
          'challenge_id', v_challenge.id,
          'ends_at', v_challenge.end_date
        )
      );
    END LOOP;

    -- Mark as notified to prevent duplicates
    UPDATE public.challenges
    SET ending_soon_notified_at = now()
    WHERE id = v_challenge.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_challenge_ending_soon_notifications() IS
'Scheduled function: Sends notifications for challenges ending within 24 hours.
Uses TIME-DERIVED filtering (start_date <= now() AND end_date > now()) instead of status column.
Idempotent via ending_soon_notified_at column. Called by pg_cron.';

-- =============================================================================
-- PART 8: ENSURE get_my_challenges() IS TIME-DERIVED
-- =============================================================================
-- Recreate with time-derived logic (idempotent - safe to re-run)
-- Must include all columns from migration 029

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

COMMENT ON FUNCTION public.get_my_challenges(text) IS
'Get challenges for current user with TIME-DERIVED filtering.

Filters:
  - ''active'': challenges where end_date > now() (includes upcoming and in-progress)
  - ''completed'': challenges where end_date <= now()

ARCHITECTURAL CONTRACT:
This function uses TIME-DERIVED filtering (comparing end_date with now())
instead of reading the status column. This ensures correctness regardless
of whether the status column has been updated by the cron job.

The status column is excluded from filtering but included in output
for backwards compatibility and debugging.';

-- =============================================================================
-- PART 9: DOCUMENT THE ARCHITECTURAL CONTRACT
-- =============================================================================

COMMENT ON COLUMN public.challenges.status IS 
'ARCHITECTURAL CONTRACT: EXPLICIT STATES ONLY
============================================

This column MUST ONLY store EXPLICIT USER ACTIONS:
  - ''cancelled'' : User explicitly cancelled the challenge
  - ''archived''  : Creator''s account was deleted

The following states are TIME-DERIVED and MUST NOT be read from this column:
  - ''pending''   : Compute as start_date > now()
  - ''active''    : Compute as start_date <= now() AND end_date > now()
  - ''completed'' : Compute as end_date <= now()

WHY THIS MATTERS:
- The status column requires cron to stay in sync
- If cron fails/delays, status becomes stale
- Time-derived logic is ALWAYS correct

CORRECT PATTERNS:
  WHERE c.status NOT IN (''cancelled'', ''archived'')
    AND c.end_date > now()  -- "active" challenges

INCORRECT PATTERNS:
  WHERE c.status = ''active''  -- DON''T DO THIS
  WHERE c.status IN (''pending'', ''active'')  -- DON''T DO THIS

The status column exists for:
1. Explicit user actions (cancel)
2. Account lifecycle (archive on deletion)
3. Legacy compatibility / admin dashboards
4. Debugging

It is updated by update_challenge_statuses() as a CACHE, not as source of truth.';

-- =============================================================================
-- PART 10: VERIFY pg_cron SCHEDULE EXISTS
-- =============================================================================
-- Re-apply the schedule in case migration 029 didn't run

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if present
    BEGIN
      PERFORM cron.unschedule('process-scheduled-notifications');
    EXCEPTION WHEN OTHERS THEN
      -- Job doesn't exist, that's fine
      NULL;
    END;
    
    -- Schedule hourly job
    PERFORM cron.schedule(
      'process-scheduled-notifications',
      '0 * * * *',  -- Every hour at minute 0
      'SELECT public.process_scheduled_notifications()'
    );
    
    RAISE NOTICE 'pg_cron job scheduled: process-scheduled-notifications (hourly)';
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled. Enable it in Supabase Dashboard -> Database -> Extensions -> pg_cron';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %. Enable pg_cron in Supabase Dashboard.', SQLERRM;
END;
$$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- 
-- VERIFICATION CHECKLIST:
-- [ ] get_my_challenges('active') returns challenges where end_date > now()
-- [ ] get_my_challenges('completed') returns challenges where end_date <= now()
-- [ ] get_challenges_for_health_sync() uses time-derived filtering
-- [ ] send_challenge_completed_notifications() sends on end_date <= now()
-- [ ] trg_notify_challenge_completed trigger is dropped
-- [ ] completed_notified_at column exists
-- [ ] pg_cron job is scheduled
-- [ ] All notification functions use time-derived + idempotency columns
--
-- MANUAL TEST:
-- 1. Create a challenge that ended yesterday
-- 2. Run: SELECT * FROM get_my_challenges('active');  -- Should NOT appear
-- 3. Run: SELECT * FROM get_my_challenges('completed');  -- Should appear
-- 4. Run: SELECT process_scheduled_notifications();  -- Should send completed notification
-- 5. Verify notification in notifications table
-- =============================================================================