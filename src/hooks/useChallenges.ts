// src/hooks/useChallenges.ts
// Challenges data hook with React Query
//
// GUARDRAIL 3: Optimistic updates with rollback on failure

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  challengeService,
  PendingInvite,
  ChallengeWithParticipation,
} from "@/services/challenges";
import {
  activityService,
  generateClientEventId,
  LogActivityResult,
} from "@/services/activities";
import { useAuth } from "@/hooks/useAuth";
import { notificationsKeys } from "@/hooks/useNotifications";
import { activityKeys } from "@/hooks/useActivities";
import type { Challenge, ChallengeType } from "@/types/database";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const challengeKeys = {
  all: ["challenges"] as const,
  active: () => [...challengeKeys.all, "active"] as const,
  pending: () => [...challengeKeys.all, "pending"] as const,
  startingSoon: () => [...challengeKeys.all, "startingSoon"] as const,
  detail: (id: string) => [...challengeKeys.all, "detail", id] as const,
  leaderboard: (id: string) =>
    [...challengeKeys.all, "leaderboard", id] as const,
};

// =============================================================================
// OPTIMISTIC UPDATE HELPERS
// =============================================================================

/**
 * Optimistically update challenge detail with new progress.
 */
function optimisticallyUpdateChallengeDetail(
  challenge: ChallengeWithParticipation | null | undefined,
  additionalValue: number,
): ChallengeWithParticipation | null | undefined {
  if (!challenge?.my_participation) return challenge;

  return {
    ...challenge,
    my_participation: {
      ...challenge.my_participation,
      current_progress:
        challenge.my_participation.current_progress + additionalValue,
    },
  };
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get current user's active challenges
 */
export function useActiveChallenges() {
  return useQuery({
    queryKey: challengeKeys.active(),
    queryFn: () => challengeService.getMyActiveChallenges(),
  });
}

/**
 * Get current user's completed challenges
 */
export function useCompletedChallenges() {
  return useQuery({
    queryKey: [...challengeKeys.all, "completed"] as const,
    queryFn: () => challengeService.getCompletedChallenges(),
  });
}

/**
 * @deprecated Use useActiveChallenges() and filter client-side by start_date.
 * The get_my_challenges RPC already returns both "starting soon" and "in progress"
 * challenges. This separate query is redundant.
 *
 * See useHomeScreenData for the correct pattern.
 */
export function useStartingSoonChallenges() {
  return useQuery({
    queryKey: challengeKeys.startingSoon(),
    queryFn: () => challengeService.getStartingSoonChallenges(),
  });
}

/**
 * Get pending invites
 */
export function usePendingInvites() {
  return useQuery({
    queryKey: challengeKeys.pending(),
    queryFn: () => challengeService.getPendingInvites(),
  });
}

/**
 * Get single challenge details
 */
export function useChallenge(challengeId: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.detail(challengeId!),
    queryFn: () => challengeService.getChallenge(challengeId!),
    enabled: !!challengeId,
  });
}

/**
 * Options for useLeaderboard hook
 */
interface UseLeaderboardOptions {
  /** Whether to fetch the leaderboard (for lazy loading on expand) */
  enabled?: boolean;
  /** Max number of entries to return (for preview mode) */
  limit?: number;
}

/**
 * Get leaderboard for a challenge
 * RLS handles visibility - pending users get empty results
 * CONTRACT: UI must not gate this query on invite_status (Rule 2)
 *
 * @param challengeId - The challenge ID
 * @param options - Optional configuration
 * @param options.enabled - Whether to fetch (default: true when challengeId exists)
 * @param options.limit - Max entries to return (default: all)
 */
export function useLeaderboard(
  challengeId: string | undefined,
  options?: UseLeaderboardOptions,
) {
  const { enabled = true, limit } = options ?? {};

  return useQuery({
    queryKey: [...challengeKeys.leaderboard(challengeId!), { limit }],
    queryFn: async () => {
      const data = await challengeService.getLeaderboard(challengeId!);
      // Apply client-side limit if specified
      return limit ? data.slice(0, limit) : data;
    },
    enabled: !!challengeId && enabled, // Gate on ID + explicit enabled flag
    staleTime: 30_000, // 30s - leaderboards change often during active challenges
  });
}

/**
 * Create a new challenge
 */
export function useCreateChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      challenge_type: ChallengeType;
      custom_activity_name?: string;
      goal_value: number;
      goal_unit: string;
      start_date: string;
      end_date: string;
      win_condition?:
        | "highest_total"
        | "first_to_goal"
        | "longest_streak"
        | "all_complete";
    }) => challengeService.create(input),
    onSuccess: () => {
      // Invalidate and refetch active challenges
      queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
    },
  });
}

/**
 * Invite a user to a challenge
 */
export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { challenge_id: string; user_id: string }) =>
      challengeService.inviteUser(input),
    onSuccess: (_, variables) => {
      // Invalidate challenge detail to show new participant
      queryClient.invalidateQueries({
        queryKey: challengeKeys.detail(variables.challenge_id),
      });
    },
  });
}

/**
 * Respond to a challenge invite with optimistic updates.
 *
 * GUARDRAIL 3: Optimistic UI with rollback
 */
export function useRespondToInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      challenge_id: string;
      response: "accepted" | "declined";
    }) => challengeService.respondToInvite(input),

    // GUARDRAIL 3: Optimistic update - remove from pending immediately
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: challengeKeys.pending() });

      const previousInvites = queryClient.getQueryData<PendingInvite[]>(
        challengeKeys.pending(),
      );

      // Optimistically remove the invite
      queryClient.setQueryData<PendingInvite[]>(
        challengeKeys.pending(),
        (old) =>
          old?.filter(
            (invite) => invite.challenge.id !== variables.challenge_id,
          ) ?? [],
      );

      return { previousInvites };
    },

    // GUARDRAIL 3: Rollback on error
    onError: (error, variables, context) => {
      console.warn(
        "[useRespondToInvite] Rolling back optimistic update:",
        error,
      );
      if (context?.previousInvites) {
        queryClient.setQueryData(
          challengeKeys.pending(),
          context.previousInvites,
        );
      }
    },

    onSuccess: (_, variables) => {
      // If accepted, also invalidate active challenges
      if (variables.response === "accepted") {
        queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.pending() });
      // Trigger refetch notifications since the DB trigger marked the invite notification as read
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

/**
 * Log activity for a challenge with optimistic updates.
 *
 * GUARDRAIL 3: Optimistic UI with rollback
 * CONTRACT: Uses atomic RPC function with idempotency key
 *
 * IMPORTANT: client_event_id must be generated ONCE at the call site before
 * calling mutate(). This ensures React Query retries reuse the same ID,
 * preventing double-counting. Use generateClientEventId() from '@/services/activities'.
 */
export function useLogActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      challenge_id: string;
      activity_type: ChallengeType;
      value: number;
      client_event_id: string;
    }): Promise<LogActivityResult> => {
      return activityService.logActivity(input);
    },

    // GUARDRAIL 3: Optimistic update before network request
    onMutate: async (variables) => {
      const userId = user?.id;
      if (!userId) return {};

      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: challengeKeys.detail(variables.challenge_id),
      });

      // Snapshot previous value for rollback
      const previousDetail =
        queryClient.getQueryData<ChallengeWithParticipation | null>(
          challengeKeys.detail(variables.challenge_id),
        );

      // Optimistically update challenge detail (progress bar, stats)
      if (previousDetail) {
        queryClient.setQueryData(
          challengeKeys.detail(variables.challenge_id),
          optimisticallyUpdateChallengeDetail(previousDetail, variables.value),
        );
      }

      // Return context for rollback
      // Leaderboard is NOT optimistically updated — it derives rank, today_change,
      // and participant count server-side. onSettled invalidation triggers a refetch
      // within ~200ms, which is imperceptible vs an incomplete client approximation.
      return { previousDetail };
    },

    // GUARDRAIL 3: Rollback on error
    onError: (error, variables, context) => {
      console.warn("[useLogActivity] Rolling back optimistic update:", error);

      if (context?.previousDetail) {
        queryClient.setQueryData(
          challengeKeys.detail(variables.challenge_id),
          context.previousDetail,
        );
      }
    },

    // Always refetch after mutation settles (success or error)
    onSettled: (data, error, variables) => {
      // If queued, don't invalidate yet - will happen on sync
      if (data?.queued) {
        console.log("[useLogActivity] Activity queued for offline sync");
        return;
      }

      // Invalidate to get server-authoritative data
      queryClient.invalidateQueries({
        queryKey: challengeKeys.leaderboard(variables.challenge_id),
      });
      queryClient.invalidateQueries({
        queryKey: challengeKeys.detail(variables.challenge_id),
      });
      // Invalidate activity queries so recent activities section updates
      queryClient.invalidateQueries({
        queryKey: activityKeys.all,
      });
    },
  });
}

/**
 * Leave a challenge (for non-creator participants)
 */
export function useLeaveChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeId: string) =>
      challengeService.leaveChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
      // Trigger refetch notifications since the DB trigger marked challenge notifications as read
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

/**
 * Cancel a challenge (creator only)
 */
export function useCancelChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeId: string) =>
      challengeService.cancelChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
      // Trigger refetch notifications since the DB trigger marked challenge notifications as read
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
