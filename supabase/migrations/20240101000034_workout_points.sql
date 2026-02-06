-- =============================================================================
-- MIGRATION 034: WORKOUT POINTS & TYPE FILTERING
-- =============================================================================
-- Adds scored workout challenges:
--   - workout_type_catalog: server-managed lookup table with multipliers
--   - challenges.allowed_workout_types: creator-configured type filter
--   - activity_logs.metadata: audit trail for points calculation
--   - log_workout() RPC: server-authoritative scoring function
--
-- Formula: points = floor(duration_minutes × type_multiplier)
--
-- Backward compatible: existing workout challenges (allowed_workout_types=NULL)
-- continue to accept all types. Existing log_activity() is unchanged.
--
-- Depends on: migrations 001–033
-- =============================================================================


-- =============================================================================
-- PART 1: WORKOUT TYPE CATALOG (Reference/lookup table)
-- =============================================================================
-- Server-managed — no client writes. Extensible by inserting rows (no schema
-- migration needed to add new workout types).

CREATE TABLE IF NOT EXISTS public.workout_type_catalog (
  workout_type text PRIMARY KEY,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('cardio', 'strength', 'flexibility', 'sports', 'other')),
  multiplier numeric(3,2) NOT NULL DEFAULT 1.0
    CHECK (multiplier > 0 AND multiplier <= 5.0),
  healthkit_identifier text,              -- Maps to HKWorkoutActivityType
  sort_order integer NOT NULL DEFAULT 100, -- For UI display ordering
  is_active boolean NOT NULL DEFAULT true  -- Soft-disable without deleting
);

-- RLS: Global read for authenticated users, no client writes
ALTER TABLE public.workout_type_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workout types are readable by all authenticated users"
ON public.workout_type_catalog FOR SELECT
USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies — managed via migrations or admin only

COMMENT ON TABLE public.workout_type_catalog IS
'Server-managed workout type reference data with intensity multipliers.
Read-only for clients. Extend by inserting rows — no schema migration needed.';


-- =============================================================================
-- PART 2: SEED WORKOUT TYPES (24 types, 4 categories)
-- =============================================================================
-- Multiplier tiers:
--   1.3× High intensity   (HIIT, Running, Swimming, Rowing, Jump Rope, Kickboxing)
--   1.1× Medium-high      (Cycling, Elliptical, Stair Climbing, Hiking, Dance,
--                           Martial Arts, Tennis, Basketball, Soccer)
--   1.0× Standard         (Strength Training, Functional Training, Other)
--   0.9× Low-moderate     (Walking)
--   0.8× Low intensity    (Yoga, Pilates, Core Training)
--   0.7× Recovery         (Stretching, Cooldown)

INSERT INTO public.workout_type_catalog
  (workout_type, display_name, category, multiplier, healthkit_identifier, sort_order)
VALUES
  -- Cardio
  ('running',            'Running',             'cardio',      1.3, 'HKWorkoutActivityTypeRunning',                        10),
  ('walking',            'Walking',             'cardio',      0.9, 'HKWorkoutActivityTypeWalking',                        20),
  ('cycling',            'Cycling',             'cardio',      1.1, 'HKWorkoutActivityTypeCycling',                        30),
  ('swimming',           'Swimming',            'cardio',      1.3, 'HKWorkoutActivityTypeSwimming',                       40),
  ('rowing',             'Rowing',              'cardio',      1.3, 'HKWorkoutActivityTypeRowing',                         50),
  ('elliptical',         'Elliptical',          'cardio',      1.1, 'HKWorkoutActivityTypeElliptical',                     60),
  ('stair_climbing',     'Stair Climbing',      'cardio',      1.1, 'HKWorkoutActivityTypeStairClimbing',                  70),
  ('hiking',             'Hiking',              'cardio',      1.1, 'HKWorkoutActivityTypeHiking',                         80),
  ('dance',              'Dance',               'cardio',      1.1, 'HKWorkoutActivityTypeDance',                          90),
  ('jump_rope',          'Jump Rope',           'cardio',      1.3, 'HKWorkoutActivityTypeJumpRope',                      100),
  -- Strength & Conditioning
  ('strength_training',  'Strength Training',   'strength',    1.0, 'HKWorkoutActivityTypeTraditionalStrengthTraining',   110),
  ('hiit',               'HIIT',                'strength',    1.3, 'HKWorkoutActivityTypeHighIntensityIntervalTraining', 120),
  ('functional_training','Functional Training',  'strength',   1.0, 'HKWorkoutActivityTypeFunctionalStrengthTraining',    130),
  ('core_training',      'Core Training',       'strength',    0.8, 'HKWorkoutActivityTypeCoreTraining',                  140),
  ('kickboxing',         'Kickboxing',          'strength',    1.3, 'HKWorkoutActivityTypeKickboxing',                    150),
  ('martial_arts',       'Martial Arts',        'strength',    1.1, 'HKWorkoutActivityTypeMartialArts',                   160),
  -- Flexibility & Mind/Body
  ('yoga',               'Yoga',                'flexibility', 0.8, 'HKWorkoutActivityTypeYoga',                          170),
  ('pilates',            'Pilates',             'flexibility', 0.8, 'HKWorkoutActivityTypePilates',                       180),
  ('stretching',         'Stretching',          'flexibility', 0.7, 'HKWorkoutActivityTypeFlexibility',                   190),
  ('cooldown',           'Cooldown',            'flexibility', 0.7, 'HKWorkoutActivityTypeCooldown',                      200),
  -- Sports
  ('tennis',             'Tennis',              'sports',      1.1, 'HKWorkoutActivityTypeTennis',                        210),
  ('basketball',         'Basketball',          'sports',      1.1, 'HKWorkoutActivityTypeBasketball',                    220),
  ('soccer',             'Soccer',              'sports',      1.1, 'HKWorkoutActivityTypeSoccer',                        230),
  ('other',              'Other',               'sports',      1.0, 'HKWorkoutActivityTypeOther',                         240)
ON CONFLICT (workout_type) DO NOTHING;


-- =============================================================================
-- PART 3: SCHEMA CHANGES
-- =============================================================================

-- 3a) Add allowed_workout_types to challenges
-- NULL = all types allowed (backward compatible with existing workout challenges)
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS allowed_workout_types text[];

COMMENT ON COLUMN public.challenges.allowed_workout_types IS
'Workout types allowed for this challenge. NULL or empty = all types allowed.
Only meaningful when challenge_type = ''workouts''. Values must match
workout_type_catalog.workout_type keys.';

-- 3b) Add metadata column to activity_logs for workout calculation audit trail
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.activity_logs.metadata IS
'Structured metadata for the activity entry. For workout challenges, stores:
{ workout_type, duration_minutes, multiplier, points }
Preserves audit trail even if multipliers change later.';


-- =============================================================================
-- PART 4: LOG_WORKOUT RPC FUNCTION
-- =============================================================================
-- Separate from log_activity to keep both functions clean:
--   log_activity: simple value-based types (steps, distance, active_minutes, custom)
--   log_workout:  scored workouts (workout_type + duration → points)
--
-- Server-authoritative: clients submit type + duration, server calculates points.
-- Uses floor() not round() to prevent gaming short sessions.

DROP FUNCTION IF EXISTS public.log_workout(uuid, text, integer, timestamptz, text, uuid, text);

CREATE OR REPLACE FUNCTION public.log_workout(
  p_challenge_id uuid,
  p_workout_type text,
  p_duration_minutes integer,
  p_recorded_at timestamptz,
  p_source text,
  p_client_event_id uuid DEFAULT NULL,
  p_source_external_id text DEFAULT NULL
)
RETURNS integer  -- Returns calculated points
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_challenge_status text;
  v_challenge_type text;
  v_allowed_types text[];
  v_multiplier numeric;
  v_points integer;
BEGIN
  -- 0) Validate inputs
  IF p_duration_minutes <= 0 OR p_duration_minutes > 1440 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;

  -- 1) Fetch challenge details in one query
  SELECT c.status, c.challenge_type::text, c.allowed_workout_types
  INTO v_challenge_status, v_challenge_type, v_allowed_types
  FROM public.challenges c
  WHERE c.id = p_challenge_id;

  IF v_challenge_type IS NULL THEN
    RAISE EXCEPTION 'challenge_not_found';
  END IF;

  -- Must be a workouts challenge
  IF v_challenge_type != 'workouts' THEN
    RAISE EXCEPTION 'not_workout_challenge';
  END IF;

  -- Must be active (time-derived check: not archived/completed/cancelled)
  IF v_challenge_status IN ('archived', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'challenge_not_active';
  END IF;

  -- 2) Validate participation (must be accepted)
  IF NOT EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = auth.uid()
      AND cp.invite_status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;

  -- 3) Check workout type is allowed for this challenge
  -- NULL or empty array = all types allowed (backward compatible)
  IF v_allowed_types IS NOT NULL AND array_length(v_allowed_types, 1) > 0 THEN
    IF NOT (p_workout_type = ANY(v_allowed_types)) THEN
      RAISE EXCEPTION 'workout_type_not_allowed';
    END IF;
  END IF;

  -- 4) Look up multiplier from catalog (default 1.0 for unknown types)
  SELECT wtc.multiplier
  INTO v_multiplier
  FROM public.workout_type_catalog wtc
  WHERE wtc.workout_type = p_workout_type
    AND wtc.is_active = true;

  IF v_multiplier IS NULL THEN
    v_multiplier := 1.0;  -- Unknown type gets standard multiplier
  END IF;

  -- 5) Calculate points: floor(duration × multiplier)
  v_points := floor(p_duration_minutes * v_multiplier);

  -- 6) Insert activity log with metadata audit trail
  -- Idempotency enforced by existing unique indexes on client_event_id + source_external_id
  INSERT INTO public.activity_logs (
    challenge_id, user_id, activity_type, value, unit, recorded_at,
    source, client_event_id, source_external_id, metadata
  ) VALUES (
    p_challenge_id, auth.uid(), 'workouts'::challenge_type, v_points,
    'points', p_recorded_at, p_source, p_client_event_id, p_source_external_id,
    jsonb_build_object(
      'workout_type', p_workout_type,
      'duration_minutes', p_duration_minutes,
      'multiplier', v_multiplier,
      'points', v_points
    )
  );

  -- 7) Update aggregated counter atomically
  UPDATE public.challenge_participants
  SET current_progress = current_progress + v_points,
      updated_at = now()
  WHERE challenge_id = p_challenge_id
    AND user_id = auth.uid()
    AND invite_status = 'accepted';

  RETURN v_points;
END;
$$;

ALTER FUNCTION public.log_workout SET search_path = public;

COMMENT ON FUNCTION public.log_workout IS
'Server-authoritative workout scoring function.
Inputs: workout_type + duration_minutes → Output: calculated points.
Formula: floor(duration_minutes × multiplier_from_catalog).
Validates: challenge is workouts type, is active, user is participant,
workout type is in allowed list. Idempotent via client_event_id.
Stores full calculation breakdown in activity_logs.metadata for audit.';


-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- [ ] workout_type_catalog table exists with RLS (global read, no client write)
-- [ ] 24 workout types seeded with correct multipliers and HealthKit identifiers
-- [ ] challenges.allowed_workout_types column exists (nullable text array)
-- [ ] activity_logs.metadata column exists (nullable jsonb)
-- [ ] log_workout validates challenge_type = 'workouts'
-- [ ] log_workout checks workout type against allowed list
-- [ ] log_workout looks up multiplier from catalog (not hardcoded)
-- [ ] log_workout stores calculation breakdown in metadata
-- [ ] log_workout uses floor() not round()
-- [ ] NULL allowed_workout_types = all types allowed (backward compatible)
-- [ ] Existing log_activity function is unchanged
-- [ ] Idempotency preserved (client_event_id + source_external_id)