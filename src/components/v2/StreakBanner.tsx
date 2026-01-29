// src/components/v2/StreakBanner.tsx
// Animated streak banner with swipe-to-dismiss and shimmer effect
// Design System v2.0 - Uses react-native-gesture-handler for ScrollView compatibility

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { FireIcon } from "react-native-heroicons/solid";
import { useAppTheme } from "@/providers/ThemeProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 80;
const STORAGE_KEY = "fitchallenge_streak_banner_dismissed";

export interface StreakBannerProps {
  streak: number;
  onDismiss?: () => void;
  showUndoToast?: (onUndo: () => void) => void;
}

export function StreakBanner({
  streak,
  onDismiss,
  showUndoToast,
}: StreakBannerProps) {
  const { colors, spacing, radius } = useAppTheme();
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissedToday, setIsDismissedToday] = useState(false);

  // Animation values using Reanimated
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // Flame animation
  const flameScale = useSharedValue(1);
  const flameRotation = useSharedValue(0);

  // Shimmer animation - moves from left to right
  const shimmerTranslate = useSharedValue(-SCREEN_WIDTH);

  // Check if dismissed today on mount
  useEffect(() => {
    checkDismissedToday();
  }, []);

  // Animate shimmer effect - sweeps across the banner
  useEffect(() => {
    if (!isVisible || isDismissedToday) return;

    // Shimmer animation: move from left (-SCREEN_WIDTH) to right (SCREEN_WIDTH)
    // with a pause between sweeps
    shimmerTranslate.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH, {
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
        }),
        withDelay(
          2000, // Pause between shimmers
          withTiming(-SCREEN_WIDTH, { duration: 0 }),
        ),
      ),
      -1, // infinite
      false,
    );

    return () => {
      shimmerTranslate.value = -SCREEN_WIDTH;
    };
  }, [isVisible, isDismissedToday]);

  // Animate flame breathing using Reanimated
  useEffect(() => {
    if (!isVisible || isDismissedToday) return;

    flameScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1, // infinite
      false,
    );

    flameRotation.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 1000 }),
        withTiming(0, { duration: 1000 }),
      ),
      -1,
      false,
    );

    return () => {
      flameScale.value = 1;
      flameRotation.value = 0;
    };
  }, [isVisible, isDismissedToday]);

  const checkDismissedToday = async () => {
    try {
      const dismissedDate = await AsyncStorage.getItem(STORAGE_KEY);
      const today = new Date().toDateString();
      if (dismissedDate === today) {
        setIsDismissedToday(true);
        setIsVisible(false);
      }
    } catch (error) {
      console.error("Failed to check dismissed state:", error);
    }
  };

  const saveDismissedToday = async () => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(STORAGE_KEY, today);
    } catch (error) {
      console.error("Failed to save dismissed state:", error);
    }
  };

  const clearDismissedToday = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear dismissed state:", error);
    }
  };

  const handleUndo = useCallback(() => {
    clearDismissedToday();
    setIsDismissedToday(false);
    setIsVisible(true);
    translateX.value = 0;
    opacity.value = 1;
    scale.value = 1;
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    saveDismissedToday();
    onDismiss?.();

    // Show undo toast
    if (showUndoToast) {
      showUndoToast(handleUndo);
    }
  }, [onDismiss, showUndoToast, handleUndo]);

  // Pan gesture using react-native-gesture-handler
  // This properly composes with ScrollView unlike PanResponder
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Only activate after 15px horizontal movement
    .failOffsetY([-25, 25]) // Fail if vertical exceeds 25px (let scroll take over)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      opacity.value = Math.max(
        0,
        1 - Math.abs(event.translationX) / (SCREEN_WIDTH * 0.5),
      );
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        // Animate off screen
        const direction = event.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(
          direction * SCREEN_WIDTH,
          { duration: 200 },
          () => {
            runOnJS(handleDismiss)();
          },
        );
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        // Spring back
        translateX.value = withSpring(0, { damping: 15 });
        opacity.value = withSpring(1, { damping: 15 });
      }
    });

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: flameScale.value },
      { rotate: `${flameRotation.value}deg` },
    ],
  }));

  // Shimmer overlay style - diagonal gradient that sweeps across
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
  }));

  if (!isVisible || isDismissedToday) {
    return null;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Base gradient */}
        <LinearGradient
          colors={[colors.energy.main, "#F97316"]} // #FFB800 to Orange
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            {
              borderRadius: radius.xl,
              padding: spacing.lg,
            },
          ]}
        >
          {/* Shimmer overlay */}
          <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
            <LinearGradient
              colors={[
                "transparent",
                "rgba(255, 255, 255, 0.3)",
                "rgba(255, 255, 255, 0.4)",
                "rgba(255, 255, 255, 0.3)",
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>

          <View style={styles.content}>
            {/* Flame Icon with Animation */}
            <Animated.View style={[styles.iconContainer, flameStyle]}>
              <View style={styles.glowBackground} />
              <FireIcon size={28} color="#FFFFFF" />
            </Animated.View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={styles.streakText}>{streak} Day Streak</Text>
              <Text style={styles.subtitleText}>
                Keep it going! Log activity today.
              </Text>
            </View>
          </View>

          {/* Swipe hint */}
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>← Swipe to dismiss →</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
    overflow: "hidden",
  },
  gradient: {
    overflow: "hidden",
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  shimmerGradient: {
    width: 100,
    height: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  glowBackground: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 0, 0.3)",
  },
  textContainer: {
    flex: 1,
    zIndex: 2,
  },
  streakText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subtitleText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  swipeHint: {
    marginTop: 8,
    alignItems: "center",
    zIndex: 2,
  },
  swipeHintText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
  },
});

export default StreakBanner;
