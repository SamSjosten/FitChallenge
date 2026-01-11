// src/lib/serverTime.ts
// Server time synchronization to reduce client clock dependence
//
// Problem: Device clocks can drift, causing incorrect challenge status display
// Solution: Fetch server time once at app start, cache the offset, apply to local time

import { supabase } from "./supabase";

/** Cached offset in milliseconds: serverTime - deviceTime */
let cachedOffsetMs: number | null = null;

/** Timestamp of last successful sync */
let lastSyncAt: number | null = null;

/** How often to re-sync (5 minutes) */
const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Threshold for logging clock drift warnings (60 seconds) */
const DRIFT_WARNING_THRESHOLD_MS = 60 * 1000;

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

    const { data, error } = await supabase.rpc("get_server_time");

    if (error || !data) {
      console.warn("Failed to sync server time:", error?.message);
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
      console.warn("Failed to sync server time: unexpected payload shape");
      return false;
    }

    const serverNow = new Date(serverTimeStr).getTime();
    if (isNaN(serverNow)) {
      console.warn("Failed to sync server time: invalid timestamp");
      return false;
    }

    cachedOffsetMs = serverNow - deviceNowMid;
    lastSyncAt = Date.now();

    // Log significant drift for debugging
    if (Math.abs(cachedOffsetMs) > DRIFT_WARNING_THRESHOLD_MS) {
      console.warn(
        `Device clock drift detected: ${Math.round(cachedOffsetMs / 1000)}s`
      );
    }

    return true;
  } catch (err) {
    console.warn("Server time sync error:", err);
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
}

/**
 * Manually set offset (primarily for testing)
 */
export function setOffsetMs(offsetMs: number): void {
  cachedOffsetMs = offsetMs;
  lastSyncAt = Date.now();
}
