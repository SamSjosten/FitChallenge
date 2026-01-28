// src/components/shared/ProgressRing.tsx
// ============================================
// Progress Ring Component
// ============================================
// Circular progress indicator with animated fill.
// Supports multiple sizes and custom colors.
//
// Usage:
//   <ProgressRing progress={0.75} size={100} strokeWidth={8} />

import React, { useEffect } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type ProgressRingSize = "sm" | "md" | "lg" | "xl" | number;

export interface ProgressRingProps {
  /** Progress value from 0 to 1 */
  progress: number;

  /** Ring size (preset or custom number) */
  size?: ProgressRingSize;

  /** Stroke width (auto-calculated if not provided) */
  strokeWidth?: number;

  /** Progress color (uses primary by default) */
  color?: string;

  /** Background track color */
  trackColor?: string;

  /** Whether to animate progress changes */
  animated?: boolean;

  /** Animation duration in ms */
  animationDuration?: number;

  /** Show percentage text in center */
  showPercentage?: boolean;

  /** Custom center content */
  children?: React.ReactNode;

  /** Container style */
  style?: ViewStyle;

  /** Test ID */
  testID?: string;
}

// =============================================================================
// SIZE PRESETS
// =============================================================================

const SIZE_PRESETS: Record<string, number> = {
  sm: 48,
  md: 64,
  lg: 96,
  xl: 128,
};

const getSize = (size: ProgressRingSize): number => {
  if (typeof size === "number") return size;
  return SIZE_PRESETS[size] || SIZE_PRESETS.md;
};

const getStrokeWidth = (size: number, customWidth?: number): number => {
  if (customWidth) return customWidth;
  // Auto-calculate based on size
  if (size <= 48) return 4;
  if (size <= 64) return 6;
  if (size <= 96) return 8;
  return 10;
};

// =============================================================================
// ANIMATED CIRCLE
// =============================================================================

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// =============================================================================
// COMPONENT
// =============================================================================

export function ProgressRing({
  progress,
  size = "md",
  strokeWidth,
  color,
  trackColor,
  animated = true,
  animationDuration = 500,
  showPercentage = false,
  children,
  style,
  testID,
}: ProgressRingProps) {
  const { colors, typography, spacing } = useTheme();

  const sizeValue = getSize(size);
  const stroke = getStrokeWidth(sizeValue, strokeWidth);
  const radius = (sizeValue - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = sizeValue / 2;

  const progressColor = color ?? colors.primary.main;
  const bgTrackColor = trackColor ?? colors.primary.subtle;

  // Clamp progress to 0-1
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  // Animated value
  const animatedProgress = useSharedValue(animated ? 0 : clampedProgress);

  useEffect(() => {
    if (animated) {
      animatedProgress.value = withTiming(clampedProgress, {
        duration: animationDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else {
      animatedProgress.value = clampedProgress;
    }
  }, [clampedProgress, animated, animationDuration]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset,
    };
  });

  const percentage = Math.round(clampedProgress * 100);

  return (
    <View
      style={[styles.container, { width: sizeValue, height: sizeValue }, style]}
      testID={testID}
    >
      <Svg width={sizeValue} height={sizeValue}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Background track */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={bgTrackColor}
            strokeWidth={stroke}
            fill="none"
          />

          {/* Progress arc */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={progressColor}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Center content */}
      <View style={[styles.centerContent, StyleSheet.absoluteFill]}>
        {children ? (
          children
        ) : showPercentage ? (
          <Text
            style={[
              styles.percentageText,
              {
                color: colors.textPrimary,
                fontSize: sizeValue * 0.22,
                fontWeight: typography.fontWeight.bold as any,
              },
            ]}
          >
            {percentage}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// =============================================================================
// PROGRESS RING WITH LABEL
// =============================================================================

export interface ProgressRingWithLabelProps extends ProgressRingProps {
  /** Label text below the ring */
  label?: string;

  /** Value text (e.g., "7,500 / 10,000") */
  valueText?: string;
}

export function ProgressRingWithLabel({
  label,
  valueText,
  ...ringProps
}: ProgressRingWithLabelProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={styles.labelContainer}>
      <ProgressRing {...ringProps} />

      {valueText && (
        <Text
          style={[
            styles.valueText,
            {
              color: colors.textPrimary,
              fontSize: typography.fontSize.base,
              fontWeight: typography.fontWeight.semibold as any,
              marginTop: spacing.sm,
            },
          ]}
        >
          {valueText}
        </Text>
      )}

      {label && (
        <Text
          style={[
            styles.labelText,
            {
              color: colors.textSecondary,
              fontSize: typography.fontSize.sm,
              marginTop: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// MINI PROGRESS INDICATOR (inline usage)
// =============================================================================

export interface MiniProgressProps {
  progress: number;
  color?: string;
  size?: number;
}

export function MiniProgress({
  progress,
  color,
  size = 20,
}: MiniProgressProps) {
  const { colors } = useTheme();

  return (
    <ProgressRing
      progress={progress}
      size={size}
      strokeWidth={3}
      color={color ?? colors.primary.main}
      animated={false}
    />
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  percentageText: {
    textAlign: "center",
  },
  labelContainer: {
    alignItems: "center",
  },
  valueText: {
    textAlign: "center",
  },
  labelText: {
    textAlign: "center",
  },
});

export default ProgressRing;
