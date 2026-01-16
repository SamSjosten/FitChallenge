// app/notifications.tsx
// Notifications inbox screen - Design System v1.0

import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { router, Stack } from "expo-router";
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/hooks/useNotifications";
import { LoadingScreen, EmptyState } from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import { BellIcon } from "react-native-heroicons/outline";

export default function NotificationsScreen() {
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
        {/* Header with Mark All Read */}
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

        {/* Empty State */}
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

        {/* Notifications List */}
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
