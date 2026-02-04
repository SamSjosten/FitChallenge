-- migrations/032_streak_tracking.sql
-- =============================================================================
-- STREAK TRACKING
-- =============================================================================
--
-- Updates current_streak when activity is logged.
--
-- Rules:
--   - Old data (before last_activity_date): ignored
--   - Same day: ignored  
--   - Consecutive day: increment
--   - Gap: reset to 1
--
-- Client handles decay display (streak = 0 if last_activity > 1 day ago)
--
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_update_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_date date := (NEW.recorded_at AT TIME ZONE 'UTC')::date;
  v_last date;
  v_streak integer;
BEGIN
  SELECT last_activity_date, COALESCE(current_streak, 0)
  INTO v_last, v_streak
  FROM profiles WHERE id = NEW.user_id;
  
  -- Old data or same day: no change
  IF v_last IS NOT NULL AND v_activity_date <= v_last THEN
    RETURN NEW;
  END IF;
  
  -- Consecutive day: increment. Otherwise: reset to 1
  IF v_last IS NOT NULL AND v_activity_date = v_last + 1 THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;
  
  UPDATE profiles
  SET current_streak = v_streak,
      longest_streak = GREATEST(COALESCE(longest_streak, 0), v_streak),
      last_activity_date = v_activity_date,
      updated_at = now()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_streak ON activity_logs;
CREATE TRIGGER trg_update_streak
  AFTER INSERT ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_streak();