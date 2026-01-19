// src/lib/realtimeThrottle.ts
// Throttled query invalidation for realtime subscriptions

import { QueryClient } from "@tanstack/react-query";

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
 * Realtime connection status types from Supabase
 */
export type RealtimeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

/**
 * Log realtime connection status changes.
 * Supabase handles reconnection internally with exponential backoff.
 * This provides observability without requiring custom reconnection logic.
 */
export function logRealtimeStatus(
  channelName: string,
  status: RealtimeStatus,
  error?: Error,
): void {
  const timestamp = new Date().toISOString();

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
