// src/services/activities.ts
// Activity logging service - all writes via atomic RPC function

import { supabase, withAuth } from "@/lib/supabase";
import { validate, logActivitySchema } from "@/lib/validation";
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
// HELPERS
// =============================================================================

/**
 * Coerce Postgres numeric-ish values safely into a JS number.
 * Supabase/PostgREST may return bigint as string.
 */
function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

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

    return withAuth(async () => {
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
        if (error.message?.includes("duplicate") || error.code === "23505") {
          console.log("Activity already logged (idempotent)");
          return;
        }
        throw error;
      }
    });
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
   * CONTRACT: Uses server-side aggregation via RPC (O(1) data transfer)
   * CONTRACT: RLS enforced in function - only returns current user's data
   */
  async getChallengeActivitySummary(
    challengeId: string
  ): Promise<ActivitySummary> {
    return withAuth(async () => {
      const { data, error } = await supabase.rpc("get_activity_summary", {
        p_challenge_id: challengeId,
      });

      if (error) throw error;

      // RPC returns array with single row
      const row = Array.isArray(data) ? data[0] : data;

      return {
        total_value: toNumber(row?.total_value, 0),
        count: toNumber(row?.count, 0),
        last_recorded_at: row?.last_recorded_at ?? null,
      };
    });
  },

  /**
   * Get all recent activities across all challenges (current user)
   * NOTE: Keeping this user-scoped avoids accidental privacy drift later.
   */
  async getRecentActivities(limit = 20): Promise<ActivityLog[]> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    });
  },
};
