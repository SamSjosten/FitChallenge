// app/notifications.tsx
// Notifications inbox screen

import React from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { Card, LoadingScreen, EmptyState, Button } from "@/components/ui";

export default function NotificationsScreen() {
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
    // Mark as read if unread
    if (!notification.read_at) {
      await markAsRead.mutateAsync(notification.id);
    }

    // Navigate based on notification type
    if (
      notification.type === "challenge_invite_received" &&
      notification.data?.challenge_id
    ) {
      router.push(`/challenge/${notification.data.challenge_id}`);
    } else if (notification.type === "friend_request_received") {
      router.push("/friends");
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
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header with Mark All Read */}
        {unreadCount > 0 && (
          <View style={styles.header}>
            <Text style={styles.unreadText}>{unreadCount} unread</Text>
            <Button
              title="Mark all read"
              variant="outline"
              size="small"
              onPress={handleMarkAllAsRead}
              loading={markAllAsRead.isPending}
            />
          </View>
        )}

        {/* Empty State */}
        {notifications && notifications.length === 0 && (
          <EmptyState
            title="No notifications"
            message="You're all caught up!"
          />
        )}

        {/* Notifications List */}
        {notifications?.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            onPress={() => handleNotificationPress(notification)}
            activeOpacity={0.7}
          >
            <Card
              style={[
                styles.notificationCard,
                !notification.read_at && styles.unreadCard,
              ]}
            >
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>
                  {notification.title}
                </Text>
                {!notification.read_at && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              <Text style={styles.notificationTime}>
                {formatTimeAgo(notification.created_at)}
              </Text>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

// Helper function to format relative time
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  unreadText: {
    fontSize: 14,
    color: "#666",
  },
  notificationCard: {
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: "#F0F8FF",
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: "#999",
  },
});
