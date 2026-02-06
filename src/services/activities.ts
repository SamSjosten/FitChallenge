// src/services/activities.ts
// Activity logging service - all writes via atomic RPC function
//
// GUARDRAIL 3: Falls back to queue if offline

import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, withAuth } from "@/lib/supabase";
import { validate, logActivitySchema } from "@/lib/validation";
import { checkNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineStore } from "@/stores/offlineStore";
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

/** Result of logActivity indicating whether it was queued for later */
export interface LogActivityResult {
  queued: boolean;
}

/** Result of logWorkout — includes calculated points from server */
export interface LogWorkoutResult {
  queued: boolean;
  points?: number;
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

/**
 * Check if an error is a network-related error worth queuing for retry.
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("enotfound")
  );
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
   *
   * GUARDRAIL 3: Falls back to offline queue if network unavailable
   */
  async logActivity(input: unknown): Promise<LogActivityResult> {
    const validated = validate(logActivitySchema, input);

    // Check network before attempting
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      // Queue for later
      useOfflineStore.getState().addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: validated.challenge_id,
          activity_type: validated.activity_type,
          value: validated.value,
          client_event_id: validated.client_event_id,
        },
      });

      return { queued: true };
    }

    // Online: attempt direct execution
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

      try {
        const { error } = await getSupabaseClient().rpc("log_activity", args);

        if (error) {
          // Idempotency: duplicate key errors are safe to ignore
          if (error.message?.includes("duplicate") || error.code === "23505") {
            console.log("Activity already logged (idempotent)");
            return { queued: false };
          }
          throw error;
        }

        return { queued: false };
      } catch (error) {
        // Network error during request - queue it
        if (isNetworkError(error)) {
          useOfflineStore.getState().addToQueue({
            type: "LOG_ACTIVITY",
            payload: {
              challenge_id: validated.challenge_id,
              activity_type: validated.activity_type,
              value: validated.value,
              client_event_id: validated.client_event_id,
            },
          });

          return { queued: true };
        }

        throw error;
      }
    });
  },

  /**
   * Log a workout for a challenge (workout points system)
   * CONTRACT: Uses atomic log_workout database function
   * CONTRACT: Server calculates points (duration × multiplier)
   * CONTRACT: Returns calculated points on success
   */
  async logWorkout(input: {
    challenge_id: string;
    workout_type: string;
    duration_minutes: number;
    client_event_id: string;
  }): Promise<LogWorkoutResult> {
    // Check network before attempting
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      // Queue for later — store as LOG_ACTIVITY with workout-derived values
      useOfflineStore.getState().addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: input.challenge_id,
          activity_type: "workouts",
          value: input.duration_minutes, // Rough estimate; server recalculates
          client_event_id: input.client_event_id,
        },
      });

      return { queued: true };
    }

    // Online: call atomic RPC
    return withAuth(async () => {
      try {
        const { data, error } = await (getSupabaseClient().rpc as Function)(
          "log_workout",
          {
            p_challenge_id: input.challenge_id,
            p_workout_type: input.workout_type,
            p_duration_minutes: input.duration_minutes,
            p_recorded_at: new Date().toISOString(),
            p_source: "manual",
            p_client_event_id: input.client_event_id,
          },
        );

        if (error) {
          // Idempotency: duplicate key errors are safe to ignore
          if (error.message?.includes("duplicate") || error.code === "23505") {
            console.log("Workout already logged (idempotent)");
            return { queued: false, points: 0 };
          }
          throw error;
        }

        // log_workout returns integer (calculated points)
        return { queued: false, points: typeof data === "number" ? data : 0 };
      } catch (error) {
        // Network error during request - queue it
        if (isNetworkError(error)) {
          useOfflineStore.getState().addToQueue({
            type: "LOG_ACTIVITY",
            payload: {
              challenge_id: input.challenge_id,
              activity_type: "workouts",
              value: input.duration_minutes,
              client_event_id: input.client_event_id,
            },
          });

          return { queued: true };
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
    limit = 50,
  ): Promise<ActivityLog[]> {
    return withAuth(async (userId) => {
      const { data, error } = await getSupabaseClient()
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
    challengeId: string,
  ): Promise<ActivitySummary> {
    return withAuth(async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "get_activity_summary",
        {
          p_challenge_id: challengeId,
        },
      );

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
   * Extract a cursor from an activity log row for pagination.
   * Preserves full timestamp precision (including fractional seconds) to avoid skipping rows.
   *
   * IMPORTANT: Uses the timestamp string directly from PostgreSQL to preserve
   * microsecond precision (6 decimal places). Do NOT round-trip through JavaScript
   * Date which only has millisecond precision (3 decimal places).
   *
   * Note: PostgREST .or() uses commas as delimiters, not periods, so fractional
   * seconds in timestamps (e.g., "16:47:05.123456Z") are safely parsed as values.
   */
  extractCursor(row: ActivityLog): {
    beforeRecordedAt: string;
    beforeId: string;
  } {
    // Use timestamp directly from PostgreSQL to preserve microsecond precision
    // PostgreSQL timestamptz has 6 decimal places; JS Date only has 3
    return {
      beforeRecordedAt: row.recorded_at,
      beforeId: row.id,
    };
  },

  /**
   * Get recent activities for the current user, optionally filtered by challenge.
   * NOTE: Keeping this user-scoped avoids accidental privacy drift later.
   *
   * Supports stable cursor-based pagination using (recorded_at, id) composite cursor.
   * This ensures no duplicates/skips even when multiple rows share the same timestamp.
   * Orders by occurrence time (recorded_at), not sync time (created_at).
   *
   * @param arg - Either a number (limit, for backwards compatibility) or options object
   * @param arg.limit - Maximum number of activities to return (default 20, max 100)
   * @param arg.challengeId - Optional challenge ID to filter activities
   * @param arg.beforeRecordedAt - Cursor timestamp: only return activities recorded before this (ISO string)
   * @param arg.beforeId - Cursor id: tie-breaker when recorded_at matches (required with beforeRecordedAt)
   * @param arg.client - Optional Supabase client for testing (must be authenticated)
   */
  async getRecentActivities(
    arg?:
      | number
      | {
          limit?: number;
          challengeId?: string;
          beforeRecordedAt?: string;
          beforeId?: string;
          client?: SupabaseClient<Database>;
        },
  ): Promise<ActivityLog[]> {
    // Backwards compatibility: support (limit?: number) signature
    const options = typeof arg === "number" ? { limit: arg } : (arg ?? {});
    const MAX_LIMIT = 100;
    const limit = Math.min(Math.max(1, options.limit ?? 20), MAX_LIMIT);
    const {
      challengeId,
      beforeRecordedAt,
      beforeId,
      client: injectedClient,
    } = options;

    // Validate cursor: both fields required together for stable pagination
    if (beforeRecordedAt && !beforeId) {
      throw new Error("beforeId is required when beforeRecordedAt is provided");
    }
    if (beforeId && !beforeRecordedAt) {
      throw new Error("beforeRecordedAt is required when beforeId is provided");
    }

    // Validate timestamp format: ISO 8601 UTC with optional fractional seconds
    // PostgreSQL returns up to 6 decimal places (microseconds); accept 1-6
    // PostgreSQL uses +00:00 suffix; JS Date.toISOString() uses Z - accept both
    // PostgREST .or() uses commas as delimiters, so periods in timestamps are safe
    if (
      beforeRecordedAt &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/.test(
        beforeRecordedAt,
      )
    ) {
      throw new Error(
        "beforeRecordedAt must be UTC ISO timestamp (use extractCursor helper)",
      );
    }

    // Validate UUID format for beforeId
    if (
      beforeId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        beforeId,
      )
    ) {
      throw new Error("beforeId must be a valid UUID");
    }

    // Query builder - shared between injected and default client paths
    const executeQuery = async (
      userId: string,
      queryClient: SupabaseClient<Database>,
    ): Promise<ActivityLog[]> => {
      let query = queryClient
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false }) // Tie-breaker for stable ordering
        .limit(limit);

      // Optional challenge filter
      if (challengeId) {
        query = query.eq("challenge_id", challengeId);
      }

      // Apply composite cursor filter for stable pagination
      // Logic: recorded_at < cursor OR (recorded_at = cursor AND id < cursor_id)
      if (beforeRecordedAt && beforeId) {
        query = query.or(
          `recorded_at.lt.${beforeRecordedAt},and(recorded_at.eq.${beforeRecordedAt},id.lt.${beforeId})`,
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    };

    // If client is injected (for testing), use it directly
    if (injectedClient) {
      const {
        data: { user },
      } = await injectedClient.auth.getUser();
      if (!user) throw new Error("Authentication required");
      return executeQuery(user.id, injectedClient);
    }

    // Default: use singleton client with withAuth
    return withAuth(async (userId) => {
      return executeQuery(userId, getSupabaseClient());
    });
  },
};
