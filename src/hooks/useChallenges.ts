// src/hooks/useChallenges.ts
// Challenges data hook with React Query

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { challengeService, LeaderboardEntry, PendingInvite, ChallengeWithParticipation } from '@/services/challenges';
import { activityService, generateClientEventId } from '@/services/activities';
import type { Challenge, ChallengeType } from '@/types/database';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const challengeKeys = {
  all: ['challenges'] as const,
  active: () => [...challengeKeys.all, 'active'] as const,
  pending: () => [...challengeKeys.all, 'pending'] as const,
  detail: (id: string) => [...challengeKeys.all, 'detail', id] as const,
  leaderboard: (id: string) => [...challengeKeys.all, 'leaderboard', id] as const,
};

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
 * Get leaderboard for a challenge
 * RLS handles visibility - pending users get empty results
 * CONTRACT: UI must not gate this query on invite_status (Rule 2)
 */
export function useLeaderboard(challengeId: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.leaderboard(challengeId!),
    queryFn: () => challengeService.getLeaderboard(challengeId!),
    enabled: !!challengeId,  // Only gate on having an ID, not authorization
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
      goal_value: number;
      goal_unit: string;
      start_date: string;
      end_date: string;
      win_condition?: 'highest_total' | 'first_to_goal' | 'longest_streak' | 'all_complete';
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
        queryKey: challengeKeys.detail(variables.challenge_id) 
      });
    },
  });
}

/**
 * Respond to a challenge invite
 */
export function useRespondToInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { 
      challenge_id: string; 
      response: 'accepted' | 'declined' 
    }) => challengeService.respondToInvite(input),
    onSuccess: () => {
      // Invalidate both pending and active lists
      queryClient.invalidateQueries({ queryKey: challengeKeys.pending() });
      queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
    },
  });
}

/**
 * Log activity for a challenge
 * CONTRACT: Uses atomic RPC function with idempotency key
 */
export function useLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      challenge_id: string;
      activity_type: ChallengeType;
      value: number;
    }) => {
      // Generate idempotency key
      const client_event_id = generateClientEventId();
      
      await activityService.logActivity({
        ...input,
        client_event_id,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate challenge detail and leaderboard to reflect new progress
      queryClient.invalidateQueries({ 
        queryKey: challengeKeys.detail(variables.challenge_id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: challengeKeys.leaderboard(variables.challenge_id) 
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
    mutationFn: (challengeId: string) => challengeService.leaveChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
    },
  });
}

/**
 * Cancel a challenge (creator only)
 */
export function useCancelChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeId: string) => challengeService.cancelChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: challengeKeys.active() });
    },
  });
}
