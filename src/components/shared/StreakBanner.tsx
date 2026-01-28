// src/components/shared/StreakBanner.tsx
// ============================================
// Streak Banner Component
// ============================================
// Displays current streak with celebration animation.
// Supports swipe-to-dismiss gesture.
//
// Usage:
//   <StreakBanner
//     streak={7}
//     onDismiss={() => setShowBanner(false)}
//   />

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { FireIcon, XMarkIcon } from "react-native-heroicons/solid";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type StreakBannerVariant =
  | "default"
  | "milestone"
  | "recovered"
  | "broken";

export interface StreakBannerProps {
  /** Current streak count */
  streak: number;

  /** Banner variant */
  variant?: StreakBannerVariant;

  /** Callback when dismissed */
  onDismiss?: () => void;

  /** Whether to allow swipe-to-dismiss (default: true) */
  dismissible?: boolean;

  /** Custom message (overrides variant default) */
  message?: string;

  /** Whether to auto-dismiss after delay */
  autoDismiss?: boolean;

  /** Auto-dismiss delay in ms (default: 5000) */
  autoDismissDelay?: number;

  /** Test ID */
  testID?: string;
}

// =============================================================================
// VARIANT CONFIGURATIONS
// =============================================================================

interface VariantConfig {
  icon: typeof FireIcon;
  getMessage: (streak: number) => string;
  gradient: [string, string];
}

const getVariantConfig = (
  variant: StreakBannerVariant,
  colors: ReturnType<typeof useTheme>["colors"],
): VariantConfig => {
  const configs: Record<StreakBannerVariant, VariantConfig> = {
    default: {
      icon: FireIcon,
      getMessage: (streak) => `${streak} day streak! Keep it going!`,
      gradient: [colors.energy.main, "#F97316"],
    },
    milestone: {
      icon: FireIcon,
      getMessage: (streak) => `🎉 ${streak} days! Amazing milestone!`,
      gradient: [colors.achievement.main, "#8B5CF6"],
    },
    recovered: {
      icon: FireIcon,
      getMessage: (streak) => `Streak recovered! Back to ${streak} days!`,
      gradient: [colors.primary.main, colors.primary.dark],
    },
    broken: {
      icon: FireIcon,
      getMessage: () => "Streak broken. Start fresh today!",
      gradient: [colors.textSecondary, colors.textMuted],
    },
  };

  return configs[variant];
};

// =============================================================================
// CONSTANTS
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const DISMISS_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_VELOCITY_THRESHOLD = 500;

// =============================================================================
// COMPONENT
// =============================================================================

export function StreakBanner({
  streak,
  variant = "default",
  onDismiss,
  dismissible = true,
  message,
  autoDismiss = false,
  autoDismissDelay = 5000,
  testID,
}: StreakBannerProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const config = getVariantConfig(variant, colors);
  const IconComponent = config.icon;

  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const fireScale = useSharedValue(1);

  // Enter animation
  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });

    // Fire icon pulse animation
    fireScale.value = withDelay(
      300,
      withSequence(
        withSpring(1.2, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 10, stiffness: 200 }),
      ),
    );

    // Auto-dismiss
    if (autoDismiss && onDismiss) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      if (onDismiss) {
        runOnJS(onDismiss)();
      }
    });
  };

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      // Only allow right swipe
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (
        event.translationX > DISMISS_THRESHOLD ||
        event.velocityX > SWIPE_VELOCITY_THRESHOLD
      ) {
        // Dismiss
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          if (onDismiss) {
            runOnJS(onDismiss)();
          }
        });
      } else {
        // Snap back
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });

  // Tap to dismiss gesture
  const tapGesture = Gesture.Tap()
    .enabled(dismissible)
    .onEnd(() => {
      runOnJS(handleDismiss)();
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: interpolate(
      translateX.value,
      [0, SCREEN_WIDTH * 0.5],
      [opacity.value, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const fireIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  const displayMessage = message ?? config.getMessage(streak);

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.container,
          {
            marginHorizontal: spacing.lg,
            borderRadius: radius.card,
            padding: spacing.md,
            backgroundColor: config.gradient[0],
          },
          containerStyle,
        ]}
        testID={testID}
      >
        {/* Fire icon */}
        <Animated.View style={[styles.iconContainer, fireIconStyle]}>
          <IconComponent size={28} color="#FFFFFF" />
        </Animated.View>

        {/* Content */}
        <View style={[styles.content, { marginLeft: spacing.md }]}>
          <Text
            style={[
              styles.streakCount,
              {
                color: "#FFFFFF",
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold as any,
              },
            ]}
          >
            {streak > 0 ? `🔥 ${streak}` : "🔥"}
          </Text>
          <Text
            style={[
              styles.message,
              {
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: typography.fontSize.sm,
                marginTop: 2,
              },
            ]}
          >
            {displayMessage}
          </Text>
        </View>

        {/* Dismiss hint */}
        {dismissible && (
          <View style={[styles.dismissHint, { marginLeft: spacing.sm }]}>
            <XMarkIcon size={18} color="rgba(255, 255, 255, 0.6)" />
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// =============================================================================
// STREAK MILESTONE BANNER
// =============================================================================

const MILESTONES = [7, 14, 30, 50, 100, 365];

export function StreakMilestoneBanner({
  streak,
  onDismiss,
  ...props
}: Omit<StreakBannerProps, "variant">) {
  const isMilestone = MILESTONES.includes(streak);

  return (
    <StreakBanner
      streak={streak}
      variant={isMilestone ? "milestone" : "default"}
      onDismiss={onDismiss}
      {...props}
    />
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  streakCount: {
    // Styles applied inline
  },
  message: {
    // Styles applied inline
  },
  dismissHint: {
    opacity: 0.6,
  },
});

export default StreakBanner;
