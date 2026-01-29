// src/components/v2/StreakBanner.tsx
// Animated streak banner with swipe-to-dismiss
// Design System v2.0 - Based on prototype

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FireIcon } from "react-native-heroicons/solid";
import { useAppTheme } from "@/providers/ThemeProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 60; // Reduced for easier swipe
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

  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Flame animation
  const flameScale = useRef(new Animated.Value(1)).current;
  const flameRotation = useRef(new Animated.Value(0)).current;

  // Gradient animation phase
  const [gradientPhase, setGradientPhase] = useState(0);

  // Check if dismissed today on mount
  useEffect(() => {
    checkDismissedToday();
  }, []);

  // Animate gradient colors
  useEffect(() => {
    if (!isVisible || isDismissedToday) return;

    const interval = setInterval(() => {
      setGradientPhase((prev) => prev + 0.02);
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible, isDismissedToday]);

  // Animate flame breathing
  useEffect(() => {
    if (!isVisible || isDismissedToday) return;

    const breatheAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(flameRotation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(flameRotation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    breatheAnimation.start();

    return () => breatheAnimation.stop();
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

  const handleUndo = () => {
    clearDismissedToday();
    setIsDismissedToday(false);
    setIsVisible(true);
    translateX.setValue(0);
    opacity.setValue(1);
    scale.setValue(1);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    saveDismissedToday();
    onDismiss?.();

    // Show undo toast
    if (showUndoToast) {
      showUndoToast(handleUndo);
    }
  };

  // Use ref for dismiss handler to avoid stale closure in panResponder
  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping left (negative) or right (positive)
        translateX.setValue(gestureState.dx);

        // Calculate opacity based on swipe distance
        const newOpacity = 1 - Math.abs(gestureState.dx) / (SCREEN_WIDTH * 0.5);
        opacity.setValue(Math.max(0, newOpacity));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
          // Determine direction and animate off screen
          const direction = gestureState.dx > 0 ? 1 : -1;
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: direction * SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            handleDismissRef.current();
          });
        } else {
          // Spring back
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              friction: 5,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  // Calculate gradient colors based on phase
  const hue1 = 25 + Math.sin(gradientPhase) * 15; // Orange range
  const hue2 = 5 + Math.cos(gradientPhase) * 15; // Red-orange range

  // Convert HSL to hex approximation for gradient
  const getGradientColors = (): [string, string] => {
    // Simplified: oscillate between energy colors
    const intensity = (Math.sin(gradientPhase) + 1) / 2;
    return [
      colors.energy.main, // #FFB800
      intensity > 0.5 ? colors.energy.dark : "#F97316", // Oscillate end color
    ];
  };

  const flameRotationInterpolate = flameRotation.interpolate({
    inputRange: [-3, 0, 1, 3],
    outputRange: ["-10deg", "0deg", "5deg", "10deg"],
  });

  if (!isVisible || isDismissedToday) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX }, { scale }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={getGradientColors()}
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
        <View style={styles.content}>
          {/* Flame Icon with Animation */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: flameScale },
                  { rotate: flameRotationInterpolate },
                ],
              },
            ]}
          >
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
          <Text style={styles.swipeHintText}>← Swipe to dismiss</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  gradient: {
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  },
  swipeHintText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
  },
});

export default StreakBanner;
