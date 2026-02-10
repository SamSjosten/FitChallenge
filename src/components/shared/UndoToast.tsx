// src/components/shared/UndoToast.tsx
// Undo toast for archive/restore actions
// Shows at bottom of screen with 5-second countdown

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number; // ms, default 5000
  visible: boolean;
}

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
  visible,
}: UndoToastProps) {
  const { colors, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // Show toast
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration
      dismissTimerRef.current = setTimeout(() => {
        onDismiss();
      }, duration);
    } else {
      // Hide toast
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

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [visible, duration, onDismiss, translateY, opacity]);

  const handleUndo = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    onUndo();
  };

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: insets.bottom + spacing.md,
          marginHorizontal: spacing.lg,
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.lg,
          transform: [{ translateY }],
          opacity,
          // Subtle shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 8,
        },
      ]}
    >
      <View
        style={[styles.content, { paddingVertical: spacing.md, paddingHorizontal: spacing.lg }]}
      >
        <Text style={[styles.message, { color: colors.textPrimary }]}>{message}</Text>
        <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.undoButton, { color: colors.primary.main }]}>UNDO</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  undoButton: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginLeft: 16,
  },
});

export default UndoToast;
