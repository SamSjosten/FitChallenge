// src/components/v2/NotificationsScreen.tsx
// V2 Notifications Screen - Enhanced implementation with filters and swipe actions
//
// Architecture:
// - Hooks handle data consistency (optimistic updates, rollback)
// - This component handles user feedback (toast, loading states)

import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { BellIcon, ChevronLeftIcon } from "react-native-heroicons/outline";
import { LoadingState } from "./LoadingState";
import { NotificationRow } from "./NotificationRow";
import type { Notification } from "@/services/notifications";
import {
  NotificationFilters,
  NotificationHeader,
  SwipeHint,
  NotificationGroupHeader,
  groupNotificationsByTime,
  type NotificationFilterType,
} from "./NotificationFilters";

export function V2NotificationsScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeFilter, setActiveFilter] =
    React.useState<NotificationFilterType>("all");
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
    new Set(),
  );

  const {
    data: notifications,
    isLoading,
    isError: isQueryError,
    refetch,
  } = useNotifications();

  // Note: useUnreadNotificationCount is used for tab bar badge and background polling.
  // Within this screen, we derive counts from the notifications list for consistency
  // during optimistic updates.
  useUnreadNotificationCount(); // Keep subscription active for background polling
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();

  // Show toast on initial query error
  React.useEffect(() => {
    if (isQueryError) {
      showToast("Failed to load notifications", "error");
    }
  }, [isQueryError, showToast]);

  // Refresh on focus
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Filter notifications
  const filteredNotifications = React.useMemo(() => {
    if (!notifications) return [];

    let filtered = notifications.filter((n) => !dismissedIds.has(n.id));

    switch (activeFilter) {
      case "unread":
        filtered = filtered.filter((n) => !n.read_at);
        break;
      case "social":
        filtered = filtered.filter((n) =>
          ["friend_request_received", "friend_request_accepted"].includes(
            n.type,
          ),
        );
        break;
      case "challenges":
        filtered = filtered.filter((n) =>
          [
            "challenge_invite_received",
            "challenge_starting_soon",
            "challenge_ending_soon",
            "challenge_completed",
          ].includes(n.type),
        );
        break;
    }

    return filtered;
  }, [notifications, activeFilter, dismissedIds]);

  const groupedNotifications = React.useMemo(() => {
    return groupNotificationsByTime(filteredNotifications);
  }, [filteredNotifications]);

  const filterCounts = React.useMemo(() => {
    if (!notifications) return {};
    const nonDismissed = notifications.filter((n) => !dismissedIds.has(n.id));
    return {
      all: nonDismissed.length,
      unread: nonDismissed.filter((n) => !n.read_at).length,
      social: nonDismissed.filter((n) =>
        ["friend_request_received", "friend_request_accepted"].includes(n.type),
      ).length,
      challenges: nonDismissed.filter((n) =>
        [
          "challenge_invite_received",
          "challenge_starting_soon",
          "challenge_ending_soon",
          "challenge_completed",
        ].includes(n.type),
      ).length,
    };
  }, [notifications, dismissedIds]);

  const handleRefresh = async () => {
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
    // Mark as read with optimistic update - pass error callback for user feedback
    if (!notification.read_at) {
      markRead.mutate(notification.id, {
        onError: () => {
          showToast("Failed to mark as read", "error");
        },
      });
    }

    const data = notification.data;

    // V2 component navigates to V2 routes directly
    // Router fix in _layout.tsx handles edge cases (push notifications, deep links)
    switch (notification.type) {
      case "challenge_invite_received":
      case "challenge_starting_soon":
      case "challenge_ending_soon":
      case "challenge_completed":
        if (data?.challenge_id) {
          // Use object form for type-safe dynamic route navigation
          router.push({
            pathname: "/challenge/[id]",
            params: { id: data.challenge_id as string },
          });
        }
        break;
      case "friend_request_received":
      case "friend_request_accepted":
        router.push("/(tabs-v2)/friends");
        break;
      default:
        // Unknown notification type - no navigation
        break;
    }
  };

  const handleDismiss = (notificationId: string) => {
    // Optimistically dismiss from local state for instant feedback
    setDismissedIds((prev) => new Set(prev).add(notificationId));

    // Mark as read with error handling
    markRead.mutate(notificationId, {
      onError: () => {
        // Revert local dismiss state on error
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(notificationId);
          return next;
        });
        showToast("Failed to dismiss notification", "error");
      },
    });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onError: () => {
        showToast("Failed to mark all as read", "error");
      },
    });
  };

  if (isLoading && !notifications) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState variant="content" message="Loading notifications..." />
      </SafeAreaView>
    );
  }

  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
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
              // Fallback to home if no back history
              router.replace("/(tabs-v2)");
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

      {filteredNotifications.length > 0 && <SwipeHint />}

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
              {activeFilter === "all"
                ? "No notifications yet"
                : `No ${activeFilter} notifications`}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {activeFilter === "all"
                ? "When you receive notifications, they'll appear here"
                : "Try checking another filter"}
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
                        onDismiss={() => handleDismiss(notification.id)}
                        showBorder={index < groupNotifs.length - 1}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
