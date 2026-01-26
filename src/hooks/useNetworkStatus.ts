// src/hooks/useNetworkStatus.ts
// Network connectivity detection with queue processing
//
// GUARDRAIL 3: Process queue on reconnect
// GUARDRAIL 5: Non-blocking

import { useEffect, useState, useRef } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useOfflineStore } from "@/stores/offlineStore";

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Hook to observe network connectivity and trigger queue processing.
 *
 * GUARDRAIL 3: Processes offline queue when connection restored
 * GUARDRAIL 5: Non-blocking (async processing)
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
  });

  const processQueue = useOfflineStore((s) => s.processQueue);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable;

      setStatus({
        isConnected,
        isInternetReachable,
        type: state.type,
      });

      // Track disconnection
      if (!isConnected) {
        wasDisconnected.current = true;
      }

      // Process queue on reconnect
      // GUARDRAIL 3: Only process if we were previously disconnected
      if (isConnected && wasDisconnected.current) {
        wasDisconnected.current = false;

        // GUARDRAIL 5: Non-blocking - don't await
        processQueue().catch((error) => {
          console.error("[NetworkStatus] Queue processing failed:", error);
        });
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Initial check
    NetInfo.fetch().then(handleNetworkChange);

    return () => unsubscribe();
  }, [processQueue]);

  return status;
}

/**
 * Non-hook utility to check network status.
 * Use this in service layer where hooks aren't available.
 */
export async function checkNetworkStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
}
