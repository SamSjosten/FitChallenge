// src/components/notifications/NotificationRow.tsx
// Swipeable notification row component
// Design System - Uses react-native-gesture-handler for ScrollView compatibility
//
// Phase 2 Implementation:
// - react-native-gesture-handler for proper ScrollView composition
// - react-native-reanimated for performant worklet-based animations
// - expo-haptics for tactile feedback on dismiss threshold
// - Pure gesture logic extracted to utils/gestureUtils.ts for testability

import React, { useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, PixelRatio } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  TrophyIcon,
  UserPlusIcon,
  BellIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
} from "react-native-heroicons/outline";
import {
  TrophyIcon as TrophySolid,
  UserPlusIcon as UserPlusSolid,
} from "react-native-heroicons/solid";
import type { Notification } from "@/services/notifications";
import { formatTimeAgo } from "@/lib/serverTime";

// Import pure gesture logic from utilities
import {
  shouldDismiss,
  clampTranslation,
  calculateFinalPosition,
  calculateSwipeThreshold,
  HORIZONTAL_ACTIVE_OFFSET,
  VERTICAL_FAIL_OFFSET,
  DISMISS_ANIMATION_DURATION,
  SPRING_DAMPING,
} from "@/utils/gestureUtils";

// =============================================================================
// CONSTANTS (device-specific, computed at module load)
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = calculateSwipeThreshold(PixelRatio.get());

// Re-export for backward compatibility (tests may import from here)
export {
  shouldDismiss,
  clampTranslation,
  calculateFinalPosition,
  HORIZONTAL_ACTIVE_OFFSET,
  VERTICAL_FAIL_OFFSET,
};
export { SWIPE_THRESHOLD };

/**
 * Triggers haptic feedback for dismiss confirmation
 */
export function triggerDismissHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

// =============================================================================
// NOTIFICATION TYPE HELPERS
// =============================================================================

// Internal type for icon/color helpers - matches valid notification types from DB
type NotificationType =
  | "challenge_invite_received"
  | "challenge_starting_soon"
  | "challenge_ending_soon"
  | "challenge_completed"
  | "friend_request_received"
  | "friend_request_accepted"
  | "achievement_unlocked"
  | "general";

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

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface NotificationRowProps {
  notification: Notification;
  onPress?: () => void;
  onDismiss?: () => void;
  showBorder?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NotificationRow({
  notification,
  onPress,
  onDismiss,
  showBorder = true,
}: NotificationRowProps) {
  const { colors, radius } = useAppTheme();
  const isRead = !!notification.read_at;
  const isArchived = !!notification.dismissed_at;

  // Animation values using Reanimated
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0); // Start at 0 for fade-in
  const hapticTriggered = useSharedValue(false);

  // Use ref to avoid stale closure in gesture callback
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Reset position when notification changes (for virtualized list reuse)
  useEffect(() => {
    translateX.value = 0;
    hapticTriggered.value = false;
  }, [notification.id, translateX, hapticTriggered]);

  // FadeIn animation on mount
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
  }, [opacity]);

  // Callback to invoke onDismiss (must be called via runOnJS from worklet)
  const handleDismiss = useCallback(() => {
    onDismissRef.current?.();
  }, []);

  // Callback for haptic feedback (must be called via runOnJS from worklet)
  const fireHaptic = useCallback(() => {
    triggerDismissHaptic();
  }, []);

  // Pan gesture using react-native-gesture-handler
  // This properly composes with ScrollView unlike PanResponder
  const panGesture = Gesture.Pan()
    .activeOffsetX([-HORIZONTAL_ACTIVE_OFFSET, HORIZONTAL_ACTIVE_OFFSET])
    .failOffsetY([-VERTICAL_FAIL_OFFSET, VERTICAL_FAIL_OFFSET])
    .onUpdate((event) => {
      "worklet";
      // Use exported pure function for clamping
      translateX.value = clampTranslation(event.translationX);

      // Trigger haptic when crossing threshold (once per gesture)
      if (shouldDismiss(event.translationX, SWIPE_THRESHOLD) && !hapticTriggered.value) {
        hapticTriggered.value = true;
        runOnJS(fireHaptic)();
      }
    })
    .onEnd((event) => {
      "worklet";
      // Use exported pure function for dismiss decision
      const result = calculateFinalPosition(event.translationX, SWIPE_THRESHOLD, SCREEN_WIDTH);

      if (result.shouldDismiss) {
        // Animate off screen then call dismiss
        translateX.value = withTiming(
          result.position,
          { duration: DISMISS_ANIMATION_DURATION },
          (finished) => {
            "worklet";
            if (finished) {
              runOnJS(handleDismiss)();
            }
          },
        );
      } else {
        // Spring back to original position
        translateX.value = withSpring(0, { damping: SPRING_DAMPING });
        hapticTriggered.value = false;
      }
    });

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Background opacity based on swipe distance
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Background color depends on whether this is archive or restore action
  const backgroundColor = isArchived ? colors.primary.main : colors.error;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Action background - reveals as user swipes */}
      <Animated.View style={[styles.actionBackground, { backgroundColor }, backgroundStyle]}>
        <ArchiveBoxIcon size={24} color="#FFFFFF" />
      </Animated.View>

      {/* Notification content - swipeable */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.contentContainer, { backgroundColor: colors.surface }, contentStyle]}
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
                  backgroundColor: getNotificationIconBg(notification.type as NotificationType),
                  borderRadius: radius.md,
                },
              ]}
            >
              {getNotificationIcon(notification.type as NotificationType, isRead)}
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
              <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
                {notification.body}
              </Text>
            </View>

            {/* Time & unread indicator */}
            <View style={styles.metaContainer}>
              <Text style={[styles.time, { color: colors.textMuted }]}>
                {formatTimeAgo(notification.created_at)}
              </Text>
              {!isRead && (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary.main }]} />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// =============================================================================
// COMPACT VERSION (without swipe)
// =============================================================================

export interface NotificationRowCompactProps {
  notification: Notification;
  onPress?: () => void;
}

export function NotificationRowCompact({ notification, onPress }: NotificationRowCompactProps) {
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
            backgroundColor: getNotificationIconBg(notification.type as NotificationType),
            borderRadius: radius.sm,
          },
        ]}
      >
        {getNotificationIcon(notification.type as NotificationType, isRead)}
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
        <Text style={[styles.compactBody, { color: colors.textSecondary }]} numberOfLines={1}>
          {notification.body}
        </Text>
      </View>
      <Text style={[styles.compactTime, { color: colors.textMuted }]}>
        {formatTimeAgo(notification.created_at)}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  actionBackground: {
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
