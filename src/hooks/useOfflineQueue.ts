// src/hooks/useOfflineQueue.ts
// Hook for UI components to interact with offline queue
//
// GUARDRAIL 3: Service layer integration
// GUARDRAIL 5: UI feedback

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOfflineStore, QueuedAction } from "@/stores/offlineStore";
import { useAuth } from "@/hooks/useAuth";
import { checkNetworkStatus } from "./useNetworkStatus";
import { invalidateAfterSync } from "@/lib/invalidateAfterSync";

interface UseOfflineQueueReturn {
  /** Number of items waiting in the queue */
  queueLength: number;
  /** Whether the queue is currently being processed */
  isProcessing: boolean;
  /** Add an action to the queue, attempts immediate processing if online */
  enqueue: (action: QueuedAction) => Promise<string>;
  /** Manually trigger queue processing */
  processNow: () => Promise<void>;
}

/**
 * Hook for components that need to enqueue offline actions.
 *
 * GUARDRAIL 3: Attempts immediate execution if online, queues if offline
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queueLength = useOfflineStore((s) => s.queue.length);
  const isProcessing = useOfflineStore((s) => s.isProcessing);
  const addToQueue = useOfflineStore((s) => s.addToQueue);
  const processQueue = useOfflineStore((s) => s.processQueue);

  const enqueue = useCallback(
    async (action: QueuedAction): Promise<string> => {
      // C3: Capture current user ID for cross-account replay prevention.
      // Uses cached React context (no network call needed).
      const id = addToQueue(action, user?.id);

      // Try immediate processing if online
      const isOnline = await checkNetworkStatus();
      if (isOnline) {
        // Non-blocking process attempt
        // M1: Invalidate caches after successful immediate sync
        processQueue()
          .then((result) => {
            invalidateAfterSync(result, queryClient);
          })
          .catch(() => {
            // Errors are logged in processQueue, item stays in queue for retry
          });
      }

      return id;
    },
    [addToQueue, processQueue, user?.id, queryClient],
  );

  const processNow = useCallback(async () => {
    const result = await processQueue();
    // M1: Invalidate caches after manual sync trigger
    invalidateAfterSync(result, queryClient);
  }, [processQueue, queryClient]);

  return {
    queueLength,
    isProcessing,
    enqueue,
    processNow,
  };
}
