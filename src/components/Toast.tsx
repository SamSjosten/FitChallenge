// src/components/Toast.tsx
// Unified toast notification component
//
// Features:
// - Multiple variants (info, warning, error, success, neutral)
// - Optional action button (e.g., "Undo")
// - Auto-dismiss with configurable duration
// - Manual dismiss
// - Slide-in animation from bottom
// - Uses theme tokens

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { typography, spacing, radius, zIndex, animation } from "@/constants/theme";
import { useAppTheme } from "@/providers/ThemeProvider";

// =============================================================================
// TYPES
// =============================================================================

export type ToastVariant = "info" | "warning" | "error" | "success" | "neutral";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  visible: boolean;
  onDismiss: () => void;
  duration?: number; // Auto-dismiss after ms, 0 = no auto-dismiss
  actionLabel?: string;
  onAction?: () => void;
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
  actionLabel,
  onAction,
}: ToastProps) {
  const { colors, shadows: themeShadows } = useAppTheme();
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
          icon: "✓",
        };
      case "warning":
        return {
          backgroundColor: colors.warning,
          textColor: "#FFFFFF",
          iconColor: "#FFFFFF",
          icon: "⚠",
        };
      case "error":
        return {
          backgroundColor: colors.error,
          textColor: "#FFFFFF",
          iconColor: "#FFFFFF",
          icon: "✕",
        };
      case "neutral":
        return {
          backgroundColor: colors.textPrimary,
          textColor: colors.background,
          iconColor: colors.background,
          icon: null,
        };
      case "info":
      default:
        return {
          backgroundColor: colors.info,
          textColor: "#FFFFFF",
          iconColor: "#FFFFFF",
          icon: "ℹ",
        };
    }
  };

  if (!visible) {
    return null;
  }

  const vs = getVariantStyles();
  const hasAction = !!(actionLabel && onAction);

  const containerStyle = [
    styles.container,
    {
      transform: [{ translateY }],
      opacity,
      bottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
      backgroundColor: vs.backgroundColor,
      ...themeShadows.elevated,
    },
  ];

  // When there's an action button, use explicit touch zones to avoid
  // nested TouchableOpacity event conflicts
  if (hasAction) {
    return (
      <Animated.View style={containerStyle}>
        <View style={styles.content}>
          {vs.icon && <Text style={[styles.icon, { color: vs.iconColor }]}>{vs.icon}</Text>}
          <Text style={[styles.message, { color: vs.textColor }]} numberOfLines={3}>
            {message}
          </Text>
          <TouchableOpacity
            onPress={() => {
              onAction!();
              onDismiss();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.actionButton, { color: vs.textColor }]}>{actionLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
            <Text style={[styles.dismiss, { color: vs.textColor }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // Simple toast: tap anywhere to dismiss
  return (
    <Animated.View style={containerStyle} pointerEvents="box-none">
      <TouchableOpacity style={styles.content} onPress={onDismiss} activeOpacity={0.8}>
        {vs.icon && <Text style={[styles.icon, { color: vs.iconColor }]}>{vs.icon}</Text>}
        <Text style={[styles.message, { color: vs.textColor }]} numberOfLines={3}>
          {message}
        </Text>
        <Text style={[styles.dismiss, { color: vs.textColor }]}>✕</Text>
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
  actionButton: {
    fontSize: typography.fontSize.sm,
    fontWeight: "700",
    marginLeft: spacing.sm,
    textDecorationLine: "underline",
    padding: spacing.xs,
  },
  dismiss: {
    fontSize: 14,
    marginLeft: spacing.sm,
    opacity: 0.8,
    padding: spacing.xs,
  },
});

export default Toast;
