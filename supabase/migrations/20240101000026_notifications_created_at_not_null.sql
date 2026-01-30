-- 026_notifications_created_at_not_null.sql
-- Fix: Ensure created_at is never null in notifications table
--
-- Background:
--   The column has DEFAULT now() but no NOT NULL constraint.
--   This causes Supabase to generate `created_at: string | null` in TypeScript types.
--   In practice, created_at is never null, but TypeScript doesn't know this.
--
-- This migration:
--   1. Backfills any null values (defensive - shouldn't exist)
--   2. Adds NOT NULL constraint
--
-- After running, regenerate types: npx supabase gen types typescript --local > src/types/database.ts

-- Step 1: Backfill any nulls (defensive)
UPDATE public.notifications
SET created_at = now()
WHERE created_at IS NULL;

-- Step 2: Add NOT NULL constraint
ALTER TABLE public.notifications
ALTER COLUMN created_at SET NOT NULL;