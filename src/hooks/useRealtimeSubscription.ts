// src/hooks/useRealtimeSubscription.ts
// Realtime subscription hook for live updates

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { notificationsKeys } from "@/hooks/useNotifications";
import { friendsKeys } from "@/hooks/useFriends";
import { challengeKeys } from "@/hooks/useChallenges";
import { Config } from "@/constants/config";
import {
  createThrottledInvalidator,
  logRealtimeStatus,
  updateRealtimeStatus,
  resetRealtimeStatus,
  getRealtimeStatus,
  subscribeToRealtimeStatus,
  type RealtimeStatus,
  type RealtimeConnectionState,
} from "@/lib/realtimeThrottle";

/**
 * Subscribe to realtime updates for the current user
 * Invalidates React Query cache when relevant changes occur
 *
 * Features:
 * - Feature flag: Disable with EXPO_PUBLIC_ENABLE_REALTIME=false
 * - Throttled invalidation: Batches rapid changes to avoid stampedes
 * - Connection logging: Logs status changes for observability
 * - Auto-reconnect: Supabase handles reconnection with exponential backoff
 * - Fail-safe: Invalid client or rapid auth changes won't crash the app
 *
 * NOTE: Leaderboard updates are handled by useLeaderboardSubscription
 * in the challenge detail screen (scoped to specific challenge_id)
 */
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Stable reference to throttled invalidator
  const throttledInvalidateRef = useRef<ReturnType<
    typeof createThrottledInvalidator
  > | null>(null);

  // Track channel for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Feature flag check
    if (!Config.enableRealtime) {
      console.log("[Realtime] Disabled via feature flag");
      return;
    }

    // Must have authenticated user
    if (!user?.id) {
      resetRealtimeStatus();
      return;
    }

    // Cancellation flag to prevent stale operations on rapid auth changes
    let cancelled = false;

    // Get Supabase client safely
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (err) {
      console.error("[Realtime] Failed to get Supabase client:", err);
      updateRealtimeStatus(
        "app-realtime",
        "DISCONNECTED",
        err instanceof Error ? err : new Error(String(err)),
      );
      return;
    }

    // Mark as connecting
    updateRealtimeStatus("app-realtime", "CONNECTING");

    // Create throttled invalidator (500ms debounce)
    const throttledInvalidate = createThrottledInvalidator(queryClient, 500);
    throttledInvalidateRef.current = throttledInvalidate;

    const channel = supabase
      .channel("app-realtime")
      // Notifications: any change for current user
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!cancelled) {
            throttledInvalidate(notificationsKeys.all);
          }
        },
      )
      // Friends: changes where user is requester or recipient
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `requested_by=eq.${user.id}`,
        },
        () => {
          if (!cancelled) {
            throttledInvalidate(friendsKeys.all);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `requested_to=eq.${user.id}`,
        },
        () => {
          if (!cancelled) {
            throttledInvalidate(friendsKeys.all);
          }
        },
      )
      // Challenge participants: changes for current user only
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "challenge_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!cancelled) {
            throttledInvalidate(challengeKeys.all);
          }
        },
      )
      .subscribe((status: string, err?: Error) => {
        if (!cancelled) {
          logRealtimeStatus("app-realtime", status as RealtimeStatus, err);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or user change
    return () => {
      cancelled = true;

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.warn("[Realtime] Error removing channel:", err);
        }
        channelRef.current = null;
      }

      resetRealtimeStatus();
    };
  }, [user?.id, queryClient]);
}

/**
 * Subscribe to leaderboard updates for a specific challenge
 * Use this on screens that display a challenge leaderboard
 *
 * Features:
 * - Feature flag: Respects EXPO_PUBLIC_ENABLE_REALTIME
 * - Throttled invalidation: Batches rapid progress updates
 * - Connection logging: Logs status changes for observability
 * - Fail-safe: Invalid client won't crash the app
 */
export function useLeaderboardSubscription(challengeId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Feature flag check
    if (!Config.enableRealtime) return;

    if (!challengeId) return;

    // Cancellation flag to prevent stale operations
    let cancelled = false;

    // Get Supabase client safely
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (err) {
      console.error("[Realtime] Failed to get Supabase client:", err);
      return;
    }

    // Create throttled invalidator (500ms debounce)
    const throttledInvalidate = createThrottledInvalidator(queryClient, 500);

    const channelName = `leaderboard-${challengeId}`;
    const channel = supabase
      .channel(channelName)
      // Challenge participants: progress updates for this challenge
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenge_participants",
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => {
          if (!cancelled) {
            throttledInvalidate(challengeKeys.leaderboard(challengeId));
          }
        },
      )
      // Activity logs: new entries for this challenge
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => {
          if (!cancelled) {
            throttledInvalidate(challengeKeys.leaderboard(challengeId));
          }
        },
      )
      .subscribe((status: string, err?: Error) => {
        if (!cancelled) {
          logRealtimeStatus(channelName, status as RealtimeStatus, err);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or challengeId change
    return () => {
      cancelled = true;

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.warn("[Realtime] Error removing channel:", err);
        }
        channelRef.current = null;
      }
    };
  }, [challengeId, queryClient]);
}

/**
 * Hook to observe realtime connection status
 * Use this to show connection warnings in the UI
 *
 * @example
 * ```tsx
 * function ConnectionStatus() {
 *   const { status, lastError } = useRealtimeStatus();
 *   if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
 *     return <Banner>Realtime updates unavailable</Banner>;
 *   }
 *   return null;
 * }
 * ```
 */
export function useRealtimeStatus() {
  const [state, setState] = useState(() => getRealtimeStatus());

  useEffect(() => {
    return subscribeToRealtimeStatus(setState);
  }, []);

  return state;
}
