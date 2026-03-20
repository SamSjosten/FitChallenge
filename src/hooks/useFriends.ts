// src/hooks/useFriends.ts
// Friends data hooks with React Query

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { friendsService } from "@/services/friends";
import { friendsKeys, notificationsKeys } from "@/lib/queryKeys";

// =============================================================================
// QUERY KEYS — re-exported from @/lib/queryKeys for backward compatibility
// =============================================================================

export { friendsKeys };

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get current user's friends
 */
export function useFriends() {
  const { session } = useAuth();

  return useQuery({
    queryKey: friendsKeys.list(),
    queryFn: () => friendsService.getFriends(),
    enabled: !!session?.user,
    staleTime: 120_000,
  });
}

/**
 * Get pending friend requests (received)
 */
export function usePendingFriendRequests() {
  const { session } = useAuth();

  return useQuery({
    queryKey: friendsKeys.pending(),
    queryFn: () => friendsService.getPendingRequests(),
    enabled: !!session?.user,
    staleTime: 120_000,
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
    onError: (error: Error) => {
      console.error("[useSendFriendRequest] Failed:", error.message);
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
    onError: (error: Error) => {
      console.error("[useAcceptFriendRequest] Failed:", error.message);
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
    onError: (error: Error) => {
      console.error("[useDeclineFriendRequest] Failed:", error.message);
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
    onError: (error: Error) => {
      console.error("[useRemoveFriend] Failed:", error.message);
    },
  });
}
