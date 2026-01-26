// src/hooks/useOfflineQueue.ts
// Hook for UI components to interact with offline queue
//
// GUARDRAIL 3: Service layer integration
// GUARDRAIL 5: UI feedback

import { useCallback } from "react";
import { useOfflineStore, QueuedAction } from "@/stores/offlineStore";
import { checkNetworkStatus } from "./useNetworkStatus";

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
  const queueLength = useOfflineStore((s) => s.queue.length);
  const isProcessing = useOfflineStore((s) => s.isProcessing);
  const addToQueue = useOfflineStore((s) => s.addToQueue);
  const processQueue = useOfflineStore((s) => s.processQueue);

  const enqueue = useCallback(
    async (action: QueuedAction): Promise<string> => {
      const id = addToQueue(action);

      // Try immediate processing if online
      const isOnline = await checkNetworkStatus();
      if (isOnline) {
        // Non-blocking process attempt
        processQueue().catch(() => {
          // Errors are logged in processQueue, item stays in queue for retry
        });
      }

      return id;
    },
    [addToQueue, processQueue],
  );

  const processNow = useCallback(async () => {
    await processQueue();
  }, [processQueue]);

  return {
    queueLength,
    isProcessing,
    enqueue,
    processNow,
  };
}
