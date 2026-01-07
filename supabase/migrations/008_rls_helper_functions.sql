-- migrations/007_rls_helper_functions.sql
-- =============================================================================
-- RLS HELPER FUNCTIONS
-- =============================================================================
-- These security definer functions prevent infinite recursion when RLS policies
-- on `challenges` and `challenge_participants` reference each other.
--
-- REQUIRED: These functions must exist before the RLS policies are created.
-- =============================================================================

-- Check if user is a challenge participant with given status(es)
CREATE OR REPLACE FUNCTION public.check_participant_status(
  p_challenge_id uuid,
  p_user_id uuid,
  p_statuses text[]
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND user_id = p_user_id
      AND invite_status = ANY(p_statuses)
  );
$$;

-- Check if user is the creator of a challenge
CREATE OR REPLACE FUNCTION public.is_challenge_creator(
  p_challenge_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges
    WHERE id = p_challenge_id
      AND creator_id = p_user_id
  );
$$;

-- Check if user is a participant (pending or accepted) in a challenge
CREATE OR REPLACE FUNCTION public.is_challenge_participant(
  p_challenge_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND user_id = p_user_id
      AND invite_status IN ('pending', 'accepted')
  );
$$;

-- =============================================================================
-- UPDATED RLS POLICIES (Replace originals to avoid recursion)
-- =============================================================================

-- Drop original policies
DROP POLICY IF EXISTS "Users can view challenges they are part of" ON public.challenges;
DROP POLICY IF EXISTS "Participants visibility scoped by role" ON public.challenge_participants;

-- Recreate challenges SELECT policy with helper function
CREATE POLICY "Users can view challenges they are part of"
ON public.challenges FOR SELECT
USING (
  creator_id = auth.uid()
  OR is_challenge_participant(challenges.id, auth.uid())
);

-- Recreate challenge_participants SELECT policy with helper functions
CREATE POLICY "Participants visibility scoped by role"
ON public.challenge_participants FOR SELECT
USING (
  -- Users always see their own row
  user_id = auth.uid()
  -- Creator sees all participants
  OR is_challenge_creator(challenge_participants.challenge_id, auth.uid())
  -- Accepted participants see other accepted participants
  OR (
    invite_status = 'accepted'
    AND check_participant_status(
      challenge_participants.challenge_id,
      auth.uid(),
      ARRAY['accepted']
    )
  )
);
