// src/lib/queryPersister.ts
// React Query cache persistence configuration
//
// GUARDRAIL 0: Non-blocking - uses AsyncStorage, not SecureStore
// GUARDRAIL 1: Does not touch auth storage
// GUARDRAIL 2: Persist only low-churn, safe data
// GUARDRAIL 4: Does not prevent realtime invalidation

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_KEY = "FITCHALLENGE_QUERY_CACHE";
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours
const THROTTLE_MS = 1000; // Debounce writes to reduce I/O

// =============================================================================
// EXCLUDED QUERY KEYS
// =============================================================================

/**
 * Query key prefixes that should NOT be persisted.
 *
 * GUARDRAIL 2: Exclude server-authoritative data that changes frequently
 * or is invalidated via realtime subscriptions.
 */
const EXCLUDED_PREFIXES = new Set([
  "notifications", // Server-authoritative, realtime-driven
]);

/**
 * Determine if a query should be persisted.
 *
 * GUARDRAIL 2: Only persist stable, low-churn data.
 */
function shouldDehydrateQuery(query: Query): boolean {
  // Must have data and be successful
  if (query.state.status !== "success") return false;

  // Check exclusion list
  const primaryKey = query.queryKey[0];
  if (typeof primaryKey === "string" && EXCLUDED_PREFIXES.has(primaryKey)) {
    return false;
  }

  // Default: persist
  return true;
}

// =============================================================================
// PERSISTER
// =============================================================================

/**
 * AsyncStorage-backed persister for React Query cache.
 *
 * GUARDRAIL 0: Non-blocking - uses async storage, not SecureStore
 * GUARDRAIL 1: Does not touch auth storage
 * GUARDRAIL 6: No sensitive data persisted (queries are user-scoped via RLS)
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  throttleTime: THROTTLE_MS,
});

// =============================================================================
// PERSIST OPTIONS
// =============================================================================

/**
 * Configuration for PersistQueryClientProvider.
 *
 * GUARDRAIL 4: maxAge ensures stale data is discarded; realtime still invalidates
 */
export const persistOptions = {
  persister: queryPersister,
  maxAge: MAX_AGE_MS,
  dehydrateOptions: {
    shouldDehydrateQuery,
  },
};

// =============================================================================
// MANUAL CACHE CLEAR (for sign-out)
// =============================================================================

/**
 * Clear persisted query cache.
 * Call this on sign-out to prevent data leakage between accounts.
 *
 * GUARDRAIL 6: Security - clear cached data on account switch
 */
export async function clearPersistedQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    console.log("[QueryPersister] Cache cleared");
  } catch (error) {
    console.warn("[QueryPersister] Failed to clear cache:", error);
  }
}
