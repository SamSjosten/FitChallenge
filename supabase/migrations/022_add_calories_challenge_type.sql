-- supabase/migrations/022_add_calories_challenge_type.sql
-- =============================================================================
-- Add 'calories' to challenge_type enum
-- =============================================================================
-- This migration extends the challenge_type enum to support calorie-based
-- challenges, enabling HealthKit integration for calorie tracking.
-- =============================================================================

-- Add 'calories' to challenge_type enum
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in some
-- PostgreSQL versions. Supabase handles this correctly.
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'calories';

-- Add comment for documentation
COMMENT ON TYPE challenge_type IS 
  'Challenge activity types: steps, active_minutes, workouts, distance, calories, custom';