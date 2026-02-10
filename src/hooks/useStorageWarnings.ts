// src/hooks/useStorageWarnings.ts
// Surface storage degradation warnings to the user via toast
//
// Extracted from app/_layout.tsx (Phase 3 refactor)
//
// Three concerns:
// 1. On login: check initial storage probe result, warn if degraded
// 2. Mid-session: subscribe to live storage status changes
// 3. On logout: reset warning flag so next login re-checks

import { useEffect, useRef } from "react";
import { storageProbePromise, subscribeToStorageStatus } from "@/lib/supabase";
import type { ToastOptions } from "@/providers/ToastProvider";
import type { Session } from "@supabase/supabase-js";

type ShowToast = (message: string, options?: ToastOptions) => void;

/**
 * Monitors storage health and shows toast warnings when degraded.
 * - On login: checks probe result, warns once per session
 * - Mid-session: subscribes to live degradation events
 * - On logout: resets so next login re-checks
 */
export function useStorageWarnings(session: Session | null, showToast: ShowToast) {
  const warningShown = useRef(false);

  // Check storage status on login (once per session)
  useEffect(() => {
    if (!session?.user?.id || warningShown.current) return;

    storageProbePromise.then((status) => {
      if (warningShown.current) return;
      warningShown.current = true;

      if (!status.isPersistent) {
        showToast("Session won't persist between app restarts. Storage unavailable.", {
          variant: "error",
          duration: 6000,
        });
      } else if (!status.isSecure) {
        showToast("Using unencrypted session storage. Your data is still safe.", {
          variant: "warning",
          duration: 5000,
        });
      }
    });
  }, [session?.user?.id, showToast]);

  // Reset warning flag on logout
  useEffect(() => {
    if (!session) {
      warningShown.current = false;
    }
  }, [session]);

  // Subscribe to mid-session storage degradation
  useEffect(() => {
    const unsubscribe = subscribeToStorageStatus((status) => {
      if (status.degradedAt) {
        if (!status.isPersistent) {
          showToast("Storage failed. Session may not persist after app restart.", {
            variant: "error",
            duration: 0,
          });
        } else if (!status.isSecure) {
          showToast("Switched to unencrypted storage. Your session is still safe.", {
            variant: "warning",
            duration: 6000,
          });
        }
      }
    });

    return unsubscribe;
  }, [showToast]);
}
