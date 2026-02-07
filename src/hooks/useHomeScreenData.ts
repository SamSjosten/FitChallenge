// src/hooks/useHomeScreenData.ts
// Consolidated data fetching hook for Home Screen
//
// Combines:
// - Active challenges query (includes both "starting soon" and "in progress")
// - Pending invites query
// - Completed challenges query
// - Recent activities query
// - Unified refresh logic
// - View model transformation
//
// NOTE: "Starting soon" is derived client-side from activeChallenges using
// getEffectiveStatus() with server-synchronized time. This avoids a redundant
// query since get_my_challenges RPC already returns all challenges where
// end_date > now() (which includes pending/upcoming ones).

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
import { getServerNow } from "@/lib/serverTime";
import { getEffectiveStatus } from "@/lib/challengeStatus";
import type { ChallengeWithParticipation } from "@/services/challenges";

export interface HomeScreenData {
  // Derived challenge lists
  activeChallenges: ChallengeWithParticipation[] | undefined; // In progress (start_date <= now)
  startingSoonChallenges: ChallengeWithParticipation[] | undefined; // Upcoming (start_date > now)
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

/**
 * Splits challenges into "starting soon" (upcoming) and "in progress" (active)
 *
 * Uses getEffectiveStatus() with server-synchronized time from getServerNow().
 * This mirrors the DB function challenge_effective_status() and avoids
 * client/server clock drift issues.
 *
 * @internal Exported for testing only
 */
export function splitChallengesByStatus(
  challenges: ChallengeWithParticipation[] | undefined,
  userId: string | undefined,
): {
  inProgress: ChallengeWithParticipation[] | undefined;
  startingSoon: ChallengeWithParticipation[] | undefined;
} {
  if (!challenges) return { inProgress: undefined, startingSoon: undefined };

  // Use server-synchronized time (not raw client time)
  const now = getServerNow();

  const inProgress: ChallengeWithParticipation[] = [];
  const startingSoon: ChallengeWithParticipation[] = [];

  for (const challenge of challenges) {
    // Add is_creator flag for UI (show/hide invite button)
    const enrichedChallenge: ChallengeWithParticipation = {
      ...challenge,
      is_creator: userId ? challenge.creator_id === userId : false,
    };

    // Use time-derived status (mirrors DB function challenge_effective_status)
    const effectiveStatus = getEffectiveStatus(challenge, now);

    if (effectiveStatus === "upcoming") {
      startingSoon.push(enrichedChallenge);
    } else if (effectiveStatus === "active") {
      inProgress.push(enrichedChallenge);
    }
    // 'completed' won't be in this list (filtered out by RPC)
    // 'cancelled'/'archived' also filtered by RPC
  }

  // Sort starting soon by start_date ascending (soonest first)
  startingSoon.sort(
    (a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  return { inProgress, startingSoon };
}

export function useHomeScreenData(): HomeScreenData {
  const { profile, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Queries - activeChallenges includes BOTH in-progress AND starting-soon
  const {
    data: allActiveChallenges,
    isLoading: loadingActive,
    refetch: refetchActive,
  } = useActiveChallenges();

  // Derive startingSoon and inProgress from the single query
  // Uses server-managed status column (not client time) to avoid drift issues
  const { inProgress: activeChallenges, startingSoon: startingSoonChallenges } =
    useMemo(
      () => splitChallengesByStatus(allActiveChallenges, user?.id),
      [allActiveChallenges, user?.id],
    );

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
    // Challenge data (derived from single RPC query)
    activeChallenges, // In progress (start_date <= now)
    startingSoonChallenges, // Upcoming (start_date > now)
    pendingInvites,
    completedChallenges,
    recentActivities,

    // View model
    displayActivities,
    displayName,
    currentStreak,
    unreadCount,

    // Loading states - show loading until primary data is ready
    isLoading: loadingActive || loadingPending,
    isRefreshing: refreshing,

    // Actions
    handleRefresh,
    handleAcceptInvite,
    handleDeclineInvite,

    // Mutation state
    isRespondingToInvite: respondToInvite.isPending,
  };
}
