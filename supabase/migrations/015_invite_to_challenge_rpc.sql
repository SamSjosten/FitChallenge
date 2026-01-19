-- =============================================================================
-- INVITE TO CHALLENGE RPC
-- =============================================================================
-- Atomic check-and-insert for challenge invites.
-- Enforces max_participants limit at DB level.
--
-- Error codes:
--   'challenge_full' - Challenge has reached max_participants limit
--
-- NOTE: Uses SECURITY INVOKER so RLS policies still apply (creator-only insert).

CREATE OR REPLACE FUNCTION public.invite_to_challenge(
  p_challenge_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_max_participants integer;
  v_current_count integer;
BEGIN
  -- Get max_participants for this challenge
  SELECT max_participants INTO v_max_participants
  FROM public.challenges
  WHERE id = p_challenge_id;

  -- If limit is set, check current count
  IF v_max_participants IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND invite_status IN ('pending', 'accepted');

    IF v_current_count >= v_max_participants THEN
      RAISE EXCEPTION 'challenge_full';
    END IF;
  END IF;

  -- Insert participant (RLS still applies via SECURITY INVOKER)
  INSERT INTO public.challenge_participants (challenge_id, user_id, invite_status)
  VALUES (p_challenge_id, p_user_id, 'pending');
END;
$$;