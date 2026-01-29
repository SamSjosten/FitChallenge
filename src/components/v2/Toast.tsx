// src/components/v2/Toast.tsx
// Toast notification component
// Design System v2.0

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  onDismiss?: () => void;
  visible: boolean;
}

export function Toast({
  message,
  actionLabel,
  onAction,
  duration = 3000,
  onDismiss,
  visible,
}: ToastProps) {
  const { colors, spacing, radius } = useAppTheme();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, duration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const handleAction = () => {
    onAction?.();
    handleDismiss();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.textPrimary,
          borderRadius: radius.lg,
          transform: [{ translateY }],
          opacity,
          marginHorizontal: spacing.lg,
          padding: spacing.md,
        },
      ]}
    >
      <Text style={[styles.message, { color: colors.background }]}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={handleAction}>
          <Text style={[styles.action, { color: colors.primary.main }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Hook for managing toast state
export function useToast() {
  const [toast, setToast] = React.useState<{
    visible: boolean;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }>({
    visible: false,
    message: "",
  });

  const showToast = (
    message: string,
    options?: {
      actionLabel?: string;
      onAction?: () => void;
    },
  ) => {
    setToast({
      visible: true,
      message,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  action: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
});

export default Toast;
