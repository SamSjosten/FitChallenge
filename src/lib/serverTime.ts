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
  const isStale = !hasSynced || lastSyncAt === null || now - lastSyncAt > RESYNC_INTERVAL_MS;

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
export function subscribeToSyncStatus(listener: SyncStatusListener): () => void {
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
export async function syncServerTime(opts?: { force?: boolean }): Promise<boolean> {
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
      console.warn(`Device clock drift detected: ${Math.round(cachedOffsetMs / 1000)}s`);
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
 * Time units in milliseconds for calculations
 */
const MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * Calculate days remaining until a given end date using server time
 *
 * Uses getServerNow() to ensure consistent time calculations across
 * devices with clock drift.
 *
 * NOTE: Uses Math.ceil so partial days count as 1 day remaining.
 * For display purposes, use formatTimeRemaining() instead.
 *
 * @param endDate - ISO date string or Date object
 * @returns Number of days remaining (0 if already past)
 */
export function getDaysRemaining(endDate: string | Date): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  const now = getServerNow();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / MS.DAY);
  return Math.max(0, diffDays);
}

/**
 * Format time remaining until a future date with smart granularity
 *
 * Returns human-readable strings like:
 * - "Starting now" (< 1 minute)
 * - "5 min" (< 1 hour)
 * - "2 hours" (< 24 hours)
 * - "Tomorrow" (24-48 hours)
 * - "3 days" (48+ hours)
 *
 * @param targetDate - ISO date string or Date object (future)
 * @param options - Formatting options
 * @returns Formatted string
 *
 * @example
 * formatTimeUntil(challenge.start_date)
 * // => "Starting now" | "45 min" | "3 hours" | "Tomorrow" | "5 days"
 *
 * formatTimeUntil(challenge.start_date, { prefix: "Starts" })
 * // => "Starts now" | "Starts in 45 min" | "Starts in 3 hours" | "Starts tomorrow" | "Starts in 5 days"
 */
export function formatTimeUntil(
  targetDate: string | Date,
  options?: {
    /** Prefix for the result (e.g., "Starts", "Ends") */
    prefix?: string;
    /** Use "now" threshold in ms (default: 60000 = 1 min) */
    nowThresholdMs?: number;
  },
): string {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const now = getServerNow();
  const diffMs = target.getTime() - now.getTime();

  const prefix = options?.prefix;
  const nowThreshold = options?.nowThresholdMs ?? MS.MINUTE;

  // Already passed or imminent
  if (diffMs <= nowThreshold) {
    return prefix ? `${prefix} now` : "Starting now";
  }

  const diffMinutes = diffMs / MS.MINUTE;
  const diffHours = diffMs / MS.HOUR;
  const diffDays = diffMs / MS.DAY;

  // Less than 1 hour - show minutes
  if (diffMinutes < 60) {
    const mins = Math.round(diffMinutes);
    // Handle edge case: 59.5 min rounds to 60, show "1 hour" instead
    if (mins >= 60) {
      return prefix ? `${prefix} in 1 hour` : "1 hour";
    }
    return prefix ? `${prefix} in ${mins} min` : `${mins} min`;
  }

  // Less than 24 hours - show hours
  if (diffHours < 24) {
    const hours = Math.round(diffHours);
    // Handle edge case: 23.5 hours rounds to 24, show "Tomorrow" instead
    if (hours >= 24) {
      return prefix ? `${prefix} tomorrow` : "Tomorrow";
    }
    const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
    return prefix ? `${prefix} in ${hourText}` : hourText;
  }

  // 24-48 hours - "Tomorrow"
  if (diffDays < 2) {
    return prefix ? `${prefix} tomorrow` : "Tomorrow";
  }

  // 2+ days - use floor to avoid rounding up
  const days = Math.floor(diffDays);
  const dayText = `${days} days`;
  return prefix ? `${prefix} in ${dayText}` : dayText;
}

/**
 * Format time remaining with context-appropriate phrasing
 *
 * Convenience wrappers around formatTimeUntil for common use cases.
 */
export const formatStartsIn = (startDate: string | Date): string =>
  formatTimeUntil(startDate, { prefix: "Starts" });

export const formatEndsIn = (endDate: string | Date): string =>
  formatTimeUntil(endDate, { prefix: "Ends" });

/**
 * Format how long ago something happened with smart granularity
 *
 * Returns human-readable strings like:
 * - "Just now" (< 1 minute)
 * - "5m ago" (< 1 hour)
 * - "2h ago" (< 24 hours)
 * - "Yesterday" (24-48 hours)
 * - "3d ago" (2-7 days)
 * - Formatted date (7+ days)
 *
 * @param pastDate - ISO date string or Date object (past)
 * @param options - Formatting options
 * @returns Formatted string
 *
 * @example
 * formatTimeAgo(activity.recorded_at)
 * // => "Just now" | "5m ago" | "2h ago" | "Yesterday" | "3d ago" | "Jan 15"
 */
export function formatTimeAgo(
  pastDate: string | Date,
  options?: {
    /** Use server time instead of device time (default: true) */
    useServerTime?: boolean;
    /** Threshold for "just now" in ms (default: 60000 = 1 min) */
    justNowThresholdMs?: number;
  },
): string {
  const date = typeof pastDate === "string" ? new Date(pastDate) : pastDate;
  const useServerTime = options?.useServerTime ?? true;
  const now = useServerTime ? getServerNow() : new Date();
  const justNowThreshold = options?.justNowThresholdMs ?? MS.MINUTE;

  const diffMs = now.getTime() - date.getTime();

  // Future date (shouldn't happen, but handle gracefully)
  if (diffMs < 0) {
    return "Just now";
  }

  // Less than threshold - "Just now"
  if (diffMs < justNowThreshold) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffMs / MS.MINUTE);
  const diffHours = Math.floor(diffMs / MS.HOUR);
  const diffDays = Math.floor(diffMs / MS.DAY);

  // Less than 1 hour - show minutes
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  // Less than 24 hours - show hours
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Yesterday (24-48 hours)
  if (diffDays === 1) {
    return "Yesterday";
  }

  // 2-7 days - show days
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // 7+ days - show date
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Get the display label for a day relative to today
 *
 * Used for grouping activities by day.
 *
 * @param date - ISO date string or Date object
 * @returns "Today" | "Yesterday" | weekday name | formatted date
 *
 * @example
 * getDayLabel(activity.recorded_at)
 * // => "Today" | "Yesterday" | "Monday" | "Jan 15"
 */
export function getDayLabel(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = getServerNow();

  // Compare dates at midnight to get accurate day difference
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.floor((nowDay.getTime() - dateDay.getTime()) / MS.DAY);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
  const [status, setStatus] = useState<ServerTimeSyncStatus>(() => getSyncStatus());

  useEffect(() => {
    // Update immediately in case status changed since initial render
    setStatus(getSyncStatus());

    return subscribeToSyncStatus(setStatus);
  }, []);

  return status;
}
