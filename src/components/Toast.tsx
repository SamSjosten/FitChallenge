// src/components/Toast.tsx
// Minimal toast notification component
//
// Features:
// - Multiple variants (info, warning, error, success)
// - Auto-dismiss with configurable duration
// - Manual dismiss
// - Slide-in animation from bottom
// - Uses theme tokens

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  typography,
  spacing,
  radius,
  zIndex,
  animation,
  useTheme,
} from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type ToastVariant = "info" | "warning" | "error" | "success";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  visible: boolean;
  onDismiss: () => void;
  duration?: number; // Auto-dismiss after ms, 0 = no auto-dismiss
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Toast({
  message,
  variant = "info",
  visible,
  onDismiss,
  duration = 4000,
}: ToastProps) {
  const { colors, shadows: themeShadows } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: animation.presets.toastSlide.duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: animation.presets.toastSlide.duration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: animation.presets.toastSlide.duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: animation.presets.toastSlide.duration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  // Auto-dismiss
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  // Get variant colors
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          backgroundColor: colors.primary.main,
          textColor: colors.primary.contrast,
          iconColor: colors.primary.contrast,
        };
      case "warning":
        return {
          backgroundColor: colors.warning,
          textColor: "#FFFFFF",
          iconColor: "#FFFFFF",
        };
      case "error":
        return {
          backgroundColor: colors.error,
          textColor: "#FFFFFF",
          iconColor: "#FFFFFF",
        };
      case "info":
      default:
        return {
          backgroundColor: colors.info,
          textColor: "#FFFFFF",
          iconColor: "#FFFFFF",
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Get icon for variant
  const getIcon = () => {
    switch (variant) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✕";
      case "info":
      default:
        return "ℹ";
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
          bottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          backgroundColor: variantStyles.backgroundColor,
          ...themeShadows.elevated,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.content}
        onPress={onDismiss}
        activeOpacity={0.8}
      >
        <Text style={[styles.icon, { color: variantStyles.iconColor }]}>
          {getIcon()}
        </Text>
        <Text
          style={[styles.message, { color: variantStyles.textColor }]}
          numberOfLines={3}
        >
          {message}
        </Text>
        <Text style={[styles.dismiss, { color: variantStyles.textColor }]}>
          ✕
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: zIndex.toast,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.sm,
    fontWeight: "600",
  },
  message: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    lineHeight: typography.fontSize.sm * 1.4,
  },
  dismiss: {
    fontSize: 14,
    marginLeft: spacing.sm,
    opacity: 0.8,
    padding: spacing.xs,
  },
});

export default Toast;
