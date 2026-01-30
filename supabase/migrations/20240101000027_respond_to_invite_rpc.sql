-- 027_stale_notification_triggers.sql
-- Automatic stale notification cleanup via database triggers
--
-- PROBLEM: When underlying state changes (invite declined, challenge cancelled,
-- friend request accepted), notifications become stale and point to inaccessible
-- or irrelevant resources.
--
-- SOLUTION: Database triggers automatically mark notifications as read when the
-- underlying resource state changes. This catches ALL cases, regardless of how
-- the change happens (RPC, direct update, admin action, future code paths).
--
-- CONTRACT: Notifications remain immutable (no DELETE), only read_at is set.
-- CONTRACT: Database enforces the invariant, not application code.
--
-- NOTIFICATION TYPES AND STALENESS:
-- | Type                      | Stale When                              |
-- |---------------------------|-----------------------------------------|
-- | challenge_invite_received | invite_status != 'pending'              |
-- | challenge_starting_soon   | challenge cancelled/archived            |
-- | challenge_ending_soon     | challenge cancelled/archived            |
-- | challenge_completed       | Never (historical record)               |
-- | friend_request_received   | friendship status != 'pending'          |
-- | friend_request_accepted   | Never (historical record)               |

-- =============================================================================
-- TRIGGER 1: Challenge participant status changes
-- =============================================================================
-- Fires when: invite_status changes (pending -> accepted/declined/removed)
-- Marks as read: challenge_invite_received

CREATE OR REPLACE FUNCTION public.on_participant_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When invite_status changes FROM 'pending' to anything else,
  -- mark the invite notification as read
  IF OLD.invite_status = 'pending' AND NEW.invite_status != 'pending' THEN
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = NEW.user_id
      AND type = 'challenge_invite_received'
      AND data->>'challenge_id' = NEW.challenge_id::text
      AND read_at IS NULL;
  END IF;
  
  -- When participant leaves (accepted -> declined), also mark any
  -- challenge_starting_soon or challenge_ending_soon as read
  IF OLD.invite_status = 'accepted' AND NEW.invite_status = 'declined' THEN
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = NEW.user_id
      AND type IN ('challenge_starting_soon', 'challenge_ending_soon')
      AND data->>'challenge_id' = NEW.challenge_id::text
      AND read_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participant_status_change ON challenge_participants;
DROP TRIGGER IF EXISTS trg_mark_stale_invite_notifications ON challenge_participants;

CREATE TRIGGER trg_participant_status_change
AFTER UPDATE OF invite_status ON challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.on_participant_status_change();

-- =============================================================================
-- TRIGGER 2: Challenge status changes
-- =============================================================================
-- Fires when: challenge status becomes cancelled/archived
-- Marks as read: challenge_invite_received, challenge_starting_soon, challenge_ending_soon

CREATE OR REPLACE FUNCTION public.on_challenge_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When challenge becomes inaccessible (cancelled or archived),
  -- mark all related notifications as read for ALL users
  IF NEW.status IN ('cancelled', 'archived') AND OLD.status NOT IN ('cancelled', 'archived') THEN
    UPDATE notifications
    SET read_at = now()
    WHERE type IN ('challenge_invite_received', 'challenge_starting_soon', 'challenge_ending_soon')
      AND data->>'challenge_id' = NEW.id::text
      AND read_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_status_change ON challenges;
DROP TRIGGER IF EXISTS trg_mark_stale_challenge_notifications ON challenges;

CREATE TRIGGER trg_challenge_status_change
AFTER UPDATE OF status ON challenges
FOR EACH ROW
EXECUTE FUNCTION public.on_challenge_status_change();

-- =============================================================================
-- TRIGGER 3: Friendship status changes
-- =============================================================================
-- Fires when: friendship status changes (pending -> accepted/blocked)
-- Marks as read: friend_request_received
--
-- Note: friend_request_received notification is sent to requested_to (recipient)
-- The notification data contains requester_id (the person who sent the request)

CREATE OR REPLACE FUNCTION public.on_friendship_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When friendship status changes FROM 'pending' to anything else,
  -- mark the friend request notification as read
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = NEW.requested_to  -- Notification was sent to recipient
      AND type = 'friend_request_received'
      AND data->>'requester_id' = NEW.requested_by::text
      AND read_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friendship_status_change ON friends;

CREATE TRIGGER trg_friendship_status_change
AFTER UPDATE OF status ON friends
FOR EACH ROW
EXECUTE FUNCTION public.on_friendship_status_change();

-- =============================================================================
-- TRIGGER 4: Friendship deleted (request withdrawn/cancelled)
-- =============================================================================
-- Fires when: friendship row is deleted while still pending
-- Marks as read: friend_request_received

CREATE OR REPLACE FUNCTION public.on_friendship_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a pending friendship is deleted (request withdrawn),
  -- mark the notification as read
  IF OLD.status = 'pending' THEN
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = OLD.requested_to
      AND type = 'friend_request_received'
      AND data->>'requester_id' = OLD.requested_by::text
      AND read_at IS NULL;
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_friendship_deleted ON friends;

CREATE TRIGGER trg_friendship_deleted
AFTER DELETE ON friends
FOR EACH ROW
EXECUTE FUNCTION public.on_friendship_deleted();

-- =============================================================================
-- CONVENIENCE RPCs
-- =============================================================================
-- These RPCs provide cleaner error handling. Triggers handle notification cleanup.

CREATE OR REPLACE FUNCTION public.respond_to_challenge_invite(
  p_challenge_id uuid,
  p_response text  -- 'accepted' or 'declined'
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rows_affected int;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid_response: must be accepted or declined';
  END IF;

  UPDATE challenge_participants
  SET 
    invite_status = p_response,
    updated_at = now()
  WHERE challenge_id = p_challenge_id
    AND user_id = v_user_id
    AND invite_status = 'pending';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'invite_not_found: no pending invite for this challenge';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_challenge(
  p_challenge_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rows_affected int;
BEGIN
  UPDATE challenge_participants
  SET 
    invite_status = 'declined',
    updated_at = now()
  WHERE challenge_id = p_challenge_id
    AND user_id = v_user_id
    AND invite_status = 'accepted';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'not_participant: not an accepted participant';
  END IF;
END;
$$;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.on_participant_status_change IS 
'Trigger: marks challenge notifications as read when participant status changes.';

COMMENT ON FUNCTION public.on_challenge_status_change IS
'Trigger: marks challenge notifications as read when challenge is cancelled/archived.';

COMMENT ON FUNCTION public.on_friendship_status_change IS
'Trigger: marks friend_request_received as read when friendship status changes.';

COMMENT ON FUNCTION public.on_friendship_deleted IS
'Trigger: marks friend_request_received as read when pending friendship is deleted.';

COMMENT ON FUNCTION public.respond_to_challenge_invite IS 
'Respond to a challenge invite. Notification cleanup handled by trigger.';

COMMENT ON FUNCTION public.leave_challenge IS
'Leave a challenge. Notification cleanup handled by trigger.';