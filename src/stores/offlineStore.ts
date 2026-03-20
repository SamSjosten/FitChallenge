// src/stores/offlineStore.ts
// Offline write queue with Zustand persistence
//
// GUARDRAIL 3: Queue only idempotent actions
// GUARDRAIL 3: withAuth() at execution time, not queue time
// GUARDRAIL 3: Retry limits and backoff
// GUARDRAIL 6: No tokens in logs

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabaseClient, requireUserId } from "@/lib/supabase";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Actions that can be queued for offline execution.
 *
 * GUARDRAIL 3: Only idempotent actions are queued.
 * - LOG_ACTIVITY: Idempotent via client_event_id unique constraint
 * - LOG_WORKOUT: Idempotent via client_event_id unique constraint (workout points path)
 * - ACCEPT_INVITE: Idempotent (update to same value is no-op)
 * - SEND_FRIEND_REQUEST: Idempotent via unique constraint
 */
export type QueuedActionType = "LOG_ACTIVITY" | "LOG_WORKOUT" | "ACCEPT_INVITE" | "SEND_FRIEND_REQUEST";

export interface LogActivityPayload {
  challenge_id: string;
  activity_type: string;
  value: number;
  client_event_id: string; // Required for idempotency
}

export interface LogWorkoutPayload {
  challenge_id: string;
  workout_type: string;
  duration_minutes: number;
  client_event_id: string; // Required for idempotency
}

export interface AcceptInvitePayload {
  challenge_id: string;
}

export interface SendFriendRequestPayload {
  target_user_id: string;
}

export type QueuedAction =
  | { type: "LOG_ACTIVITY"; payload: LogActivityPayload }
  | { type: "LOG_WORKOUT"; payload: LogWorkoutPayload }
  | { type: "ACCEPT_INVITE"; payload: AcceptInvitePayload }
  | { type: "SEND_FRIEND_REQUEST"; payload: SendFriendRequestPayload };

export interface QueuedItem {
  id: string;
  action: QueuedAction;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  /** User ID captured at enqueue time. Used to prevent cross-account replay. */
  queuedByUserId?: string;
}

interface OfflineStoreState {
  queue: QueuedItem[];
  isProcessing: boolean;
  lastProcessedAt: number | null;
}

interface OfflineStoreActions {
  addToQueue: (action: QueuedAction, queuedByUserId?: string) => string;
  removeFromQueue: (id: string) => void;
  processQueue: () => Promise<ProcessQueueResult>;
  clearQueue: () => void;
  getQueueLength: () => number;
}

export interface ProcessQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_RETRIES = 5;
const STORE_KEY = "fitchallenge-offline-queue";

// =============================================================================
// AUTH ERROR DETECTION
// =============================================================================

/**
 * Check if an error indicates an authentication or authorization failure.
 *
 * Auth/authz errors are non-retryable — the user's session is invalid or
 * RLS denies access, and retrying will produce the same failure. Items
 * hitting this path are removed immediately instead of burning through
 * MAX_RETRIES.
 *
 * Intentionally covers both 401 (authentication) and 403 (authorization/RLS)
 * since neither is recoverable by retrying. A 403 from RLS means the row-level
 * policy rejected the operation — this won't change on retry.
 *
 * Patterns sourced from:
 *   - src/lib/queryRetry.ts (NON_RETRYABLE_CODES, NON_RETRYABLE_PATTERNS)
 *   - src/lib/sentry.ts (IGNORED_ERROR_PATTERNS)
 */
function isAuthError(error: unknown): boolean {
  // Extract structured fields (Supabase/PostgREST errors)
  const err = error as Record<string, unknown> | null;
  const code = typeof err?.code === "string" ? err.code : "";
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.statusCode === "number"
        ? err.statusCode
        : 0;
  const message =
    error instanceof Error
      ? error.message
      : typeof err?.message === "string"
        ? err.message
        : String(error);

  // PostgREST JWT error codes
  if (code === "PGRST301" || code === "PGRST302") return true;

  // HTTP 401 Unauthorized / 403 Forbidden
  if (status === 401 || status === 403) return true;

  // Message patterns (case-insensitive)
  if (/jwt expired/i.test(message)) return true;
  if (/jwt invalid/i.test(message)) return true;
  if (/authentication required/i.test(message)) return true;
  if (/not authenticated/i.test(message)) return true;
  if (/invalid.*token/i.test(message)) return true;
  if (/permission denied/i.test(message)) return true;
  if (/insufficient.privilege/i.test(message)) return true;

  return false;
}

// =============================================================================
// ACTION EXECUTOR
// =============================================================================

/**
 * Execute a queued action.
 *
 * GUARDRAIL 3: Uses withAuth()/requireUserId() at execution time
 * GUARDRAIL 3: Handles idempotency (duplicate key = success)
 * GUARDRAIL 6: No tokens logged, only action types and IDs
 */
async function executeAction(action: QueuedAction): Promise<void> {
  const supabase = getSupabaseClient();

  switch (action.type) {
    case "LOG_ACTIVITY": {
      const { challenge_id, activity_type, value, client_event_id } = action.payload;

      // GUARDRAIL 3: Auth check at execution time
      await requireUserId();

      const { error } = await supabase.rpc("log_activity", {
        p_challenge_id: challenge_id,
        p_activity_type: activity_type,
        p_value: value,
        p_source: "manual",
        p_client_event_id: client_event_id,
      });

      // Idempotency: duplicate key is success
      if (error && !error.message?.includes("duplicate") && error.code !== "23505") {
        throw error;
      }
      break;
    }

    case "LOG_WORKOUT": {
      const { challenge_id, workout_type, duration_minutes, client_event_id } = action.payload;

      // GUARDRAIL 3: Auth check at execution time
      await requireUserId();

      const { error } = await (supabase.rpc as Function)("log_workout", {
        p_challenge_id: challenge_id,
        p_workout_type: workout_type,
        p_duration_minutes: duration_minutes,
        // Server-synced time would be ideal here, but offlineStore intentionally
        // avoids importing from serverTime to keep dependencies minimal.
        // The long-term fix is enforcing server time inside log_workout itself.
        p_recorded_at: new Date().toISOString(),
        p_source: "manual",
        p_client_event_id: client_event_id,
      });

      // Idempotency: duplicate key is success
      if (error && !error.message?.includes("duplicate") && error.code !== "23505") {
        throw error;
      }
      break;
    }

    case "ACCEPT_INVITE": {
      const userId = await requireUserId();

      const { error } = await supabase
        .from("challenge_participants")
        .update({ invite_status: "accepted" })
        .eq("challenge_id", action.payload.challenge_id)
        .eq("user_id", userId);

      if (error) throw error;
      break;
    }

    case "SEND_FRIEND_REQUEST": {
      const userId = await requireUserId();

      const { error } = await supabase.from("friends").insert({
        requested_by: userId,
        requested_to: action.payload.target_user_id,
        status: "pending",
      });

      // Idempotency: duplicate is success
      if (error && error.code !== "23505") throw error;
      break;
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown action type: ${(_exhaustive as QueuedAction).type}`);
    }
  }
}

// =============================================================================
// STORE
// =============================================================================

export const useOfflineStore = create<OfflineStoreState & OfflineStoreActions>()(
  persist(
    (set, get) => ({
      // State
      queue: [],
      isProcessing: false,
      lastProcessedAt: null,

      // Actions
      addToQueue: (action, queuedByUserId) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        set((state) => ({
          queue: [
            ...state.queue,
            {
              id,
              action,
              createdAt: Date.now(),
              retryCount: 0,
              ...(queuedByUserId ? { queuedByUserId } : {}),
            },
          ],
        }));

        // GUARDRAIL 3: Telemetry for queue depth
        console.log(`[OfflineQueue] Added ${action.type}, queue depth: ${get().queue.length}`);

        return id;
      },

      removeFromQueue: (id) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        }));
      },

      processQueue: async () => {
        const { queue, isProcessing } = get();

        if (isProcessing) {
          return {
            processed: 0,
            succeeded: 0,
            failed: 0,
            remaining: queue.length,
          };
        }

        if (queue.length === 0) {
          return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };
        }

        set({ isProcessing: true });

        let succeeded = 0;
        let failed = 0;
        const toRemove: string[] = [];
        const toUpdate: QueuedItem[] = [];

        try {
          // C3: Resolve current user once for cross-account guard.
          // If not authenticated, defer processing — items remain queued.
          let currentUserId: string;
          try {
            currentUserId = await requireUserId();
          } catch {
            console.warn(
              "[OfflineQueue] Not authenticated — deferring queue processing",
            );
            return {
              processed: 0,
              succeeded: 0,
              failed: 0,
              remaining: queue.length,
            };
          }

          // Process in order (FIFO)
          for (const item of [...queue]) {
            try {
              // C3: Cross-account guard — drop items queued by a different user.
              // Items without queuedByUserId (legacy persisted) skip this check.
              if (
                item.queuedByUserId &&
                item.queuedByUserId !== currentUserId
              ) {
                toRemove.push(item.id);
                failed++;

                // GUARDRAIL 6: Only log truncated user ID prefixes
                console.error(
                  `[OfflineQueue] User mismatch — dropping:`,
                  item.action.type,
                  item.id,
                  `(queued by ${item.queuedByUserId.substring(0, 8)}, current ${currentUserId.substring(0, 8)})`,
                );
                continue;
              }

              await executeAction(item.action);
              toRemove.push(item.id);
              succeeded++;

              // GUARDRAIL 3: Telemetry for success
              console.log(
                `[OfflineQueue] Processed ${item.action.type} (${item.id})`,
              );
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              // C3: Auth/authz errors are non-retryable — drop immediately
              // instead of burning through MAX_RETRIES with identical failures.
              if (isAuthError(error)) {
                toRemove.push(item.id);
                failed++;

                // GUARDRAIL 6: No tokens in logs
                console.error(
                  `[OfflineQueue] Auth error — dropping immediately:`,
                  item.action.type,
                  item.id,
                  errorMessage.substring(0, 100),
                );
              } else if (item.retryCount + 1 >= MAX_RETRIES) {
                // GUARDRAIL 3: Retry limits (transient errors only)
                toRemove.push(item.id);
                failed++;

                // GUARDRAIL 6: Don't log full error which might contain tokens
                console.error(
                  `[OfflineQueue] Failed permanently after ${MAX_RETRIES} retries:`,
                  item.action.type,
                  item.id,
                  errorMessage.substring(0, 100),
                );
              } else {
                toUpdate.push({
                  ...item,
                  retryCount: item.retryCount + 1,
                  lastError: errorMessage.substring(0, 200),
                });
                failed++;

                console.warn(
                  `[OfflineQueue] Retry ${item.retryCount + 1}/${MAX_RETRIES}:`,
                  item.action.type,
                  item.id,
                );
              }
            }
          }
        } finally {
          // HARDENING: Always apply collected changes and reset isProcessing,
          // even if an unexpected error escapes the per-item catch.
          set((state) => ({
            queue: state.queue
              .filter((item) => !toRemove.includes(item.id))
              .map((item) => {
                const updated = toUpdate.find((u) => u.id === item.id);
                return updated ?? item;
              }),
            isProcessing: false,
            lastProcessedAt: Date.now(),
          }));
        }

        const result: ProcessQueueResult = {
          processed: succeeded + failed,
          succeeded,
          failed,
          remaining: get().queue.length,
        };

        // GUARDRAIL 3: Telemetry summary
        console.log(`[OfflineQueue] Process complete:`, result);

        return result;
      },

      clearQueue: () => {
        const previousLength = get().queue.length;
        set({ queue: [], lastProcessedAt: null });
        console.log(`[OfflineQueue] Cleared ${previousLength} items`);
      },

      getQueueLength: () => get().queue.length,
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as OfflineStoreState;
        if (version === 0) {
          // v0 → v1: Rewrite legacy workout-shaped LOG_ACTIVITY items to LOG_WORKOUT.
          // Legacy items had {type: "LOG_ACTIVITY", payload: {workout_type, duration_minutes, ...}}
          state.queue = (state.queue ?? []).map((item) => {
            if (
              item.action.type === "LOG_ACTIVITY" &&
              "workout_type" in item.action.payload &&
              "duration_minutes" in item.action.payload
            ) {
              const legacy = item.action.payload as Record<string, unknown>;
              return {
                ...item,
                action: {
                  type: "LOG_WORKOUT" as const,
                  payload: {
                    challenge_id: item.action.payload.challenge_id,
                    workout_type: String(legacy.workout_type),
                    duration_minutes: Number(legacy.duration_minutes),
                    client_event_id: item.action.payload.client_event_id,
                  },
                },
              };
            }
            return item;
          });
        }
        return state;
      },
      // Only persist queue and lastProcessedAt, not isProcessing
      partialize: (state) => ({
        queue: state.queue,
        lastProcessedAt: state.lastProcessedAt,
      }),
    },
  ),
);

// =============================================================================
// SELECTORS (for use outside React)
// =============================================================================

export const offlineStoreSelectors = {
  getQueueLength: () => useOfflineStore.getState().queue.length,
  isProcessing: () => useOfflineStore.getState().isProcessing,
  processQueue: () => useOfflineStore.getState().processQueue(),
};
