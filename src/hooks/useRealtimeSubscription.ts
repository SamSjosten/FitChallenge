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
      // Challenge participants: changes for current user
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
      // Challenge participants: all changes (for leaderboard updates)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenge_participants",
        },
        (payload) => {
          // Invalidate specific challenge leaderboard
          if (payload.new && "challenge_id" in payload.new) {
            queryClient.invalidateQueries({
              queryKey: challengeKeys.leaderboard(
                payload.new.challenge_id as string
              ),
            });
          }
        }
      )
      // Challenges: status changes
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenges",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: challengeKeys.all });
        }
      )
      // Activity logs: new entries (for leaderboard)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        (payload) => {
          if (
            payload.new &&
            "challenge_id" in payload.new &&
            payload.new.challenge_id
          ) {
            queryClient.invalidateQueries({
              queryKey: challengeKeys.leaderboard(
                payload.new.challenge_id as string
              ),
            });
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
