-- =============================================================================
-- MIGRATION 020: Drop Deprecated Challenge ID RPCs
-- =============================================================================
-- The following functions have been superseded by get_my_challenges(p_filter):
--   - get_active_challenge_ids()
--   - get_completed_challenge_ids()
--
-- The consolidated RPC provides:
--   - Single atomic query (no race windows)
--   - Full challenge data with participation info
--   - Server-side ranking
--   - Same time-based filtering logic
--
-- This migration removes the deprecated functions to prevent confusion.
-- =============================================================================

-- Drop with IF EXISTS to make migration idempotent
DROP FUNCTION IF EXISTS public.get_active_challenge_ids();
DROP FUNCTION IF EXISTS public.get_completed_challenge_ids();

-- Document the removal
COMMENT ON FUNCTION public.get_my_challenges(text) IS
'Consolidated challenge fetch with server-side filtering and ranking.

Supersedes the deprecated functions:
  - get_active_challenge_ids() 
  - get_completed_challenge_ids()

Parameters:
  p_filter: "active" | "completed"
  
Active filter: start_date <= now() AND end_date > now()
Completed filter: end_date <= now()

Both exclude: cancelled, archived statuses

Returns full challenge data with:
  - my_invite_status, my_current_progress
  - participant_count, my_rank (server-side RANK())

Order:
  - active: start_date ASC
  - completed: end_date DESC (limited to 20)';