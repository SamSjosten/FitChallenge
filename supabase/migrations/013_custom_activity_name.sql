-- migrations/013_custom_activity_name.sql
-- Add custom_activity_name column to challenges table for custom challenge types

-- =============================================================================
-- ADD CUSTOM ACTIVITY NAME COLUMN
-- =============================================================================
-- When challenge_type = 'custom', this stores the user-defined activity name
-- (e.g., "Meditation", "Water intake", "Yoga sessions")

ALTER TABLE public.challenges
ADD COLUMN custom_activity_name text;

-- Add comment for documentation
COMMENT ON COLUMN public.challenges.custom_activity_name IS 
  'User-defined activity name for custom challenge types. NULL for standard types.';

-- =============================================================================
-- DATA INTEGRITY CONSTRAINT
-- =============================================================================
-- Ensure custom challenges have a name, and non-custom challenges don't have one

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_custom_activity_name_check CHECK (
  (challenge_type = 'custom' AND custom_activity_name IS NOT NULL AND length(trim(custom_activity_name)) >= 2)
  OR
  (challenge_type != 'custom' AND custom_activity_name IS NULL)
);