// app/notifications.tsx
// Notifications inbox screen - Routes to V1 or V2 based on feature flag

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
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { LoadingScreen, EmptyState } from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TestIDs } from "@/constants/testIDs";
import { BellIcon, ChevronLeftIcon } from "react-native-heroicons/outline";
import { useFeatureFlags } from "@/lib/featureFlags";

// V2 Components
import {
  LoadingState,
  NotificationRow,
  NotificationFilters,
  NotificationHeader,
  SwipeHint,
  NotificationGroupHeader,
  groupNotificationsByTime,
  type NotificationFilterType,
  type NotificationData,
} from "@/components/v2";

export default function NotificationsScreen() {
  const { isV2, isLoading: flagsLoading } = useFeatureFlags();

  // Show loading while determining version
  if (flagsLoading) {
    return <LoadingScreen />;
  }

  // Route to appropriate version
  if (isV2) {
    return <NotificationsScreenV2 />;
  }

  return <NotificationsScreenV1 />;
}

// =============================================================================
// V2 NOTIFICATIONS SCREEN
// =============================================================================

function NotificationsScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeFilter, setActiveFilter] =
    React.useState<NotificationFilterType>("all");
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
    new Set(),
  );

  const { data: notifications, isLoading, refetch } = useNotifications();

  const { data: unreadCount } = useUnreadNotificationCount();
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();

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
    await refetch();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: NotificationData) => {
    if (!notification.read_at) {
      markRead.mutate(notification.id);
    }

    const data = notification.data as Record<string, unknown> | undefined;

    switch (notification.type) {
      case "challenge_invite_received":
      case "challenge_starting_soon":
      case "challenge_ending_soon":
      case "challenge_completed":
        if (data?.challenge_id) {
          router.push(`/challenge/${data.challenge_id}`);
        }
        break;
      case "friend_request_received":
      case "friend_request_accepted":
        router.push("/(tabs)/friends");
        break;
    }
  };

  const handleDismiss = (notificationId: string) => {
    setDismissedIds((prev) => new Set(prev).add(notificationId));
    markRead.mutate(notificationId);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
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
          onPress={() => router.back()}
          style={{ marginRight: 8, padding: 4 }}
        >
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <NotificationHeader
          unreadCount={unreadCount || 0}
          onMarkAllRead={handleMarkAllRead}
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
        {filteredNotifications.length === 0 ? (
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
              {activeFilter === "unread"
                ? "All caught up!"
                : "No notifications"}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              {activeFilter === "unread"
                ? "You've read all your notifications"
                : "Updates will appear here"}
            </Text>
          </View>
        ) : (
          <>
            {groupOrder.map((group) => {
              const groupNotifs = groupedNotifications[group];
              if (!groupNotifs || groupNotifs.length === 0) return null;

              return (
                <View key={group}>
                  <NotificationGroupHeader title={group} />
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      marginHorizontal: spacing.lg,
                      borderRadius: radius.xl,
                      overflow: "hidden",
                    }}
                  >
                    {groupNotifs.map((notification, index) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification as NotificationData}
                        onPress={() =>
                          handleNotificationPress(
                            notification as NotificationData,
                          )
                        }
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

// =============================================================================
// V1 NOTIFICATIONS SCREEN (Original)
// =============================================================================

function NotificationsScreenV1() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const { data: notifications, isLoading, refetch } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: any) => {
    if (!notification.read_at) {
      await markAsRead.mutateAsync(notification.id);
    }

    if (
      notification.type === "challenge_invite_received" &&
      notification.data?.challenge_id
    ) {
      router.push(`/challenge/${notification.data.challenge_id}`);
    } else if (notification.type === "friend_request_received") {
      router.push("/(tabs)/friends");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead.mutateAsync();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const unreadCount = notifications?.filter((n) => !n.read_at).length || 0;

  if (isLoading && !refreshing) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        testID={TestIDs.screens.notifications}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {unreadCount > 0 && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.lg,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
              }}
            >
              {unreadCount} unread
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: colors.primary.main,
                borderRadius: radius.button,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                opacity: markAllAsRead.isPending ? 0.7 : 1,
              }}
              onPress={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.xs,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.primary.main,
                }}
              >
                {markAllAsRead.isPending ? "Marking..." : "Mark all read"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {notifications && notifications.length === 0 && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: spacing["2xl"],
            }}
          >
            <BellIcon size={48} color={colors.textMuted} />
            <Text
              style={{
                fontSize: typography.fontSize.lg,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                marginTop: spacing.md,
              }}
            >
              No notifications
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
                marginTop: spacing.xs,
              }}
            >
              You're all caught up!
            </Text>
          </View>
        )}

        {notifications?.map((notification) => {
          const isUnread = !notification.read_at;
          return (
            <TouchableOpacity
              key={notification.id}
              onPress={() => handleNotificationPress(notification)}
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: isUnread
                    ? colors.primary.subtle
                    : colors.surface,
                  borderRadius: radius.card,
                  padding: spacing.lg,
                  marginBottom: spacing.sm,
                  borderLeftWidth: isUnread ? 3 : 0,
                  borderLeftColor: colors.primary.main,
                  ...shadows.card,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.base,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: colors.textPrimary,
                      flex: 1,
                    }}
                  >
                    {notification.title}
                  </Text>
                  {isUnread && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.primary.main,
                        marginLeft: spacing.sm,
                      }}
                    />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textSecondary,
                    marginBottom: spacing.sm,
                  }}
                >
                  {notification.body}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                  }}
                >
                  {formatTimeAgo(notification.created_at ?? "")}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
