-- =============================================================================
-- MIGRATION 035: RETENTION & ENGAGEMENT FEATURES
-- =============================================================================
-- Adds 7 retention features:
--   1. Rank change notifications (trigger on progress update)
--   2. Challenge completion with winner determination (replaces generic completion)
--   3. Streak warning notifications (scheduled, daily)
--   4. Solo challenges (is_solo flag)
--   5. Progress milestone notifications (trigger on progress update)
--   6. Weekly digest notifications (scheduled, Sunday)
--   7. Final push notifications (scheduled, 6h before end)
--
-- Also updates create_challenge_with_participant RPC to accept is_solo
-- and allowed_workout_types parameters.
--
-- Depends on: migrations 001–034
-- =============================================================================


-- =============================================================================
-- PART 1: SCHEMA CHANGES
-- =============================================================================

-- 1a) challenges: solo flag and final push tracking
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false;

ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS final_push_notified_at timestamptz;

COMMENT ON COLUMN public.challenges.is_solo IS
'True for personal goal challenges with no social features.
Skips: rank notifications, invite step, competitive leaderboard.
Uses all existing infrastructure (same RPCs, same tables).';

COMMENT ON COLUMN public.challenges.final_push_notified_at IS
'Timestamp when personalized "final push" notification was sent (6h before end).
NULL = not yet sent. Prevents duplicate sends on scheduler re-runs.';

-- 1b) challenge_participants: rank tracking and milestone tracking
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS previous_rank integer;

ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS milestone_notified integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.challenge_participants.previous_rank IS
'Last computed rank for this participant. Used by detect_rank_changes trigger
to identify users who dropped in rank. NULL until first rank calculation.';

COMMENT ON COLUMN public.challenge_participants.milestone_notified IS
'Highest milestone percentage notification sent (0/25/50/75/100).
Prevents re-firing milestone notifications. Default 0 = no milestones sent.';

-- 1c) profiles: streak warning and digest tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS streak_warning_sent_date date;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.streak_warning_sent_date IS
'Date of last streak warning notification. Prevents duplicate daily warnings.
Compared against CURRENT_DATE to allow one warning per day.';

COMMENT ON COLUMN public.profiles.last_digest_sent_at IS
'Timestamp of last weekly digest notification. Prevents duplicate weekly sends.';


-- =============================================================================
-- PART 2: TRIGGER — RANK CHANGE DETECTION
-- =============================================================================
-- Fires AFTER UPDATE of current_progress on challenge_participants.
-- Recalculates ranks for the challenge and notifies users who dropped.
-- Skips solo challenges (no leaderboard).

DROP FUNCTION IF EXISTS public.detect_rank_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.detect_rank_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge_id uuid;
  v_ranked RECORD;
  v_challenger_name text;
  v_challenge_title text;
  v_is_solo boolean;
BEGIN
  IF NEW.current_progress IS DISTINCT FROM OLD.current_progress THEN
    v_challenge_id := NEW.challenge_id;

    -- Skip solo challenges (no competitive leaderboard)
    SELECT COALESCE(c.is_solo, false), c.title
    INTO v_is_solo, v_challenge_title
    FROM public.challenges c WHERE c.id = v_challenge_id;

    IF v_is_solo THEN RETURN NEW; END IF;

    -- Get the name of the person who just logged activity
    SELECT COALESCE(pp.display_name, pp.username) INTO v_challenger_name
    FROM public.profiles_public pp WHERE pp.id = NEW.user_id;

    -- Recalculate all ranks and detect drops
    FOR v_ranked IN
      SELECT
        cp.user_id,
        cp.previous_rank,
        RANK() OVER (
          ORDER BY cp.current_progress DESC, cp.joined_at ASC
        )::integer AS new_rank
      FROM public.challenge_participants cp
      WHERE cp.challenge_id = v_challenge_id
        AND cp.invite_status = 'accepted'
    LOOP
      -- Notify users who dropped (higher number = worse rank)
      -- Don't notify the person who just logged activity
      IF v_ranked.previous_rank IS NOT NULL
         AND v_ranked.new_rank > v_ranked.previous_rank
         AND v_ranked.user_id != NEW.user_id
      THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_ranked.user_id,
          'rank_change',
          'Leaderboard update',
          v_challenger_name || ' passed you in "' || v_challenge_title ||
            '" — you''re now #' || v_ranked.new_rank,
          jsonb_build_object(
            'challenge_id', v_challenge_id,
            'old_rank', v_ranked.previous_rank,
            'new_rank', v_ranked.new_rank
          )
        );
      END IF;

      -- Update stored rank for all participants
      UPDATE public.challenge_participants
      SET previous_rank = v_ranked.new_rank
      WHERE challenge_id = v_challenge_id
        AND user_id = v_ranked.user_id
        AND (previous_rank IS DISTINCT FROM v_ranked.new_rank);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_rank_changes
AFTER UPDATE OF current_progress ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.detect_rank_changes();

COMMENT ON FUNCTION public.detect_rank_changes IS
'Trigger: detects rank changes after activity logging.
Only notifies users who DROPPED in rank (higher number = worse).
Skips solo challenges. Updates previous_rank for all participants.';


-- =============================================================================
-- PART 3: TRIGGER — PROGRESS MILESTONE DETECTION
-- =============================================================================
-- Fires AFTER UPDATE of current_progress on challenge_participants.
-- Notifies when crossing 25%, 50%, 75%, 100% of goal.
-- Uses milestone_notified column to prevent re-firing.

DROP FUNCTION IF EXISTS public.check_progress_milestones() CASCADE;

CREATE OR REPLACE FUNCTION public.check_progress_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal integer;
  v_pct integer;
  v_milestone integer;
  v_current_milestone integer;
  v_challenge_title text;
  v_msg text;
BEGIN
  IF NEW.current_progress IS DISTINCT FROM OLD.current_progress THEN
    SELECT c.goal_value, c.title INTO v_goal, v_challenge_title
    FROM public.challenges c WHERE c.id = NEW.challenge_id;

    IF v_goal IS NULL OR v_goal <= 0 THEN RETURN NEW; END IF;

    v_pct := LEAST((NEW.current_progress * 100) / v_goal, 100);
    v_milestone := CASE
      WHEN v_pct >= 100 THEN 100
      WHEN v_pct >= 75  THEN 75
      WHEN v_pct >= 50  THEN 50
      WHEN v_pct >= 25  THEN 25
      ELSE 0
    END;

    v_current_milestone := COALESCE(NEW.milestone_notified, 0);

    IF v_milestone > v_current_milestone THEN
      v_msg := CASE v_milestone
        WHEN 25  THEN 'Quarter of the way there!'
        WHEN 50  THEN 'Halfway to your goal!'
        WHEN 75  THEN 'Almost there — 75% done!'
        WHEN 100 THEN 'You hit your goal!'
      END;

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        'progress_milestone',
        v_msg,
        v_pct || '% complete in "' || v_challenge_title || '"',
        jsonb_build_object(
          'challenge_id', NEW.challenge_id,
          'milestone_pct', v_milestone,
          'current_progress', NEW.current_progress,
          'goal_value', v_goal
        )
      );

      -- Prevent re-firing by recording highest milestone sent
      UPDATE public.challenge_participants
      SET milestone_notified = v_milestone
      WHERE challenge_id = NEW.challenge_id AND user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_progress_milestones
AFTER UPDATE OF current_progress ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.check_progress_milestones();

COMMENT ON FUNCTION public.check_progress_milestones IS
'Trigger: detects progress milestone crossings (25/50/75/100%).
Fires once per threshold via milestone_notified column.
100% milestone is complementary to challenge completion (mid-challenge vs end date).';


-- =============================================================================
-- PART 4: REPLACE send_challenge_completed_notifications WITH WINNER DETERMINATION
-- =============================================================================
-- Replaces the generic "challenge completed" notification with:
--   - Winner determination (highest progress, tie-break by earliest join)
--   - final_rank assignment for all participants
--   - Type-specific notifications: challenge_won, challenge_completed, challenge_personal_best
-- Keeps time-derived architecture (scheduled, not trigger-based).

DROP FUNCTION IF EXISTS public.send_challenge_completed_notifications();

CREATE OR REPLACE FUNCTION public.send_challenge_completion_results()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
  v_winner_id uuid;
  v_winner_name text;
  v_participant RECORD;
BEGIN
  -- Find challenges that have ended but haven't been processed
  -- TIME-DERIVED: uses end_date, not status column
  FOR v_challenge IN
    SELECT c.id, c.title, c.goal_value, COALESCE(c.is_solo, false) AS is_solo
    FROM public.challenges c
    WHERE c.status NOT IN ('cancelled', 'archived')
      AND c.end_date <= now()
      AND c.completed_notified_at IS NULL
  LOOP
    -- Determine winner (highest progress, tie-break by earliest join)
    SELECT cp.user_id INTO v_winner_id
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = v_challenge.id
      AND cp.invite_status = 'accepted'
    ORDER BY cp.current_progress DESC, cp.joined_at ASC
    LIMIT 1;

    -- Set final ranks for all accepted participants
    UPDATE public.challenge_participants cp
    SET final_rank = ranked.rank
    FROM (
      SELECT user_id,
        RANK() OVER (ORDER BY current_progress DESC, joined_at ASC)::integer AS rank
      FROM public.challenge_participants
      WHERE challenge_id = v_challenge.id AND invite_status = 'accepted'
    ) ranked
    WHERE cp.challenge_id = v_challenge.id AND cp.user_id = ranked.user_id;

    -- Mark all participants who met the goal as completed
    UPDATE public.challenge_participants
    SET completed = true, completed_at = now()
    WHERE challenge_id = v_challenge.id
      AND invite_status = 'accepted'
      AND current_progress >= v_challenge.goal_value
      AND completed = false;

    -- Get winner name for notifications
    IF v_winner_id IS NOT NULL THEN
      SELECT COALESCE(pp.display_name, pp.username) INTO v_winner_name
      FROM public.profiles_public pp WHERE pp.id = v_winner_id;
    END IF;

    -- Send type-specific notifications
    IF v_challenge.is_solo THEN
      -- Solo challenge: personal result
      IF v_winner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_winner_id,
          'challenge_personal_best',
          'Challenge complete!',
          'You finished "' || v_challenge.title || '" — check your results!',
          jsonb_build_object(
            'challenge_id', v_challenge.id,
            'final_progress', (
              SELECT current_progress FROM public.challenge_participants
              WHERE challenge_id = v_challenge.id AND user_id = v_winner_id
            ),
            'goal_value', v_challenge.goal_value
          )
        );
      END IF;
    ELSE
      -- Social challenge: winner + other participants
      IF v_winner_id IS NOT NULL THEN
        -- Winner notification
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_winner_id,
          'challenge_won',
          'You won!',
          'You took 1st place in "' || v_challenge.title || '"!',
          jsonb_build_object('challenge_id', v_challenge.id, 'final_rank', 1)
        );
      END IF;

      -- Other participants
      FOR v_participant IN
        SELECT cp.user_id, cp.final_rank
        FROM public.challenge_participants cp
        WHERE cp.challenge_id = v_challenge.id
          AND cp.invite_status = 'accepted'
          AND cp.user_id != COALESCE(v_winner_id, '00000000-0000-0000-0000-000000000000'::uuid)
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          v_participant.user_id,
          'challenge_completed',
          'Challenge complete!',
          '"' || v_challenge.title || '" has ended. ' ||
            COALESCE(v_winner_name, 'Nobody') || ' won! You finished #' ||
            v_participant.final_rank || '.',
          jsonb_build_object(
            'challenge_id', v_challenge.id,
            'final_rank', v_participant.final_rank,
            'winner_name', v_winner_name
          )
        );
      END LOOP;
    END IF;

    -- Mark challenge as notified (idempotency — existing column from migration 031)
    UPDATE public.challenges
    SET completed_notified_at = now()
    WHERE id = v_challenge.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_challenge_completion_results IS
'Scheduled function: processes ended challenges with winner determination.
Replaces send_challenge_completed_notifications() with richer results.
Sets final_rank, marks winner, sends type-specific notifications:
  - Solo: challenge_personal_best
  - Winner: challenge_won
  - Others: challenge_completed (includes winner name and rank)
Time-derived, idempotent via completed_notified_at column.';


-- =============================================================================
-- PART 5: STREAK WARNING NOTIFICATIONS (Scheduled, daily)
-- =============================================================================
-- Notifies users with an active streak (≥2 days) who haven't logged today.
-- Prevents duplicates via profiles.streak_warning_sent_date.

DROP FUNCTION IF EXISTS public.send_streak_warning_notifications();

CREATE OR REPLACE FUNCTION public.send_streak_warning_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_today date := CURRENT_DATE;
BEGIN
  FOR v_user IN
    SELECT DISTINCT p.id AS user_id, p.current_streak
    FROM public.profiles p
    INNER JOIN public.challenge_participants cp ON cp.user_id = p.id
    INNER JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE p.current_streak >= 2
      AND p.last_activity_date = v_today - 1  -- Logged yesterday, not today
      AND (p.streak_warning_sent_date IS NULL OR p.streak_warning_sent_date < v_today)
      AND cp.invite_status = 'accepted'
      AND c.status NOT IN ('cancelled', 'archived')
      AND c.start_date <= now()  -- TIME-DERIVED: challenge has started
      AND c.end_date > now()     -- TIME-DERIVED: challenge hasn't ended
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_user.user_id,
      'streak_warning',
      'Keep your streak alive!',
      'You''re on a ' || v_user.current_streak || '-day streak. Log activity today to keep it going!',
      jsonb_build_object('current_streak', v_user.current_streak)
    );

    UPDATE public.profiles
    SET streak_warning_sent_date = v_today
    WHERE id = v_user.user_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_streak_warning_notifications IS
'Scheduled function: warns users with active streaks who haven''t logged today.
Fires once per day per user via streak_warning_sent_date column.
Targets users with streak >= 2 who have at least one active challenge.';


-- =============================================================================
-- PART 6: FINAL PUSH NOTIFICATIONS (Scheduled, hourly)
-- =============================================================================
-- Personalized notification 6h before challenge end with rank and gap context.
-- Prevents duplicates via challenges.final_push_notified_at.

DROP FUNCTION IF EXISTS public.send_final_push_notifications();

CREATE OR REPLACE FUNCTION public.send_final_push_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
  v_gap integer;
  v_body text;
BEGIN
  FOR v_challenge IN
    SELECT c.id, c.title, c.end_date, COALESCE(c.is_solo, false) AS is_solo, c.goal_value
    FROM public.challenges c
    WHERE c.status NOT IN ('cancelled', 'archived')
      AND c.end_date > now()
      AND c.end_date <= now() + interval '6 hours'
      AND c.start_date <= now()  -- TIME-DERIVED: has started
      AND c.final_push_notified_at IS NULL
  LOOP
    FOR v_participant IN
      SELECT cp.user_id, cp.current_progress,
        RANK() OVER (ORDER BY cp.current_progress DESC, cp.joined_at ASC)::integer AS rank,
        COUNT(*) OVER ()::integer AS total
      FROM public.challenge_participants cp
      WHERE cp.challenge_id = v_challenge.id AND cp.invite_status = 'accepted'
    LOOP
      v_body := 'Last few hours for "' || v_challenge.title || '"! ';

      IF v_challenge.is_solo THEN
        IF v_participant.current_progress >= v_challenge.goal_value THEN
          v_body := v_body || 'You hit your goal — finish strong!';
        ELSE
          v_body := v_body || (v_challenge.goal_value - v_participant.current_progress) || ' to go!';
        END IF;
      ELSIF v_participant.rank = 1 THEN
        v_body := v_body || 'You''re in 1st — defend your lead!';
      ELSE
        -- Find gap to next position above
        SELECT cp2.current_progress - v_participant.current_progress INTO v_gap
        FROM public.challenge_participants cp2
        WHERE cp2.challenge_id = v_challenge.id AND cp2.invite_status = 'accepted'
          AND cp2.current_progress > v_participant.current_progress
        ORDER BY cp2.current_progress ASC LIMIT 1;

        v_body := v_body || 'You''re #' || v_participant.rank;
        IF v_gap IS NOT NULL THEN
          v_body := v_body || ' — just ' || v_gap || ' behind the next spot!';
        ELSE
          v_body := v_body || '. Give it everything!';
        END IF;
      END IF;

      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_participant.user_id, 'final_push', 'Final push!', v_body,
        jsonb_build_object('challenge_id', v_challenge.id, 'rank', v_participant.rank)
      );
    END LOOP;

    -- Mark as notified (idempotency)
    UPDATE public.challenges SET final_push_notified_at = now()
    WHERE id = v_challenge.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_final_push_notifications IS
'Scheduled function: personalized "final push" notification 6h before challenge end.
Context-aware: solo (gap to goal), 1st place (defend lead), others (gap to next rank).
Fires once per challenge via final_push_notified_at column.';


-- =============================================================================
-- PART 7: WEEKLY DIGEST NOTIFICATIONS (Scheduled, Sunday)
-- =============================================================================
-- Sunday evening summary of the past week across all active challenges.
-- Skips truly inactive users (0 activities AND 0 active challenges).

DROP FUNCTION IF EXISTS public.send_weekly_digest_notifications();

CREATE OR REPLACE FUNCTION public.send_weekly_digest_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_week_start timestamptz := now() - interval '7 days';
  v_total_activities integer;
  v_active_challenges integer;
  v_best_rank integer;
  v_body text;
BEGIN
  FOR v_user IN
    SELECT DISTINCT p.id AS user_id, p.current_streak
    FROM public.profiles p
    INNER JOIN public.challenge_participants cp ON cp.user_id = p.id
    INNER JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.invite_status = 'accepted'
      AND c.status NOT IN ('cancelled', 'archived')
      AND (c.start_date <= now() AND c.end_date > now()  -- Active (time-derived)
           OR c.start_date > now())                       -- Or upcoming
      AND (p.last_digest_sent_at IS NULL OR p.last_digest_sent_at < v_week_start)
  LOOP
    SELECT COUNT(*) INTO v_total_activities
    FROM public.activity_logs al
    WHERE al.user_id = v_user.user_id
      AND al.recorded_at >= v_week_start;

    SELECT COUNT(*) INTO v_active_challenges
    FROM public.challenge_participants cp
    INNER JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = v_user.user_id
      AND cp.invite_status = 'accepted'
      AND c.start_date <= now() AND c.end_date > now();  -- Active (time-derived)

    SELECT MIN(cp.previous_rank) INTO v_best_rank
    FROM public.challenge_participants cp
    INNER JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = v_user.user_id
      AND cp.invite_status = 'accepted'
      AND c.start_date <= now() AND c.end_date > now()
      AND cp.previous_rank IS NOT NULL;

    -- Skip truly inactive users
    IF v_total_activities = 0 AND v_active_challenges = 0 THEN CONTINUE; END IF;

    v_body := 'This week: ' || v_total_activities || ' activities';
    IF v_active_challenges > 0 THEN
      v_body := v_body || ', ' || v_active_challenges || ' active challenge' ||
        CASE WHEN v_active_challenges > 1 THEN 's' ELSE '' END;
    END IF;
    IF v_best_rank IS NOT NULL THEN
      v_body := v_body || ', best rank #' || v_best_rank;
    END IF;
    IF COALESCE(v_user.current_streak, 0) > 0 THEN
      v_body := v_body || '. ' || v_user.current_streak || '-day streak!';
    ELSE
      v_body := v_body || '.';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_user.user_id, 'weekly_digest', 'Your weekly summary', v_body,
      jsonb_build_object(
        'total_activities', v_total_activities,
        'active_challenges', v_active_challenges,
        'best_rank', v_best_rank,
        'current_streak', COALESCE(v_user.current_streak, 0)
      )
    );

    UPDATE public.profiles SET last_digest_sent_at = now()
    WHERE id = v_user.user_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.send_weekly_digest_notifications IS
'Scheduled function: Sunday evening weekly summary.
Includes: activity count, active challenges, best rank, current streak.
Skips inactive users (0 activities + 0 active challenges).
Fires once per week via last_digest_sent_at column.';


-- =============================================================================
-- PART 8: UPDATE MASTER SCHEDULER
-- =============================================================================
-- Replace process_scheduled_notifications to include new functions
-- and use the new completion results function.

DROP FUNCTION IF EXISTS public.process_scheduled_notifications();

CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update status column as CACHE (not for correctness — time-derived queries)
  PERFORM public.update_challenge_statuses();

  -- 2. Send "starting soon" notifications (time-derived)
  PERFORM public.send_challenge_starting_soon_notifications();

  -- 3. Send "ending soon" notifications (time-derived, 24h)
  PERFORM public.send_challenge_ending_soon_notifications();

  -- 4. Process challenge completion with winner determination (time-derived)
  -- Replaces old send_challenge_completed_notifications()
  PERFORM public.send_challenge_completion_results();

  -- 5. Send streak warnings (daily, targets users with streak ≥ 2)
  PERFORM public.send_streak_warning_notifications();

  -- 6. Send "final push" notifications (6h before end, personalized by rank)
  PERFORM public.send_final_push_notifications();
END;
$$;

COMMENT ON FUNCTION public.process_scheduled_notifications IS
'Master scheduled function called by pg_cron every hour.

Execution order:
1. update_challenge_statuses() — Syncs status column (cache only)
2. send_challenge_starting_soon_notifications() — 24h before start
3. send_challenge_ending_soon_notifications() — 24h before end
4. send_challenge_completion_results() — Winner determination + results
5. send_streak_warning_notifications() — Streak at risk warnings
6. send_final_push_notifications() — Personalized 6h countdown

Weekly digest runs separately via pg_cron (Sunday 6pm UTC):
  SELECT public.send_weekly_digest_notifications()';


-- =============================================================================
-- PART 9: UPDATE create_challenge_with_participant RPC
-- =============================================================================
-- Add p_is_solo and p_allowed_workout_types parameters.
-- Must DROP old signature first since parameter list changes.

DROP FUNCTION IF EXISTS public.create_challenge_with_participant(text, text, integer, text, timestamptz, timestamptz, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.create_challenge_with_participant(
  -- Required parameters (no defaults)
  p_title text,
  p_challenge_type text,
  p_goal_value integer,
  p_goal_unit text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  -- Optional parameters (with defaults)
  p_description text DEFAULT NULL,
  p_custom_activity_name text DEFAULT NULL,
  p_win_condition text DEFAULT 'highest_total',
  p_daily_target integer DEFAULT NULL,
  p_is_solo boolean DEFAULT false,
  p_allowed_workout_types text[] DEFAULT NULL
)
RETURNS public.challenges
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_challenge public.challenges;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  -- Validate dates
  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'invalid_dates: end_date must be after start_date';
  END IF;

  -- Validate goal_value
  IF p_goal_value <= 0 THEN
    RAISE EXCEPTION 'invalid_goal_value: must be positive';
  END IF;

  -- Insert challenge
  INSERT INTO public.challenges (
    creator_id,
    title,
    description,
    challenge_type,
    custom_activity_name,
    goal_value,
    goal_unit,
    win_condition,
    daily_target,
    start_date,
    end_date,
    status,
    is_solo,
    allowed_workout_types
  ) VALUES (
    v_user_id,
    p_title,
    p_description,
    p_challenge_type::challenge_type,
    CASE WHEN p_challenge_type = 'custom' THEN p_custom_activity_name ELSE NULL END,
    p_goal_value,
    p_goal_unit,
    p_win_condition::win_condition,
    p_daily_target,
    p_start_date,
    p_end_date,
    'pending',
    COALESCE(p_is_solo, false),
    CASE WHEN p_challenge_type = 'workouts' THEN p_allowed_workout_types ELSE NULL END
  )
  RETURNING * INTO v_challenge;

  -- Insert creator as accepted participant (atomic with challenge creation)
  INSERT INTO public.challenge_participants (
    challenge_id,
    user_id,
    invite_status
  ) VALUES (
    v_challenge.id,
    v_user_id,
    'accepted'
  );

  RETURN v_challenge;
END;
$$;

ALTER FUNCTION public.create_challenge_with_participant SET search_path = public;

COMMENT ON FUNCTION public.create_challenge_with_participant IS
'Atomic challenge creation + creator participation in single transaction.
Prevents partial state where challenge exists without creator participation.
V2: Added p_is_solo and p_allowed_workout_types parameters.';


-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Schema:
-- [ ] challenge_participants.previous_rank exists
-- [ ] challenge_participants.milestone_notified exists (default 0)
-- [ ] challenges.is_solo exists (default false)
-- [ ] challenges.final_push_notified_at exists
-- [ ] profiles.streak_warning_sent_date exists
-- [ ] profiles.last_digest_sent_at exists
--
-- Triggers:
-- [ ] trg_detect_rank_changes on challenge_participants.current_progress
-- [ ] trg_check_progress_milestones on challenge_participants.current_progress
-- [ ] Rank change skips solo challenges
-- [ ] Milestones fire once per threshold
--
-- Scheduled:
-- [ ] send_challenge_completion_results() replaces old completion function
-- [ ] send_streak_warning_notifications() prevents daily duplicates
-- [ ] send_final_push_notifications() fires 6h before end, once per challenge
-- [ ] send_weekly_digest_notifications() runs Sunday, skips inactive users
-- [ ] process_scheduled_notifications() updated with all new functions
--
-- RPC:
-- [ ] create_challenge_with_participant accepts p_is_solo and p_allowed_workout_types
--
-- Privacy:
-- [ ] Rank change doesn't expose exact progress numbers
-- [ ] Final push doesn't expose other users' exact progress in body
-- [ ] Digest only includes user's own stats
--
-- Backward Compatibility:
-- [ ] Existing challenges get is_solo = false
-- [ ] Existing participants get milestone_notified = 0, previous_rank = NULL
-- [ ] Old send_challenge_completed_notifications() replaced cleanly