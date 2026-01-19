// src/hooks/useRealtimeSubscription.ts
// Realtime subscription hook for live updates

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { notificationsKeys } from "@/hooks/useNotifications";
import { friendsKeys } from "@/hooks/useFriends";
import { challengeKeys } from "@/hooks/useChallenges";
import { Config } from "@/constants/config";
import {
  createThrottledInvalidator,
  logRealtimeStatus,
  type RealtimeStatus,
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

  useEffect(() => {
    // Feature flag check
    if (!Config.enableRealtime) {
      console.log("[Realtime] Disabled via feature flag");
      return;
    }

    if (!user?.id) return;

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
          throttledInvalidate(notificationsKeys.all);
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
          throttledInvalidate(friendsKeys.all);
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
          throttledInvalidate(friendsKeys.all);
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
          throttledInvalidate(challengeKeys.all);
        },
      )
      .subscribe((status, err) => {
        logRealtimeStatus("app-realtime", status as RealtimeStatus, err);
      });

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
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
 */
export function useLeaderboardSubscription(challengeId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Feature flag check
    if (!Config.enableRealtime) return;

    if (!challengeId) return;

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
          throttledInvalidate(challengeKeys.leaderboard(challengeId));
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
          throttledInvalidate(challengeKeys.leaderboard(challengeId));
        },
      )
      .subscribe((status, err) => {
        logRealtimeStatus(channelName, status as RealtimeStatus, err);
      });

    // Cleanup on unmount or challengeId change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, queryClient]);
}
