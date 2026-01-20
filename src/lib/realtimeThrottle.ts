// src/lib/realtimeThrottle.ts
// Throttled query invalidation for realtime subscriptions
// Status observability for realtime connections

import { QueryClient } from "@tanstack/react-query";

// =============================================================================
// REALTIME STATUS STORE
// =============================================================================

/**
 * Realtime connection status types from Supabase
 */
export type RealtimeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

/**
 * Global realtime connection state
 */
export interface RealtimeConnectionState {
  /** Current connection status */
  status: RealtimeStatus | "DISCONNECTED" | "CONNECTING";
  /** Channel name for debugging */
  channelName: string | null;
  /** Last error if any */
  lastError: Error | null;
  /** Timestamp of last status change */
  lastUpdatedAt: Date | null;
}

type RealtimeStatusListener = (state: RealtimeConnectionState) => void;

// Module-level singleton state
let currentState: RealtimeConnectionState = {
  status: "DISCONNECTED",
  channelName: null,
  lastError: null,
  lastUpdatedAt: null,
};

const listeners = new Set<RealtimeStatusListener>();

/**
 * Get current realtime connection status
 */
export function getRealtimeStatus(): RealtimeConnectionState {
  return { ...currentState };
}

/**
 * Subscribe to realtime status changes
 * @returns Unsubscribe function
 */
export function subscribeToRealtimeStatus(
  listener: RealtimeStatusListener,
): () => void {
  listeners.add(listener);
  // Immediately notify with current state
  try {
    listener(getRealtimeStatus());
  } catch (err) {
    console.warn("[Realtime] Status listener error:", err);
  }
  return () => listeners.delete(listener);
}

/**
 * Update realtime status (called internally by subscription hooks)
 */
export function updateRealtimeStatus(
  channelName: string,
  status: RealtimeStatus | "DISCONNECTED" | "CONNECTING",
  error?: Error,
): void {
  currentState = {
    status,
    channelName,
    lastError: error ?? null,
    lastUpdatedAt: new Date(),
  };

  // Notify all listeners
  const state = getRealtimeStatus();
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.warn("[Realtime] Status listener error:", err);
    }
  });
}

/**
 * Reset realtime status (called on cleanup)
 */
export function resetRealtimeStatus(): void {
  updateRealtimeStatus("", "DISCONNECTED");
}

// =============================================================================
// THROTTLED INVALIDATION
// =============================================================================

/**
 * Creates a throttled invalidator that batches rapid invalidations.
 *
 * When multiple changes arrive in quick succession (e.g., burst of activity logs),
 * this prevents hammering React Query with invalidations. Instead, it waits for
 * the burst to settle, then invalidates once.
 *
 * Uses trailing-edge debounce: the invalidation fires `delayMs` after the LAST
 * change in a burst, not after the first.
 *
 * @param queryClient - React Query client instance
 * @param delayMs - Milliseconds to wait after last change before invalidating (default 500)
 * @returns Function to schedule throttled invalidation for a query key
 */
export function createThrottledInvalidator(
  queryClient: QueryClient,
  delayMs: number = 500,
) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  return function throttledInvalidate(queryKey: readonly unknown[]): void {
    const key = JSON.stringify(queryKey);

    // Clear existing pending invalidation for this key
    const existing = pending.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule new invalidation
    const timeoutId = setTimeout(() => {
      pending.delete(key);
      queryClient.invalidateQueries({ queryKey });
    }, delayMs);

    pending.set(key, timeoutId);
  };
}

/**
 * Log realtime connection status changes.
 * Supabase handles reconnection internally with exponential backoff.
 * This provides observability without requiring custom reconnection logic.
 *
 * Also updates the global status store for UI consumption.
 */
export function logRealtimeStatus(
  channelName: string,
  status: RealtimeStatus,
  error?: Error,
): void {
  const timestamp = new Date().toISOString();

  // Update global status store
  updateRealtimeStatus(channelName, status, error);

  // Log for debugging
  switch (status) {
    case "SUBSCRIBED":
      console.log(`[Realtime] ${channelName} connected at ${timestamp}`);
      break;
    case "CHANNEL_ERROR":
      console.warn(
        `[Realtime] ${channelName} error at ${timestamp}:`,
        error?.message || "Unknown error",
      );
      break;
    case "TIMED_OUT":
      console.warn(`[Realtime] ${channelName} timed out at ${timestamp}`);
      break;
    case "CLOSED":
      console.log(`[Realtime] ${channelName} closed at ${timestamp}`);
      break;
  }
}
