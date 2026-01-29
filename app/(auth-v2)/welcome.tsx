// app/(auth-v2)/welcome.tsx
// V2 Welcome Screen - Hero splash with logo, tagline, and CTA buttons
//
// Flow: Welcome → Auth (signup/signin) → Onboarding → Home

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  TrophyIcon,
  UsersIcon,
  FireIcon,
  StarIcon,
} from "react-native-heroicons/solid";
import { Feather } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

// =============================================================================
// FEATURE ICONS CONFIG
// =============================================================================

type FeatureItem =
  | {
      type: "heroicon";
      icon: typeof UsersIcon;
      label: string;
      color: string;
      bgColor: string;
    }
  | {
      type: "feather";
      icon: string;
      label: string;
      color: string;
      bgColor: string;
    };

const welcomeFeatures: FeatureItem[] = [
  {
    type: "heroicon",
    icon: UsersIcon,
    label: "Social",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    type: "feather",
    icon: "target",
    label: "Goals",
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  {
    type: "heroicon",
    icon: FireIcon,
    label: "Streaks",
    color: "#F97316",
    bgColor: "#FFF7ED",
  },
  {
    type: "heroicon",
    icon: StarIcon,
    label: "Wins",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
];

// =============================================================================
// BACKGROUND CIRCLES
// =============================================================================

function BackgroundCircles() {
  return (
    <View style={styles.circlesContainer}>
      {[...Array(6)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.circle,
            {
              left: `${20 + (i % 3) * 30}%`,
              top: `${20 + Math.floor(i / 3) * 40}%`,
            },
          ]}
        />
      ))}
    </View>
  );
}

// =============================================================================
// FEATURE ICON COMPONENT
// =============================================================================

function FeatureIcon({ item }: { item: FeatureItem }) {
  if (item.type === "heroicon") {
    const IconComponent = item.icon;
    return <IconComponent size={18} color={item.color} />;
  } else {
    return <Feather name={item.icon as any} size={18} color={item.color} />;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function WelcomeScreenV2() {
  const { colors, shadows } = useAppTheme();
  const [isExiting, setIsExiting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;
  const exitScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation sequence
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Reset and replay animations when screen regains focus (e.g., back navigation)
  useFocusEffect(
    useCallback(() => {
      // Reset exit state
      setIsExiting(false);
      exitAnim.setValue(1);
      exitScaleAnim.setValue(1);

      // Reset entrance animations to initial values
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      cardFadeAnim.setValue(0);

      // Replay entrance animation sequence
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(cardFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, []),
  );

  const handleGetStarted = () => {
    setIsExiting(true);
    Animated.parallel([
      Animated.timing(exitAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(exitScaleAnim, {
        toValue: 1.05,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push("/(auth-v2)/auth?mode=signup");
    });
  };

  const handleSignIn = () => {
    setIsExiting(true);
    Animated.parallel([
      Animated.timing(exitAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push("/(auth-v2)/auth?mode=signin");
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: exitAnim,
          transform: [{ scale: exitScaleAnim }],
        },
      ]}
    >
      {/* Hero Top Section with Gradient */}
      <LinearGradient
        colors={["#34D399", "#10B981", "#0D9488"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <BackgroundCircles />

        {/* Logo and App Name */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.logoBox, shadows.float]}>
            <TrophyIcon size={48} color="#10B981" />
          </View>
          <Text style={styles.appName}>FitChallenge</Text>
        </Animated.View>
      </LinearGradient>

      {/* White Bottom Card */}
      <Animated.View
        style={[
          styles.bottomCard,
          { backgroundColor: colors.surface, opacity: cardFadeAnim },
        ]}
      >
        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          Your Fitness Journey,{"\n"}Together
        </Text>
        <Text style={[styles.subheadline, { color: colors.textSecondary }]}>
          Challenge friends, track your progress, and celebrate every win
        </Text>

        {/* Feature Icons */}
        <View style={styles.featuresRow}>
          {welcomeFeatures.map((item, i) => (
            <View key={i} style={styles.featureItem}>
              <View
                style={[styles.featureIcon, { backgroundColor: item.bgColor }]}
              >
                <FeatureIcon item={item} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.textMuted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Get Started Button */}
        <Pressable
          onPress={handleGetStarted}
          disabled={isExiting}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.primary.main,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              ...shadows.button,
            },
          ]}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>

        {/* Sign In Link */}
        <Pressable onPress={handleSignIn} style={styles.signInLink}>
          <Text style={[styles.signInText, { color: colors.textMuted }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.primary.main, fontWeight: "600" }}>
              Sign in
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827", // gray-900
  },
  heroSection: {
    flex: 1,
    minHeight: "55%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  circlesContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  circle: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    transform: [{ translateX: -64 }, { translateY: -64 }],
  },
  logoContainer: {
    alignItems: "center",
    zIndex: 10,
  },
  logoBox: {
    width: 96,
    height: 96,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  appName: {
    fontSize: 36,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
  },
  bottomCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: "center",
  },
  headline: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 32,
  },
  subheadline: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 22,
  },
  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 32,
  },
  featureItem: {
    alignItems: "center",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  featureLabel: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  primaryButton: {
    width: "100%",
    maxWidth: 320,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
  },
});
