// src/services/health/schemas.ts
// Zod schemas for validating health RPC responses.
// Prevents silent type drift when the server shape changes.

import { z } from "zod";

/**
 * Schema for get_health_connection RPC response.
 */
export const healthConnectionSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  connected_at: z.string(),
  last_sync_at: z.string().nullable(),
  permissions_granted: z.array(z.string()),
  is_active: z.boolean(),
});

/**
 * Schema for health_sync_logs table rows.
 */
export const healthSyncLogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.enum(["healthkit", "googlefit"]),
  sync_type: z.enum(["background", "manual", "initial"]),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  status: z.enum(["in_progress", "completed", "failed", "partial"]),
  records_processed: z.number(),
  records_inserted: z.number(),
  records_deduplicated: z.number(),
  error_message: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable().transform((v) => v ?? {}),
});

/**
 * Schema for get_challenges_for_health_sync RPC response rows.
 */
export const challengeForSyncSchema = z.object({
  challenge_id: z.string().uuid(),
  challenge_type: z.enum(["steps", "active_minutes", "workouts", "distance", "custom", "calories"]),
  start_date: z.string(),
  end_date: z.string(),
  workout_activity_filter: z.array(z.string()).nullable().optional(),
});

/**
 * Schema for log_health_activity RPC response.
 */
export const logHealthActivityResultSchema = z.object({
  inserted: z.number(),
  deduplicated: z.number(),
  total_processed: z.number(),
  errors: z.array(
    z.object({
      source_external_id: z.string().optional(),
      error: z.string(),
      details: z.string().optional(),
    }),
  ),
});

/**
 * Schema for get_recent_health_activities RPC response rows.
 */
export const recentHealthActivitySchema = z.object({
  id: z.string().uuid(),
  activity_type: z.enum(["steps", "active_minutes", "workouts", "distance", "custom", "calories"]),
  value: z.number(),
  unit: z.string(),
  source: z.string(),
  recorded_at: z.string(),
  challenge_id: z.string(),
  challenge_title: z.string(),
});
