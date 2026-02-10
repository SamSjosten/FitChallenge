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
 * - ACCEPT_INVITE: Idempotent (update to same value is no-op)
 * - SEND_FRIEND_REQUEST: Idempotent via unique constraint
 */
export type QueuedActionType = "LOG_ACTIVITY" | "ACCEPT_INVITE" | "SEND_FRIEND_REQUEST";

export interface LogActivityPayload {
  challenge_id: string;
  activity_type: string;
  value: number;
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
  | { type: "ACCEPT_INVITE"; payload: AcceptInvitePayload }
  | { type: "SEND_FRIEND_REQUEST"; payload: SendFriendRequestPayload };

export interface QueuedItem {
  id: string;
  action: QueuedAction;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

interface OfflineStoreState {
  queue: QueuedItem[];
  isProcessing: boolean;
  lastProcessedAt: number | null;
}

interface OfflineStoreActions {
  addToQueue: (action: QueuedAction) => string;
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
      addToQueue: (action) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        set((state) => ({
          queue: [...state.queue, { id, action, createdAt: Date.now(), retryCount: 0 }],
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

        // Process in order (FIFO)
        for (const item of [...queue]) {
          try {
            await executeAction(item.action);
            toRemove.push(item.id);
            succeeded++;

            // GUARDRAIL 3: Telemetry for success
            console.log(`[OfflineQueue] Processed ${item.action.type} (${item.id})`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // GUARDRAIL 3: Retry limits
            if (item.retryCount + 1 >= MAX_RETRIES) {
              toRemove.push(item.id);
              failed++;

              // GUARDRAIL 3: Telemetry for failures
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

        // Atomic state update
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
