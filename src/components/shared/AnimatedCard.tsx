// src/components/shared/AnimatedCard.tsx
// ============================================
// Animated Card Component
// ============================================
// A card wrapper with configurable entrance animations.
// Uses react-native-reanimated for smooth 60fps animations.
//
// Usage:
//   <AnimatedCard index={0} animation="fadeSlideUp">
//     <YourContent />
//   </AnimatedCard>

import React, { useEffect } from "react";
import { ViewStyle, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type AnimationType =
  | "fadeIn"
  | "fadeSlideUp"
  | "fadeSlideLeft"
  | "fadeSlideRight"
  | "scaleIn"
  | "none";

export interface AnimatedCardProps {
  /** Child content */
  children: React.ReactNode;

  /** Animation type */
  animation?: AnimationType;

  /** Index for staggered animations (delay = index * staggerDelay) */
  index?: number;

  /** Delay between staggered items in ms */
  staggerDelay?: number;

  /** Animation duration in ms */
  duration?: number;

  /** Whether to animate on mount (default: true) */
  animateOnMount?: boolean;

  /** Press handler for interactive cards */
  onPress?: () => void;

  /** Long press handler */
  onLongPress?: () => void;

  /** Container style */
  style?: ViewStyle;

  /** Whether to show shadow (default: true) */
  shadow?: boolean;

  /** Test ID */
  testID?: string;
}

// =============================================================================
// ANIMATION CONFIGURATIONS
// =============================================================================

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

const TIMING_CONFIG = {
  duration: 300,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AnimatedCard({
  children,
  animation = "fadeSlideUp",
  index = 0,
  staggerDelay = 50,
  duration = 300,
  animateOnMount = true,
  onPress,
  onLongPress,
  style,
  shadow = true,
  testID,
}: AnimatedCardProps) {
  const { colors, radius, shadows, spacing } = useTheme();

  // Animation progress (0 = hidden, 1 = visible)
  const progress = useSharedValue(animateOnMount ? 0 : 1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animateOnMount && animation !== "none") {
      const delay = index * staggerDelay;

      if (animation === "scaleIn") {
        progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
      } else {
        progress.value = withDelay(delay, withTiming(1, { duration }));
      }
    }
  }, [animateOnMount, animation, index, staggerDelay, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    let translateY = 0;
    let translateX = 0;
    let scaleValue = 1;
    let opacity = 1;

    switch (animation) {
      case "fadeIn":
        opacity = progress.value;
        break;

      case "fadeSlideUp":
        opacity = progress.value;
        translateY = interpolate(
          progress.value,
          [0, 1],
          [20, 0],
          Extrapolation.CLAMP,
        );
        break;

      case "fadeSlideLeft":
        opacity = progress.value;
        translateX = interpolate(
          progress.value,
          [0, 1],
          [30, 0],
          Extrapolation.CLAMP,
        );
        break;

      case "fadeSlideRight":
        opacity = progress.value;
        translateX = interpolate(
          progress.value,
          [0, 1],
          [-30, 0],
          Extrapolation.CLAMP,
        );
        break;

      case "scaleIn":
        opacity = progress.value;
        scaleValue = interpolate(
          progress.value,
          [0, 1],
          [0.9, 1],
          Extrapolation.CLAMP,
        );
        break;

      case "none":
      default:
        break;
    }

    // Apply press scale
    scaleValue *= scale.value;

    return {
      opacity,
      transform: [{ translateX }, { translateY }, { scale: scaleValue }],
    };
  });

  const handlePressIn = () => {
    if (onPress || onLongPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...(shadow ? shadows.card : {}),
  };

  const content = (
    <Animated.View style={[cardStyle, animatedStyle, style]} testID={testID}>
      {children}
    </Animated.View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// =============================================================================
// ANIMATED LIST HELPER
// =============================================================================

interface AnimatedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  animation?: AnimationType;
  staggerDelay?: number;
  style?: ViewStyle;
  itemStyle?: ViewStyle;
}

export function AnimatedList<T>({
  data,
  renderItem,
  keyExtractor,
  animation = "fadeSlideUp",
  staggerDelay = 50,
  style,
  itemStyle,
}: AnimatedListProps<T>) {
  const { spacing } = useTheme();

  return (
    <Animated.View style={[styles.list, { gap: spacing.md }, style]}>
      {data.map((item, index) => (
        <AnimatedCard
          key={keyExtractor(item, index)}
          index={index}
          animation={animation}
          staggerDelay={staggerDelay}
          style={itemStyle}
          shadow={false}
        >
          {renderItem(item, index)}
        </AnimatedCard>
      ))}
    </Animated.View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  list: {
    flexDirection: "column",
  },
});

export default AnimatedCard;
