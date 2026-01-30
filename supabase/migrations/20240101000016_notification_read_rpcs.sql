-- Migration: 016_notification_read_rpcs.sql
-- Description: Server-authoritative timestamp for marking notifications as read
-- 
-- These RPCs ensure read_at is set by the database (now()) rather than
-- relying on client device time, which may be incorrect.

-- =============================================================================
-- MARK SINGLE NOTIFICATION AS READ
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND read_at IS NULL;
END;
$$;

-- =============================================================================
-- MARK ALL NOTIFICATIONS AS READ
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
END;
$$;