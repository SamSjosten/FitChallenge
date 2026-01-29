// src/components/v2/NotificationRow.tsx
// Swipeable notification row component
// Design System v2.0 - Based on prototype

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  TrophyIcon,
  UserPlusIcon,
  BellIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import {
  TrophyIcon as TrophySolid,
  UserPlusIcon as UserPlusSolid,
} from "react-native-heroicons/solid";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 80;

export type NotificationType =
  | "challenge_invite_received"
  | "challenge_starting_soon"
  | "challenge_ending_soon"
  | "challenge_completed"
  | "friend_request_received"
  | "friend_request_accepted"
  | "achievement_unlocked"
  | "general";

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationRowProps {
  notification: NotificationData;
  onPress?: () => void;
  onDismiss?: () => void;
  showBorder?: boolean;
}

const getNotificationIcon = (type: NotificationType, isRead: boolean) => {
  const iconSize = 20;

  switch (type) {
    case "challenge_invite_received":
    case "challenge_starting_soon":
    case "challenge_ending_soon":
    case "challenge_completed":
      return isRead ? (
        <TrophyIcon size={iconSize} color="#8B5CF6" />
      ) : (
        <TrophySolid size={iconSize} color="#8B5CF6" />
      );
    case "friend_request_received":
    case "friend_request_accepted":
      return isRead ? (
        <UserPlusIcon size={iconSize} color="#10B981" />
      ) : (
        <UserPlusSolid size={iconSize} color="#10B981" />
      );
    case "achievement_unlocked":
      return <CheckCircleIcon size={iconSize} color="#F59E0B" />;
    default:
      return <BellIcon size={iconSize} color="#6B7280" />;
  }
};

const getNotificationIconBg = (type: NotificationType): string => {
  switch (type) {
    case "challenge_invite_received":
    case "challenge_starting_soon":
    case "challenge_ending_soon":
    case "challenge_completed":
      return "#EDE9FE"; // Purple
    case "friend_request_received":
    case "friend_request_accepted":
      return "#D1FAE5"; // Green
    case "achievement_unlocked":
      return "#FEF3C7"; // Yellow
    default:
      return "#F3F4F6"; // Gray
  }
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function NotificationRow({
  notification,
  onPress,
  onDismiss,
  showBorder = true,
}: NotificationRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isRead = !!notification.read_at;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swipe left
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe to dismiss
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDismiss?.();
          });
        } else {
          // Spring back
          Animated.spring(translateX, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      {/* Delete background */}
      <View
        style={[styles.deleteBackground, { backgroundColor: colors.error }]}
      >
        <XMarkIcon size={24} color="#FFFFFF" />
      </View>

      {/* Notification content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            backgroundColor: colors.surface,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={[
            styles.content,
            showBorder && {
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: getNotificationIconBg(notification.type),
                borderRadius: radius.md,
              },
            ]}
          >
            {getNotificationIcon(notification.type, isRead)}
          </View>

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.textPrimary,
                  fontWeight: isRead ? "500" : "600",
                },
              ]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text
              style={[styles.body, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {notification.body}
            </Text>
          </View>

          {/* Time & unread indicator */}
          <View style={styles.metaContainer}>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {formatTimeAgo(notification.created_at)}
            </Text>
            {!isRead && (
              <View
                style={[
                  styles.unreadDot,
                  { backgroundColor: colors.primary.main },
                ]}
              />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// Compact version without swipe
export interface NotificationRowCompactProps {
  notification: NotificationData;
  onPress?: () => void;
}

export function NotificationRowCompact({
  notification,
  onPress,
}: NotificationRowCompactProps) {
  const { colors, spacing, radius } = useAppTheme();
  const isRead = !!notification.read_at;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.compactContainer,
        {
          backgroundColor: isRead ? colors.surface : colors.primary.subtle,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
      ]}
    >
      <View
        style={[
          styles.compactIcon,
          {
            backgroundColor: getNotificationIconBg(notification.type),
            borderRadius: radius.sm,
          },
        ]}
      >
        {getNotificationIcon(notification.type, isRead)}
      </View>
      <View style={styles.compactTextContainer}>
        <Text
          style={[
            styles.compactTitle,
            {
              color: colors.textPrimary,
              fontWeight: isRead ? "500" : "600",
            },
          ]}
          numberOfLines={1}
        >
          {notification.title}
        </Text>
        <Text
          style={[styles.compactBody, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {notification.body}
        </Text>
      </View>
      <Text style={[styles.compactTime, { color: colors.textMuted }]}>
        {formatTimeAgo(notification.created_at)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  deleteBackground: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    backgroundColor: "#FFFFFF",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
  },
  body: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  metaContainer: {
    alignItems: "flex-end",
  },
  time: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },

  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  compactIcon: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  compactTextContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  compactTitle: {
    fontSize: 14,
  },
  compactBody: {
    fontSize: 12,
    marginTop: 1,
  },
  compactTime: {
    fontSize: 11,
  },
});

export default NotificationRow;
