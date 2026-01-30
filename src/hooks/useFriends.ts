// src/hooks/useFriends.ts
// Friends data hooks with React Query

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { friendsService } from "@/services/friends";
import { notificationsKeys } from "@/hooks/useNotifications";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const friendsKeys = {
  all: ["friends"] as const,
  list: () => [...friendsKeys.all, "list"] as const,
  pending: () => [...friendsKeys.all, "pending"] as const,
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get current user's friends
 */
export function useFriends() {
  return useQuery({
    queryKey: friendsKeys.list(),
    queryFn: () => friendsService.getFriends(),
  });
}

/**
 * Get pending friend requests (received)
 */
export function usePendingFriendRequests() {
  return useQuery({
    queryKey: friendsKeys.pending(),
    queryFn: () => friendsService.getPendingRequests(),
  });
}

/**
 * Send a friend request
 */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId: string) =>
      friendsService.sendRequest({ target_user_id: targetUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
    },
  });
}

/**
 * Accept a friend request
 */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) =>
      friendsService.acceptRequest({ friendship_id: friendshipId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.list() });
      queryClient.invalidateQueries({ queryKey: friendsKeys.pending() });
      // Trigger refetch notifications since the DB trigger marked friend_request_received as read
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

/**
 * Decline a friend request
 */
export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) =>
      friendsService.declineRequest({ friendship_id: friendshipId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.pending() });
      // Trigger refetch notifications since the DB trigger marked friend_request_received as read
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

/**
 * Remove a friend
 */
export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: string) =>
      friendsService.removeFriend({ friendship_id: friendshipId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.list() });
      // Trigger refetch notifications (in case the friendship was pending)
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
