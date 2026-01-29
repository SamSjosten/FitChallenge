-- Migration: 025_health_setup_tracking.sql
-- Description: Add health_setup_completed_at to profiles for tracking onboarding state
--
-- This enables:
-- - Showing health sync screen only to users who haven't completed setup
-- - Tracking when users completed health integration
-- - Distinguishing first-time users from returning users

-- =============================================================================
-- ADD HEALTH SETUP TRACKING COLUMN
-- =============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS health_setup_completed_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.health_setup_completed_at IS 
  'Timestamp when user completed health data sync setup. NULL means not yet completed.';

-- =============================================================================
-- SYNC TO PROFILES_PUBLIC (Optional - only if you want this visible)
-- =============================================================================
-- Note: We're NOT syncing this to profiles_public since it's private user state.
-- The health_setup_completed_at column stays in profiles only.

-- =============================================================================
-- INDEX FOR ANALYTICS (Optional)
-- =============================================================================
-- Useful for querying "users who haven't completed health setup"
-- Uncomment if you need this for admin/analytics queries:
--
-- CREATE INDEX IF NOT EXISTS idx_profiles_health_setup_pending
-- ON public.profiles(created_at)
-- WHERE health_setup_completed_at IS NULL;