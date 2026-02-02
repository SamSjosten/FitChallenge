// src/hooks/useNotifications.ts
// Notifications data hooks with React Query
//
// Architecture:
// - Hooks handle data consistency (optimistic updates, rollback)
// - Components handle user feedback (toast, loading states)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService, Notification } from "@/services/notifications";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationsKeys.all, "list"] as const,
  unreadCount: () => [...notificationsKeys.all, "unreadCount"] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Get all notifications
 */
export function useNotifications() {
  return useQuery({
    queryKey: notificationsKeys.list(),
    queryFn: () => notificationsService.getNotifications(),
  });
}

/**
 * Get unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: () => notificationsService.getUnreadCount(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Mark a notification as read
 *
 * Features:
 * - Optimistic update for instant UI feedback
 * - Automatic rollback on error
 * - Updates both list and unread count caches
 *
 * Usage:
 * ```tsx
 * const markRead = useMarkNotificationAsRead();
 * markRead.mutate(notificationId, {
 *   onError: () => showToast('Failed to mark as read', 'error'),
 * });
 * ```
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return await notificationsService.markAsRead(notificationId);
    },

    // Optimistic update - instant UI feedback
    onMutate: async (notificationId: string) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: notificationsKeys.list() });
      await queryClient.cancelQueries({
        queryKey: notificationsKeys.unreadCount(),
      });

      // Find THIS notification's previous state (not entire cache)
      // This enables surgical rollback that doesn't corrupt concurrent mutations
      const currentNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      // Only do optimistic update if we have cache data
      // Otherwise, let the mutation complete and onSettled will refetch
      if (!currentNotifications) {
        return { previousNotification: undefined, wasUnread: false };
      }

      const previousNotification = currentNotifications.find(
        (n) => n.id === notificationId,
      );
      const wasUnread = previousNotification && !previousNotification.read_at;

      // Optimistically update only this notification
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
              : n,
          ),
      );

      // Only decrement unread count if notification was actually unread
      if (wasUnread) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Return only what THIS mutation changed for surgical rollback
      return { previousNotification, wasUnread };
    },

    // Surgical rollback - restore only THIS notification, not entire cache
    // This prevents concurrent mutations from corrupting each other
    onError: (_error, notificationId, context) => {
      if (context?.previousNotification) {
        queryClient.setQueryData<Notification[]>(
          notificationsKeys.list(),
          (current) =>
            current?.map((n) =>
              n.id === notificationId ? context.previousNotification! : n,
            ),
        );
      }
      // Restore count only if we decremented it
      if (context?.wasUnread) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (current) => (current ?? 0) + 1,
        );
      }
    },

    // Refetch to ensure consistency after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(),
      });
    },
  });
}

/**
 * Mark all notifications as read
 *
 * Features:
 * - Optimistic update for instant UI feedback
 * - Automatic rollback on error
 * - Updates both list and unread count caches
 *
 * Usage:
 * ```tsx
 * const markAllRead = useMarkAllNotificationsAsRead();
 * markAllRead.mutate(undefined, {
 *   onError: () => showToast('Failed to mark all as read', 'error'),
 * });
 * ```
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),

    // Optimistic update - instant UI feedback
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationsKeys.list() });
      await queryClient.cancelQueries({
        queryKey: notificationsKeys.unreadCount(),
      });

      // Track which notifications THIS mutation will mark as read
      // This enables surgical rollback that doesn't corrupt concurrent mutations
      const currentNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      // Only do optimistic update if we have cache data
      // Otherwise, let the mutation complete and onSettled will refetch
      if (!currentNotifications) {
        return {
          unreadNotificationIds: new Set<string>(),
          previousUnreadCount: 0,
        };
      }

      const unreadNotificationIds = new Set(
        currentNotifications.filter((n) => !n.read_at).map((n) => n.id),
      );
      const previousUnreadCount = unreadNotificationIds.size;

      // Optimistically mark all as read
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) => old?.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      );

      // Optimistically set unread count to 0
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), 0);

      // Return only what THIS mutation changed for surgical rollback
      return { unreadNotificationIds, previousUnreadCount };
    },

    // Surgical rollback - restore only notifications THIS mutation marked as read
    // This prevents concurrent single-notification mutations from being corrupted
    onError: (_error, _variables, context) => {
      if (
        context?.unreadNotificationIds &&
        context.unreadNotificationIds.size > 0
      ) {
        // Restore only the notifications we marked as read
        queryClient.setQueryData<Notification[]>(
          notificationsKeys.list(),
          (current) =>
            current?.map((n) =>
              context.unreadNotificationIds.has(n.id)
                ? { ...n, read_at: null }
                : n,
            ),
        );
        // Restore the count
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (current) => (current ?? 0) + context.previousUnreadCount,
        );
      }
    },

    // Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(),
      });
    },
  });
}

// =============================================================================
// ARCHIVE/RESTORE MUTATIONS
// =============================================================================
// These are standard mutations with optimistic updates.
// Undo is handled by calling the reverse mutation (archive ↔ restore).
// No delayed commits, no pending state, no timeouts.

/**
 * Archive a notification
 * - Commits immediately to server
 * - Optimistic update for instant UI
 * - Automatic rollback on error
 */
export function useArchiveNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.archiveNotification(notificationId),

    onMutate: async (notificationId: string) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: notificationsKeys.list() });
      await queryClient.cancelQueries({
        queryKey: notificationsKeys.unreadCount(),
      });

      // Snapshot current state for rollback
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const previousUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      const notification = previousNotifications?.find(
        (n) => n.id === notificationId,
      );
      const wasUnread = notification && !notification.read_at;

      // Optimistic update: set read_at + dismissed_at
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: n.read_at ?? now, dismissed_at: now }
              : n,
          ),
      );

      // Decrement unread count if needed
      if (wasUnread) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      return { previousNotifications, previousUnreadCount };
    },

    onError: (_error, _notificationId, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          notificationsKeys.list(),
          context.previousNotifications,
        );
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(
          notificationsKeys.unreadCount(),
          context.previousUnreadCount,
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(),
      });
    },
  });
}

/**
 * Restore an archived notification
 * - Commits immediately to server
 * - Optimistic update for instant UI
 * - Automatic rollback on error
 */
export function useRestoreNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.restoreNotification(notificationId),

    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: notificationsKeys.list() });

      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      // Optimistic update: clear dismissed_at (keep read_at)
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === notificationId ? { ...n, dismissed_at: null } : n,
          ),
      );

      return { previousNotifications };
    },

    onError: (_error, _notificationId, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          notificationsKeys.list(),
          context.previousNotifications,
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
    },
  });
}
