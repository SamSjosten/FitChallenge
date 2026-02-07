// src/components/shared/ProgressBar.tsx
// Animated progress bar with variant colors

import React from "react";
import { View, Animated } from "react-native";
import { radius, useTheme } from "@/constants/theme";

export interface ProgressBarProps {
  progress: number; // 0-100
  variant?: "primary" | "energy" | "achievement";
  size?: "small" | "medium" | "large";
  animated?: boolean;
}

export function ProgressBar({
  progress,
  variant = "primary",
  size = "medium",
  animated = true,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const animatedWidth = React.useRef(new Animated.Value(0)).current;

  // Clamp progress to 0-100 range to prevent overflow
  const clampedProgress = Math.min(100, Math.max(0, progress));

  React.useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: clampedProgress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress, animated]);

  const getVariantColor = () => {
    switch (variant) {
      case "energy":
        return { bg: colors.energy.subtle, fill: colors.energy.main };
      case "achievement":
        return { bg: colors.achievement.subtle, fill: colors.achievement.main };
      default:
        return { bg: colors.primary.subtle, fill: colors.primary.main };
    }
  };

  const getHeight = () => {
    switch (size) {
      case "small":
        return 4;
      case "large":
        return 8;
      default:
        return 6;
    }
  };

  const variantColor = getVariantColor();
  const height = getHeight();

  return (
    <View
      style={{
        height,
        backgroundColor: variantColor.bg,
        borderRadius: radius.progressBar,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          backgroundColor: variantColor.fill,
          borderRadius: radius.progressBar,
          width: animatedWidth.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}
