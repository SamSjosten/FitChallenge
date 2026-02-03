-- =============================================================================
-- MIGRATION 029: COMPLETE NOTIFICATION TYPES
-- Implements: friend_request_accepted, challenge_starting_soon, 
--             challenge_ending_soon, challenge_completed
-- =============================================================================

-- =============================================================================
-- PART 1: CHALLENGE NOTIFICATION TRACKING COLUMNS
-- Track whether starting_soon/ending_soon notifications have been sent
-- =============================================================================

ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS starting_soon_notified_at timestamptz,
ADD COLUMN IF NOT EXISTS ending_soon_notified_at timestamptz;

COMMENT ON COLUMN public.challenges.starting_soon_notified_at IS 
'Timestamp when challenge_starting_soon notifications were sent. NULL = not yet sent.';

COMMENT ON COLUMN public.challenges.ending_soon_notified_at IS 
'Timestamp when challenge_ending_soon notifications were sent. NULL = not yet sent.';

-- =============================================================================
-- PART 1B: UPDATE get_my_challenges RPC TO RETURN NEW COLUMNS
-- =============================================================================

-- Must drop first because return type is changing
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
      c.status NOT IN ('cancelled', 'archived')
      AND CASE 
        WHEN p_filter = 'active' THEN c.status IN ('pending', 'active')
        WHEN p_filter = 'completed' THEN c.status = 'completed'
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
  ORDER BY mc.end_date ASC;
END;
$$;

-- =============================================================================
-- PART 2: FRIEND REQUEST ACCEPTED NOTIFICATION
-- Trigger: fires when friendship status changes to 'accepted'
-- Recipient: The original requester (requested_by)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_friend_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepter_name text;
BEGIN
  -- Only fire when status changes from 'pending' to 'accepted'
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Get accepter's display name (the person who received and accepted the request)
    SELECT COALESCE(pp.display_name, pp.username)
    INTO v_accepter_name
    FROM public.profiles_public pp
    WHERE pp.id = NEW.requested_to;

    -- Notify the original requester that their request was accepted
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.requested_by,
      'friend_request_accepted',
      'Friend request accepted',
      v_accepter_name || ' accepted your friend request!',
      jsonb_build_object(
        'friend_id', NEW.requested_to,
        'friendship_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to allow re-running migration
DROP TRIGGER IF EXISTS trg_notify_friend_request_accepted ON public.friends;

CREATE TRIGGER trg_notify_friend_request_accepted
AFTER UPDATE OF status ON public.friends
FOR EACH ROW
EXECUTE FUNCTION public.notify_friend_request_accepted();

COMMENT ON FUNCTION public.notify_friend_request_accepted IS
'Trigger: Notifies requester when their friend request is accepted.';

-- =============================================================================
-- PART 3: CHALLENGE COMPLETED NOTIFICATION  
-- Trigger: fires when challenge status changes to 'completed'
-- Recipients: All accepted participants
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_challenge_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Notify all accepted participants
    FOR v_participant IN
      SELECT cp.user_id
      FROM public.challenge_participants cp
      WHERE cp.challenge_id = NEW.id
        AND cp.invite_status = 'accepted'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_participant.user_id,
        'challenge_completed',
        'Challenge completed!',
        '"' || NEW.title || '" has ended. Check out the final results!',
        jsonb_build_object('challenge_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_challenge_completed ON public.challenges;

CREATE TRIGGER trg_notify_challenge_completed
AFTER UPDATE OF status ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.notify_challenge_completed();

COMMENT ON FUNCTION public.notify_challenge_completed IS
'Trigger: Notifies all accepted participants when a challenge completes.';

-- =============================================================================
-- PART 4: CHALLENGE STARTING SOON NOTIFICATIONS
-- Called by pg_cron to notify about challenges starting within 24 hours
-- =============================================================================

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
  -- 1. Are in 'pending' status (not yet started)
  -- 2. Start within the next 24 hours
  -- 3. Haven't had starting_soon notification sent yet
  FOR v_challenge IN
    SELECT c.id, c.title, c.start_date
    FROM public.challenges c
    WHERE c.status = 'pending'
      AND c.start_date > now()
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

COMMENT ON FUNCTION public.send_challenge_starting_soon_notifications IS
'Scheduled function: Sends notifications for challenges starting within 24 hours. Called by pg_cron.';

-- =============================================================================
-- PART 5: CHALLENGE ENDING SOON NOTIFICATIONS
-- Called by pg_cron to notify about challenges ending within 24 hours
-- =============================================================================

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
  -- 1. Are in 'active' status
  -- 2. End within the next 24 hours
  -- 3. Haven't had ending_soon notification sent yet
  FOR v_challenge IN
    SELECT c.id, c.title, c.end_date
    FROM public.challenges c
    WHERE c.status = 'active'
      AND c.end_date > now()
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

COMMENT ON FUNCTION public.send_challenge_ending_soon_notifications IS
'Scheduled function: Sends notifications for challenges ending within 24 hours. Called by pg_cron.';

-- =============================================================================
-- PART 6: COMBINED SCHEDULED NOTIFICATION FUNCTION
-- Single function that pg_cron calls to process all scheduled notifications
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Process challenge starting soon
  PERFORM public.send_challenge_starting_soon_notifications();
  
  -- Process challenge ending soon
  PERFORM public.send_challenge_ending_soon_notifications();
END;
$$;

COMMENT ON FUNCTION public.process_scheduled_notifications IS
'Master scheduled function called by pg_cron every hour to process all scheduled notifications.';

-- =============================================================================
-- PART 7: PG_CRON SCHEDULE
-- Requires pg_cron extension to be enabled in Supabase Dashboard
-- Schedule: Every hour at minute 0
-- =============================================================================

-- Note: This will fail silently if pg_cron is not enabled
-- Enable it in Supabase Dashboard -> Database -> Extensions -> pg_cron

DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if present
    PERFORM cron.unschedule('process-scheduled-notifications');
    
    -- Schedule hourly job
    PERFORM cron.schedule(
      'process-scheduled-notifications',
      '0 * * * *',  -- Every hour at minute 0
      'SELECT public.process_scheduled_notifications()'
    );
    
    RAISE NOTICE 'pg_cron job scheduled: process-scheduled-notifications (hourly)';
  ELSE
    RAISE NOTICE 'pg_cron extension not enabled. Enable it in Supabase Dashboard to schedule notifications.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %. Enable pg_cron in Supabase Dashboard.', SQLERRM;
END;
$$;

-- =============================================================================
-- PART 8: UPDATE TYPE DEFINITIONS IN DATABASE TYPES
-- These notification types are now valid and can be generated
-- =============================================================================

COMMENT ON TABLE public.notifications IS
'User notifications inbox. 
Valid types:
- challenge_invite_received: Someone invited you to a challenge
- challenge_starting_soon: Challenge starts within 24 hours
- challenge_ending_soon: Challenge ends within 24 hours  
- challenge_completed: Challenge has ended
- friend_request_received: Someone sent you a friend request
- friend_request_accepted: Someone accepted your friend request';