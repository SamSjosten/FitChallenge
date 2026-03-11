// src/lib/invalidateAfterSync.ts
// M1: Centralized cache invalidation after offline queue sync.
//
// Called by every processQueue() callsite that has access to queryClient:
//   - useNetworkStatus.ts   (reconnect)
//   - useOfflineQueue.ts    (enqueue-while-online + processNow)
//   - _layout.tsx           (startup with pending items)
//
// Uses broad invalidation (challengeKeys.all + activityKeys.all) because
// the queue does not track which challenge IDs were affected.
// React Query only refetches mounted queries, so broad scope is cheap.
//
// Concurrency note: The store's isProcessing guard returns succeeded:0
// for concurrent callers. The succeeded>0 check here prevents redundant
// invalidation. Duplicate invalidation is tolerated by design — it merely
// marks caches as stale, triggering a no-op refetch for already-fresh data.

import type { QueryClient } from "@tanstack/react-query";
import type { ProcessQueueResult } from "@/stores/offlineStore";
import { challengeKeys, activityKeys } from "@/lib/queryKeys";

/**
 * Invalidate challenge and activity caches after successful queue sync.
 *
 * @param result - The result from processQueue()
 * @param queryClient - React Query client instance
 * @returns true if invalidation was triggered, false if skipped
 */
export function invalidateAfterSync(
  result: ProcessQueueResult,
  queryClient: QueryClient,
): boolean {
  if (result.succeeded > 0) {
    queryClient.invalidateQueries({ queryKey: challengeKeys.all });
    queryClient.invalidateQueries({ queryKey: activityKeys.all });
    console.log(
      `[OfflineSync] Invalidated caches after sync (${result.succeeded} succeeded, ${result.failed} failed)`,
    );
    return true;
  }
  return false;
}
