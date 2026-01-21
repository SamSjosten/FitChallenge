// src/lib/serverTime.ts
// Server time synchronization to reduce client clock dependence
//
// Problem: Device clocks can drift, causing incorrect challenge status display
// Solution: Fetch server time once at app start, cache the offset, apply to local time
//
// Status tracking: Exposes sync status for UI components to show warnings when
// time sync fails and we're operating on potentially inaccurate device time.

import { useState, useEffect } from "react";
import { getSupabaseClient } from "./supabase";

// =============================================================================
// TYPES
// =============================================================================

export interface ServerTimeSyncStatus {
  /** Whether we've ever successfully synced this session */
  hasSynced: boolean;
  /** Timestamp of last successful sync (null if never synced) */
  lastSyncAt: number | null;
  /** Error message from most recent failure (null if last attempt succeeded) */
  lastError: string | null;
  /** Derived: true if never synced OR cache is older than RESYNC_INTERVAL_MS */
  isStale: boolean;
}

export type SyncStatusListener = (status: ServerTimeSyncStatus) => void;

// =============================================================================
// STATE
// =============================================================================

/** Cached offset in milliseconds: serverTime - deviceTime */
let cachedOffsetMs: number | null = null;

/** Timestamp of last successful sync */
let lastSyncAt: number | null = null;

/** Whether we've ever successfully synced this session */
let hasSynced = false;

/** Error message from most recent failure (cleared on success) */
let lastError: string | null = null;

/** Listeners for status changes */
const statusListeners = new Set<SyncStatusListener>();

// =============================================================================
// CONSTANTS
// =============================================================================

/** How often to re-sync (5 minutes) */
export const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Threshold for logging clock drift warnings (60 seconds) */
const DRIFT_WARNING_THRESHOLD_MS = 60 * 1000;

// =============================================================================
// STATUS MANAGEMENT
// =============================================================================

/**
 * Compute current sync status
 */
export function getSyncStatus(): ServerTimeSyncStatus {
  const now = Date.now();
  const isStale =
    !hasSynced || lastSyncAt === null || now - lastSyncAt > RESYNC_INTERVAL_MS;

  return {
    hasSynced,
    lastSyncAt,
    lastError,
    isStale,
  };
}

/**
 * Subscribe to sync status changes
 * @returns Unsubscribe function
 */
export function subscribeToSyncStatus(
  listener: SyncStatusListener,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Notify all listeners of status change
 */
function notifyStatusListeners(): void {
  const status = getSyncStatus();
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (err) {
      console.warn("[ServerTime] Listener error:", err);
    }
  });
}

// =============================================================================
// SYNC LOGIC
// =============================================================================

/**
 * Sync with server time and cache the offset
 *
 * @param opts.force - If true, sync even if cache is fresh. Default: false
 * @returns true if sync succeeded (or skipped due to fresh cache), false if failed
 */
export async function syncServerTime(opts?: {
  force?: boolean;
}): Promise<boolean> {
  const force = opts?.force ?? false;
  if (!force && !needsResync()) return true;

  try {
    const deviceNowBefore = Date.now();

    const { data, error } = await getSupabaseClient().rpc("get_server_time");

    if (error || !data) {
      const errorMsg = error?.message || "No data returned";
      console.warn("Failed to sync server time:", errorMsg);
      lastError = errorMsg;
      notifyStatusListeners();
      return false;
    }

    const deviceNowAfter = Date.now();
    // Use midpoint to account for network latency
    const deviceNowMid = (deviceNowBefore + deviceNowAfter) / 2;

    // Parse RPC result safely (handle various payload shapes)
    const raw = Array.isArray(data) ? data[0] : data;
    const serverTimeStr =
      typeof raw === "string"
        ? raw
        : typeof raw?.server_time === "string"
          ? raw.server_time
          : typeof raw?.get_server_time === "string"
            ? raw.get_server_time
            : typeof raw?.now === "string"
              ? raw.now
              : null;

    if (!serverTimeStr) {
      const errorMsg = "Unexpected payload shape";
      console.warn("Failed to sync server time:", errorMsg);
      lastError = errorMsg;
      notifyStatusListeners();
      return false;
    }

    const serverNow = new Date(serverTimeStr).getTime();
    if (isNaN(serverNow)) {
      const errorMsg = "Invalid timestamp";
      console.warn("Failed to sync server time:", errorMsg);
      lastError = errorMsg;
      notifyStatusListeners();
      return false;
    }

    // Success - update state
    cachedOffsetMs = serverNow - deviceNowMid;
    lastSyncAt = Date.now();
    hasSynced = true;
    lastError = null;

    // Log significant drift for debugging
    if (Math.abs(cachedOffsetMs) > DRIFT_WARNING_THRESHOLD_MS) {
      console.warn(
        `Device clock drift detected: ${Math.round(cachedOffsetMs / 1000)}s`,
      );
    }

    notifyStatusListeners();
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("Server time sync error:", errorMsg);
    lastError = errorMsg;
    notifyStatusListeners();
    return false;
  }
}

/**
 * Get server-adjusted current time
 * Returns server-adjusted time if synced, otherwise falls back to device time
 */
export function getServerNow(): Date {
  if (cachedOffsetMs === null) {
    // No sync yet - fall back to device time
    return new Date();
  }
  return new Date(Date.now() + cachedOffsetMs);
}

/**
 * Check if a re-sync is needed (stale cache)
 */
export function needsResync(): boolean {
  if (lastSyncAt === null) return true;
  return Date.now() - lastSyncAt > RESYNC_INTERVAL_MS;
}

/**
 * Get the cached offset in milliseconds (for debugging/testing)
 * Returns null if not synced yet
 */
export function getOffsetMs(): number | null {
  return cachedOffsetMs;
}

/**
 * Reset sync state (primarily for testing)
 */
export function resetSyncState(): void {
  cachedOffsetMs = null;
  lastSyncAt = null;
  hasSynced = false;
  lastError = null;
  statusListeners.clear();
}

/**
 * Manually set offset (primarily for testing)
 */
export function setOffsetMs(offsetMs: number): void {
  cachedOffsetMs = offsetMs;
  lastSyncAt = Date.now();
  hasSynced = true;
  lastError = null;
}

// =============================================================================
// TIME CALCULATION HELPERS
// =============================================================================

/**
 * Calculate days remaining until a given end date using server time
 *
 * Uses getServerNow() to ensure consistent time calculations across
 * devices with clock drift.
 *
 * @param endDate - ISO date string or Date object
 * @returns Number of days remaining (0 if already past)
 */
export function getDaysRemaining(endDate: string | Date): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  const now = getServerNow();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// =============================================================================
// REACT HOOK
// =============================================================================

/**
 * React hook to observe server time sync status
 *
 * Use this to show warnings in the UI when time sync fails.
 *
 * @example
 * ```tsx
 * function TimeSyncWarning() {
 *   const { hasSynced, isStale, lastError } = useServerTimeSyncStatus();
 *
 *   // Show warning only if we've never synced and there's an error
 *   if (!hasSynced && lastError) {
 *     return <Banner>Time sync unavailable</Banner>;
 *   }
 *   return null;
 * }
 * ```
 */
export function useServerTimeSyncStatus(): ServerTimeSyncStatus {
  const [status, setStatus] = useState<ServerTimeSyncStatus>(() =>
    getSyncStatus(),
  );

  useEffect(() => {
    // Update immediately in case status changed since initial render
    setStatus(getSyncStatus());

    return subscribeToSyncStatus(setStatus);
  }, []);

  return status;
}
