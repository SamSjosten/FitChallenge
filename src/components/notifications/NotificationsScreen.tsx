// src/components/notifications/NotificationsScreen.tsx
// Notifications Screen - Archive/Restore with Undo support
//
// Architecture:
// - Three tabs: Unread (default), All, Archived
// - Swipe left: Archive (Unread/All) or Restore (Archived)
// - Actions commit immediately; Undo calls the reverse mutation
// - Hooks handle data consistency with optimistic updates + rollback

import React from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationCount,
  useArchiveNotification,
  useRestoreNotification,
} from "@/hooks/useNotifications";
import { BellIcon, ChevronLeftIcon } from "react-native-heroicons/outline";
import { LoadingState } from "@/components/shared";
import { NotificationRow } from "./NotificationRow";
import { UndoToast } from "@/components/shared/UndoToast";
import type { Notification } from "@/services/notifications";
import {
  NotificationFilters,
  NotificationHeader,
  SwipeHint,
  NotificationGroupHeader,
  groupNotificationsByTime,
  type NotificationFilterType,
} from "./NotificationFilters";

export function NotificationsScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<NotificationFilterType>("unread"); // Default to unread

  // Undo toast state - stores what action was taken so we can reverse it
  const [undoState, setUndoState] = React.useState<{
    visible: boolean;
    message: string;
    notificationId: string | null;
    action: "archive" | "restore" | null;
  }>({ visible: false, message: "", notificationId: null, action: null });

  const { data: notifications, isLoading, isError: isQueryError, refetch } = useNotifications();

  useUnreadNotificationCount(); // Keep subscription active for background polling
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();
  const archiveMutation = useArchiveNotification();
  const restoreMutation = useRestoreNotification();

  // Show toast on initial query error
  React.useEffect(() => {
    if (isQueryError) {
      showToast("Failed to load notifications", "error");
    }
  }, [isQueryError, showToast]);

  // Dismiss undo toast when navigating away
  useFocusEffect(
    React.useCallback(() => {
      // On focus: refresh
      refetch();

      // On blur: dismiss undo toast (action already committed)
      return () => {
        setUndoState({
          visible: false,
          message: "",
          notificationId: null,
          action: null,
        });
      };
    }, [refetch]),
  );

  // Notification type categories
  const SOCIAL_TYPES = ["friend_request_received", "friend_request_accepted"];
  const CHALLENGE_TYPES = [
    "challenge_invite_received",
    "challenge_starting_soon",
    "challenge_ending_soon",
    "challenge_completed",
  ];

  // Filter notifications based on active tab
  const filteredNotifications = React.useMemo(() => {
    if (!notifications) return [];

    switch (activeFilter) {
      case "unread":
        // Unread AND not archived
        return notifications.filter((n) => !n.read_at && !n.dismissed_at);
      case "all":
        // All active (not archived)
        return notifications.filter((n) => !n.dismissed_at);
      case "social":
        // Social notifications (not archived)
        return notifications.filter((n) => !n.dismissed_at && SOCIAL_TYPES.includes(n.type));
      case "challenges":
        // Challenge notifications (not archived)
        return notifications.filter((n) => !n.dismissed_at && CHALLENGE_TYPES.includes(n.type));
      case "archived":
        // Only archived
        return notifications.filter((n) => n.dismissed_at);
      default:
        return notifications.filter((n) => !n.dismissed_at);
    }
  }, [notifications, activeFilter]);

  const groupedNotifications = React.useMemo(() => {
    return groupNotificationsByTime(filteredNotifications);
  }, [filteredNotifications]);

  // Calculate counts for filter badges
  const filterCounts = React.useMemo(() => {
    if (!notifications) return {};
    return {
      unread: notifications.filter((n) => !n.read_at && !n.dismissed_at).length,
      all: notifications.filter((n) => !n.dismissed_at).length,
      social: notifications.filter((n) => !n.dismissed_at && SOCIAL_TYPES.includes(n.type)).length,
      challenges: notifications.filter((n) => !n.dismissed_at && CHALLENGE_TYPES.includes(n.type))
        .length,
      archived: notifications.filter((n) => n.dismissed_at).length,
    };
  }, [notifications]);

  const handleRefresh = async () => {
    // Dismiss undo toast (action already committed)
    setUndoState({
      visible: false,
      message: "",
      notificationId: null,
      action: null,
    });

    setRefreshing(true);
    try {
      await refetch();
    } catch {
      showToast("Failed to refresh notifications", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read (not archive) on tap
    if (!notification.read_at) {
      markRead.mutate(notification.id, {
        onError: () => {
          showToast("Failed to mark as read", "error");
        },
      });
    }

    const data = notification.data;

    switch (notification.type) {
      case "challenge_invite_received":
      case "challenge_starting_soon":
      case "challenge_ending_soon":
      case "challenge_completed":
        if (data?.challenge_id) {
          router.push({
            pathname: "/challenge/[id]",
            params: { id: data.challenge_id as string },
          });
        }
        break;
      case "friend_request_received":
      case "friend_request_accepted":
        router.push("/(tabs)/friends");
        break;
      default:
        break;
    }
  };

  const handleSwipe = (notificationId: string) => {
    // Dismiss any existing undo toast
    setUndoState({
      visible: false,
      message: "",
      notificationId: null,
      action: null,
    });

    if (activeFilter === "archived") {
      // In Archived tab: restore immediately
      restoreMutation.mutate(notificationId, {
        onSuccess: () => {
          setUndoState({
            visible: true,
            message: "Restored",
            notificationId,
            action: "restore",
          });
        },
        onError: () => showToast("Failed to restore notification", "error"),
      });
    } else {
      // In Unread/All tabs: archive immediately
      archiveMutation.mutate(notificationId, {
        onSuccess: () => {
          setUndoState({
            visible: true,
            message: "Archived",
            notificationId,
            action: "archive",
          });
        },
        onError: () => showToast("Failed to archive notification", "error"),
      });
    }
  };

  const handleUndo = () => {
    if (!undoState.notificationId || !undoState.action) return;

    // Call the reverse mutation
    if (undoState.action === "archive") {
      // We archived → undo by restoring
      restoreMutation.mutate(undoState.notificationId, {
        onError: () => showToast("Failed to undo", "error"),
      });
    } else {
      // We restored → undo by archiving
      archiveMutation.mutate(undoState.notificationId, {
        onError: () => showToast("Failed to undo", "error"),
      });
    }

    setUndoState({
      visible: false,
      message: "",
      notificationId: null,
      action: null,
    });
  };

  const handleUndoDismiss = React.useCallback(() => {
    setUndoState({
      visible: false,
      message: "",
      notificationId: null,
      action: null,
    });
  }, []);

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onError: () => {
        showToast("Failed to mark all as read", "error");
      },
    });
  };

  // Get empty state message based on active filter
  const getEmptyStateMessage = () => {
    switch (activeFilter) {
      case "unread":
        return {
          title: "All caught up!",
          subtitle: "No unread notifications",
        };
      case "all":
        return {
          title: "No notifications yet",
          subtitle: "When you receive notifications, they'll appear here",
        };
      case "social":
        return {
          title: "No social notifications",
          subtitle: "Friend requests and updates will appear here",
        };
      case "challenges":
        return {
          title: "No challenge notifications",
          subtitle: "Challenge invites and updates will appear here",
        };
      case "archived":
        return {
          title: "No archived notifications",
          subtitle: "Swiped notifications will appear here",
        };
      default:
        return {
          title: "No notifications",
          subtitle: "",
        };
    }
  };

  if (isLoading && !notifications) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState variant="content" message="Loading notifications..." />
      </SafeAreaView>
    );
  }

  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];
  const emptyState = getEmptyStateMessage();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={{ marginRight: 8, padding: 4 }}
        >
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <NotificationHeader
          unreadCount={filterCounts.unread ?? 0}
          onMarkAllRead={handleMarkAllRead}
          isMarkingAll={markAllRead.isPending}
        />
      </View>

      <NotificationFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={filterCounts}
      />

      {filteredNotifications.length > 0 && <SwipeHint isArchiveTab={activeFilter === "archived"} />}

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* Error state */}
        {isQueryError && !notifications && (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 80,
              padding: spacing.xl,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              Something went wrong
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              Pull down to try again
            </Text>
          </View>
        )}

        {/* Empty state */}
        {!isQueryError && filteredNotifications.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 80,
              padding: spacing.xl,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.surfaceElevated,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <BellIcon size={32} color={colors.textMuted} />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              {emptyState.title}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {emptyState.subtitle}
            </Text>
          </View>
        ) : (
          <>
            {groupOrder.map((groupName) => {
              const groupNotifs = groupedNotifications[groupName];
              if (!groupNotifs || groupNotifs.length === 0) return null;

              return (
                <View key={groupName} style={{ paddingHorizontal: spacing.lg }}>
                  <NotificationGroupHeader title={groupName} />
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.xl,
                      overflow: "hidden",
                    }}
                  >
                    {groupNotifs.map((notification, index) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onPress={() => handleNotificationPress(notification)}
                        onDismiss={() => handleSwipe(notification.id)}
                        showBorder={index < groupNotifs.length - 1}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Bottom padding to account for undo toast */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Undo Toast */}
      <UndoToast
        visible={undoState.visible}
        message={undoState.message}
        onUndo={handleUndo}
        onDismiss={handleUndoDismiss}
        duration={5000}
      />
    </SafeAreaView>
  );
}
