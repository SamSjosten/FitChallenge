// src/services/activities.ts
// Activity logging service - all writes via atomic RPC function

import { supabase, withAuth } from "@/lib/supabase";
import {
  validate,
  logActivitySchema,
  LogActivityInput,
} from "@/lib/validation";
import type { ActivityLog } from "@/types/database";

// =============================================================================
// TYPES
// =============================================================================

export interface ActivitySummary {
  total_value: number;
  count: number;
  last_recorded_at: string | null;
}

// Re-export generateClientEventId for backward compatibility
// (callers can import from '@/services/activities' or '@/lib/uuid')
export { generateClientEventId } from "@/lib/uuid";

// =============================================================================
// SERVICE
// =============================================================================

export const activityService = {
  /**
   * Log activity for a challenge
   *
   * CONTRACT: Uses atomic log_activity database function
   * CONTRACT: Must include client_event_id for idempotency
   * CONTRACT: Function handles insert + aggregation atomically
   */
  async logActivity(input: unknown): Promise<void> {
    const validated = validate(logActivitySchema, input);

    const { error } = await supabase.rpc("log_activity", {
      p_challenge_id: validated.challenge_id,
      p_activity_type: validated.activity_type,
      p_value: validated.value,
      p_recorded_at: validated.recorded_at || new Date().toISOString(),
      p_source: "manual",
      p_client_event_id: validated.client_event_id,
    });

    if (error) {
      // Idempotency: duplicate key errors are safe to ignore
      if (error.message.includes("duplicate") || error.code === "23505") {
        console.log("Activity already logged (idempotent)");
        return;
      }
      throw error;
    }
  },

  /**
   * Get activity history for a challenge
   * CONTRACT: Only self-activities visible via RLS
   */
  async getChallengeActivities(
    challengeId: string,
    limit = 50
  ): Promise<ActivityLog[]> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  },

  /**
   * Get activity summary for a challenge
   */
  async getChallengeActivitySummary(
    challengeId: string
  ): Promise<ActivitySummary> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("value, recorded_at")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId);

      if (error) throw error;

      const logs = data || [];
      return {
        total_value: logs.reduce((sum, log) => sum + log.value, 0),
        count: logs.length,
        last_recorded_at:
          logs.length > 0
            ? logs.sort(
                (a, b) =>
                  new Date(b.recorded_at).getTime() -
                  new Date(a.recorded_at).getTime()
              )[0].recorded_at
            : null,
      };
    });
  },

  /**
   * Get all recent activities across all challenges
   */
  async getRecentActivities(limit = 20): Promise<ActivityLog[]> {
    return withAuth(async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  },
};
