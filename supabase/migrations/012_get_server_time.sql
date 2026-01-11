-- migrations/012_get_server_time.sql
-- =============================================================================
-- PATCH 3: SERVER TIME RPC FOR CLIENT CLOCK SYNC
-- =============================================================================
-- Problem:
--   Client devices may have drifted clocks, causing incorrect challenge status
--   display and confusing UX (even though DB is authoritative for writes).
--
-- Solution:
--   Simple RPC that returns server's now() timestamp.
--   Client caches the offset and applies it to local time calculations.
--
-- Note: This does not affect DB enforcement - it only improves client UI accuracy.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT now();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated;

-- Optional: allow unauthenticated clients to sync clock pre-login
-- GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon;