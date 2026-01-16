// src/hooks/useRealtimeSubscription.ts
// Realtime subscription hook for live updates

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { notificationsKeys } from "@/hooks/useNotifications";
import { friendsKeys } from "@/hooks/useFriends";
import { challengeKeys } from "@/hooks/useChallenges";

/**
 * Subscribe to realtime updates for the current user
 * Invalidates React Query cache when relevant changes occur
 *
 * NOTE: Leaderboard updates are handled by useLeaderboardSubscription
 * in the challenge detail screen (scoped to specific challenge_id)
 */
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

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
          queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        }
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
          queryClient.invalidateQueries({ queryKey: friendsKeys.all });
        }
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
          queryClient.invalidateQueries({ queryKey: friendsKeys.all });
        }
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
          queryClient.invalidateQueries({ queryKey: challengeKeys.all });
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

/**
 * Subscribe to leaderboard updates for a specific challenge
 * Use this on screens that display a challenge leaderboard
 */
export function useLeaderboardSubscription(challengeId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!challengeId) return;

    const channel = supabase
      .channel(`leaderboard-${challengeId}`)
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
          queryClient.invalidateQueries({
            queryKey: challengeKeys.leaderboard(challengeId),
          });
        }
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
          queryClient.invalidateQueries({
            queryKey: challengeKeys.leaderboard(challengeId),
          });
        }
      )
      .subscribe();

    // Cleanup on unmount or challengeId change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, queryClient]);
}
