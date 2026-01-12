// src/services/activities.ts
// Activity logging service - all writes via atomic RPC function

import { supabase, withAuth } from "@/lib/supabase";
import { validate, logActivitySchema } from "@/lib/validation";
import type { ActivityLog, Database } from "@/types/database";

type LogActivityArgs = Database["public"]["Functions"]["log_activity"]["Args"];

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
   * CONTRACT: Server time enforced - client cannot specify recorded_at
   */
  async logActivity(input: unknown): Promise<void> {
    const validated = validate(logActivitySchema, input);

    return withAuth(async () => {
      // Patch 2: Enforce server time for manual activity logs.
      // - Ignore any client-provided recorded_at unless explicitly trusted (manual is NOT trusted).
      // - The database function uses server time (now()) for manual logs.
      // - We intentionally do NOT send p_recorded_at for manual logs.
      const args: LogActivityArgs = {
        p_challenge_id: validated.challenge_id,
        p_activity_type: validated.activity_type,
        p_value: validated.value,
        p_source: "manual",
        p_client_event_id: validated.client_event_id,
        // p_recorded_at intentionally omitted
      };

      const { error } = await supabase.rpc("log_activity", args);

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
   * Extract a safe cursor from an activity log row for pagination.
   * Normalizes and strips fractional seconds to avoid PostgREST `.or()` delimiter conflicts.
   */
  extractCursor(row: ActivityLog): {
    beforeRecordedAt: string;
    beforeId: string;
  } {
    // Normalize to ISO then strip fractional seconds: 2025-01-12T16:47:05.123Z → 2025-01-12T16:47:05Z
    const normalized = new Date(row.recorded_at).toISOString();
    const recordedAt = normalized.replace(/\.\d+Z$/, "Z");
    return {
      beforeRecordedAt: recordedAt,
      beforeId: row.id,
    };
  },

  /**
   * Get all recent activities across all challenges (current user)
   * NOTE: Keeping this user-scoped avoids accidental privacy drift later.
   *
   * Supports stable cursor-based pagination using (recorded_at, id) composite cursor.
   * This ensures no duplicates/skips even when multiple rows share the same timestamp.
   * Orders by occurrence time (recorded_at), not sync time (created_at).
   *
   * @param arg - Either a number (limit, for backwards compatibility) or options object
   * @param arg.limit - Maximum number of activities to return (default 20, max 100)
   * @param arg.beforeRecordedAt - Cursor timestamp: only return activities recorded before this (ISO string, no fractional seconds)
   * @param arg.beforeId - Cursor id: tie-breaker when recorded_at matches (required with beforeRecordedAt)
   */
  async getRecentActivities(
    arg?:
      | number
      | { limit?: number; beforeRecordedAt?: string; beforeId?: string }
  ): Promise<ActivityLog[]> {
    // Backwards compatibility: support (limit?: number) signature
    const options = typeof arg === "number" ? { limit: arg } : arg ?? {};
    const MAX_LIMIT = 100;
    const limit = Math.min(Math.max(1, options.limit ?? 20), MAX_LIMIT);
    const { beforeRecordedAt, beforeId } = options;

    // Validate cursor: both fields required together for stable pagination
    if (beforeRecordedAt && !beforeId) {
      throw new Error("beforeId is required when beforeRecordedAt is provided");
    }
    if (beforeId && !beforeRecordedAt) {
      throw new Error("beforeRecordedAt is required when beforeId is provided");
    }

    // Validate timestamp format: UTC with Z suffix, NO fractional seconds
    // Fractional seconds contain '.' which conflicts with PostgREST .or() delimiters
    if (
      beforeRecordedAt &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(beforeRecordedAt)
    ) {
      throw new Error(
        "beforeRecordedAt must be UTC ISO timestamp without fractional seconds (use extractCursor helper)"
      );
    }

    // Validate UUID format for beforeId
    if (
      beforeId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        beforeId
      )
    ) {
      throw new Error("beforeId must be a valid UUID");
    }

    return withAuth(async (userId) => {
      let query = supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false }) // Tie-breaker for stable ordering
        .limit(limit);

      // Apply composite cursor filter for stable pagination
      // Logic: recorded_at < cursor OR (recorded_at = cursor AND id < cursor_id)
      if (beforeRecordedAt && beforeId) {
        query = query.or(
          `recorded_at.lt.${beforeRecordedAt},and(recorded_at.eq.${beforeRecordedAt},id.lt.${beforeId})`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    });
  },
};
