// src/hooks/v2/useHomeScreenData.ts
// Consolidated data fetching hook for V2 Home Screen
//
// Combines:
// - Active challenges query
// - Pending invites query
// - Completed challenges query
// - Recent activities query
// - Unified refresh logic
// - View model transformation

import { useState, useCallback, useMemo } from "react";
import { useFocusEffect } from "expo-router";
import {
  useActiveChallenges,
  useCompletedChallenges,
  usePendingInvites,
  useRespondToInvite,
} from "@/hooks/useChallenges";
import { useRecentActivities, toDisplayActivity } from "@/hooks/useActivities";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useAuth } from "@/providers/AuthProvider";
import { pushTokenService } from "@/services/pushTokens";

export interface HomeScreenData {
  // Raw data
  activeChallenges: ReturnType<typeof useActiveChallenges>["data"];
  pendingInvites: ReturnType<typeof usePendingInvites>["data"];
  completedChallenges: ReturnType<typeof useCompletedChallenges>["data"];
  recentActivities: ReturnType<typeof useRecentActivities>["data"];

  // View model
  displayActivities: ReturnType<typeof toDisplayActivity>[];
  displayName: string;
  currentStreak: number;
  unreadCount: number | undefined;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;

  // Actions
  handleRefresh: () => Promise<void>;
  handleAcceptInvite: (challengeId: string) => Promise<void>;
  handleDeclineInvite: (challengeId: string) => Promise<void>;

  // Mutation state
  isRespondingToInvite: boolean;
}

export function useHomeScreenData(): HomeScreenData {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Queries
  const {
    data: activeChallenges,
    isLoading: loadingActive,
    refetch: refetchActive,
  } = useActiveChallenges();

  const {
    data: pendingInvites,
    isLoading: loadingPending,
    refetch: refetchPending,
  } = usePendingInvites();

  const { data: completedChallenges, refetch: refetchCompleted } =
    useCompletedChallenges();

  const { data: recentActivities, refetch: refetchActivities } =
    useRecentActivities(5);

  const { data: unreadCount } = useUnreadNotificationCount();

  const respondToInvite = useRespondToInvite();

  // Transform activities for display (limit to 2 for home screen)
  const displayActivities = useMemo(() => {
    if (!recentActivities) return [];
    return recentActivities.slice(0, 2).map(toDisplayActivity);
  }, [recentActivities]);

  // Profile-derived values
  const currentStreak = profile?.current_streak || 0;
  const displayName = profile?.display_name || profile?.username || "Athlete";

  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetchActive();
      refetchPending();
      refetchCompleted();
      refetchActivities();
    }, [refetchActive, refetchPending, refetchCompleted, refetchActivities]),
  );

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchActive(),
      refetchPending(),
      refetchCompleted(),
      refetchActivities(),
    ]);
    setRefreshing(false);
  }, [refetchActive, refetchPending, refetchCompleted, refetchActivities]);

  // Invite handlers
  const handleAcceptInvite = useCallback(
    async (challengeId: string) => {
      try {
        await respondToInvite.mutateAsync({
          challenge_id: challengeId,
          response: "accepted",
        });
        // Request push notifications after accepting first invite
        pushTokenService
          .requestAndRegister()
          .catch((err) => console.warn("Push notification setup failed:", err));
      } catch (err) {
        console.error("Failed to accept invite:", err);
        throw err;
      }
    },
    [respondToInvite],
  );

  const handleDeclineInvite = useCallback(
    async (challengeId: string) => {
      try {
        await respondToInvite.mutateAsync({
          challenge_id: challengeId,
          response: "declined",
        });
      } catch (err) {
        console.error("Failed to decline invite:", err);
        throw err;
      }
    },
    [respondToInvite],
  );

  return {
    // Raw data
    activeChallenges,
    pendingInvites,
    completedChallenges,
    recentActivities,

    // View model
    displayActivities,
    displayName,
    currentStreak,
    unreadCount,

    // Loading states
    isLoading: loadingActive && loadingPending,
    isRefreshing: refreshing,

    // Actions
    handleRefresh,
    handleAcceptInvite,
    handleDeclineInvite,

    // Mutation state
    isRespondingToInvite: respondToInvite.isPending,
  };
}
