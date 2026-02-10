// app/(auth)/onboarding.tsx
// V2 Onboarding / Health Sync screen - matches mock design
// Shows health platform selection with animated connecting state

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { useNavigationStore } from "@/stores/navigationStore";

// =============================================================================
// TYPES
// =============================================================================

type HealthPlatform = "apple" | "google" | "garmin" | null;
type ScreenPhase = "connect" | "connecting" | "success";

interface PlatformOption {
  id: HealthPlatform;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  available: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORMS: PlatformOption[] = [
  {
    id: "apple",
    name: "Apple Health",
    icon: "heart",
    gradientColors: ["#EC4899", "#EF4444"],
    available: Platform.OS === "ios",
  },
  {
    id: "google",
    name: "Google Fit",
    icon: "fitness",
    gradientColors: ["#3B82F6", "#22C55E"],
    available: Platform.OS === "android",
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    icon: "watch",
    gradientColors: ["#2563EB", "#1E40AF"],
    available: false,
  },
];

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

const ConnectingPulse = ({ active }: { active: boolean }) => {
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      ring1Anim.setValue(0);
      ring2Anim.setValue(0);
      return;
    }

    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const anim1 = createPulse(ring1Anim, 0);
    const anim2 = createPulse(ring2Anim, 500);

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [active]);

  const ring1Scale = ring1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const ring1Opacity = ring1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });
  const ring2Scale = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const ring2Opacity = ring2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={styles.pulseContainer}>
      <Ionicons name="link" size={18} color={active ? "#10B981" : "#A7F3D0"} />
      {active && (
        <>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: ring1Scale }],
                opacity: ring1Opacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRing2,
              {
                transform: [{ scale: ring2Scale }],
                opacity: ring2Opacity,
              },
            ]}
          />
        </>
      )}
    </View>
  );
};

const SuccessCheckmark = () => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-180deg", "0deg"],
  });

  return (
    <Animated.View
      style={[
        styles.successCircle,
        {
          transform: [{ scale: scaleAnim }, { rotate }],
        },
      ]}
    >
      <Ionicons name="checkmark" size={48} color="#FFFFFF" />
    </Animated.View>
  );
};

const DataPreview = () => {
  const [steps, setSteps] = useState(0);
  const [workouts, setWorkouts] = useState(0);
  const [calories, setCalories] = useState(0);

  useEffect(() => {
    const targetSteps = 8432;
    const targetWorkouts = 3;
    const targetCalories = 2150;
    const duration = 1500;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setSteps(Math.floor(targetSteps * eased));
      setWorkouts(Math.floor(targetWorkouts * eased));
      setCalories(Math.floor(targetCalories * eased));

      if (progress >= 1) clearInterval(interval);
    }, 16);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.dataPreview}>
      <Text style={styles.dataPreviewLabel}>Last 7 days from your device</Text>
      <View style={styles.dataGrid}>
        <View style={styles.dataItem}>
          <Ionicons name="footsteps" size={20} color="#3B82F6" />
          <Text style={styles.dataValue}>{steps.toLocaleString()}</Text>
          <Text style={styles.dataUnit}>steps</Text>
        </View>
        <View style={styles.dataItem}>
          <Ionicons name="fitness" size={20} color="#A855F7" />
          <Text style={styles.dataValue}>{workouts}</Text>
          <Text style={styles.dataUnit}>workouts</Text>
        </View>
        <View style={styles.dataItem}>
          <Ionicons name="flame" size={20} color="#F97316" />
          <Text style={styles.dataValue}>{calories.toLocaleString()}</Text>
          <Text style={styles.dataUnit}>calories</Text>
        </View>
      </View>
    </View>
  );
};

// =============================================================================
// PLATFORM SELECTOR
// =============================================================================

const PlatformSelector = ({
  selectedPlatform,
  onSelect,
}: {
  selectedPlatform: HealthPlatform;
  onSelect: (platform: HealthPlatform) => void;
}) => {
  return (
    <View style={styles.platformList}>
      {PLATFORMS.map((platform) => (
        <TouchableOpacity
          key={platform.id}
          style={[
            styles.platformItem,
            selectedPlatform === platform.id && styles.platformItemSelected,
            !platform.available && styles.platformItemDisabled,
          ]}
          onPress={() => platform.available && onSelect(platform.id)}
          disabled={!platform.available}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={platform.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.platformIcon}
          >
            <Ionicons name={platform.icon} size={20} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.platformInfo}>
            <Text style={styles.platformName}>{platform.name}</Text>
            <Text style={styles.platformStatus}>
              {platform.available ? "Available" : "Coming soon"}
            </Text>
          </View>
          {selectedPlatform === platform.id && (
            <View style={styles.platformCheck}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OnboardingScreen() {
  const { profile, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<ScreenPhase>("connect");
  const [selectedPlatform, setSelectedPlatform] = useState<HealthPlatform>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Navigation lock - prevents ProtectedRoute from interfering during transition
  const setAuthHandlingNavigation = useNavigationStore((state) => state.setAuthHandlingNavigation);

  // Breathing animation for icons
  const breatheAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase !== "connect") return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [phase]);

  const breatheScale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const markHealthSetupComplete = async () => {
    if (isUpdating || !profile?.id) return;

    setIsUpdating(true);
    try {
      await authService.markHealthSetupComplete();
      await refreshProfile?.();
    } catch (err) {
      console.error("[Onboarding] Failed to mark health setup:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Mark onboarding as completed in user_metadata.
   * This is checked by ProtectedRoute to determine if user needs onboarding.
   * @returns true if successful, false if failed
   */
  const markOnboardingComplete = async (): Promise<boolean> => {
    try {
      const { error } = await getSupabaseClient().auth.updateUser({
        data: { onboarding_completed: true },
      });
      if (error) {
        console.error("[Onboarding] Failed to update user metadata:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[Onboarding] Error updating metadata:", err);
      return false;
    }
  };

  const handleConnect = () => {
    if (!selectedPlatform) return;

    setPhase("connecting");

    // Simulate connection (replace with actual health kit integration)
    setTimeout(() => {
      setPhase("success");
    }, 2500);
  };

  const handleComplete = async () => {
    // Lock navigation to prevent ProtectedRoute from redirecting during transition
    setAuthHandlingNavigation(true);

    try {
      await markHealthSetupComplete();

      const success = await markOnboardingComplete();
      if (!success) {
        // Release lock and show error - don't navigate
        setAuthHandlingNavigation(false);
        Alert.alert("Something went wrong", "We couldn't save your progress. Please try again.", [
          { text: "OK" },
        ]);
        return;
      }

      // Success - navigate to tabs (lock will be cleared by tabs layout)
      router.replace("/(tabs)");
    } catch (err) {
      // Release lock on unexpected error
      setAuthHandlingNavigation(false);
      console.error("[Onboarding] handleComplete error:", err);
      Alert.alert("Something went wrong", "We couldn't save your progress. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const handleSkip = async () => {
    // Lock navigation to prevent ProtectedRoute from redirecting during transition
    setAuthHandlingNavigation(true);

    try {
      const success = await markOnboardingComplete();
      if (!success) {
        // Release lock and show error - don't navigate
        setAuthHandlingNavigation(false);
        Alert.alert("Something went wrong", "We couldn't save your progress. Please try again.", [
          { text: "OK" },
        ]);
        return;
      }

      // Success - navigate to tabs (lock will be cleared by tabs layout)
      router.replace("/(tabs)");
    } catch (err) {
      // Release lock on unexpected error
      setAuthHandlingNavigation(false);
      console.error("[Onboarding] handleSkip error:", err);
      Alert.alert("Something went wrong", "We couldn't save your progress. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  // =========================================================================
  // SUCCESS SCREEN
  // =========================================================================
  if (phase === "success") {
    return (
      <LinearGradient colors={["#ECFDF5", "#FFFFFF"]} style={styles.container}>
        <SafeAreaView style={styles.successContainer}>
          <View style={styles.successContent}>
            <SuccessCheckmark />

            <Text style={styles.successTitle}>You{"'"}re Connected!</Text>
            <Text style={styles.successSubtitle}>
              Your workouts and activity will sync automatically
            </Text>

            <DataPreview />

            <TouchableOpacity
              style={styles.letsGoButton}
              onPress={handleComplete}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.letsGoButtonText}>Let{"'"}s Go!</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // =========================================================================
  // CONNECT SCREEN
  // =========================================================================
  return (
    <LinearGradient
      colors={["#ECFDF5", "#F0FDF9", "#FFFFFF"]}
      locations={[0, 0.3, 1]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Skip Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* App Icons */}
          <View style={styles.iconsContainer}>
            <View style={styles.glowBackground} />

            <View style={styles.iconsRow}>
              <Animated.View
                style={[
                  styles.appIcon,
                  styles.appIconFit,
                  { transform: [{ scale: breatheScale }] },
                ]}
              >
                <Ionicons name="trophy" size={28} color="#FFFFFF" />
              </Animated.View>

              <ConnectingPulse active={phase === "connecting"} />

              <Animated.View
                style={[
                  styles.appIcon,
                  styles.appIconHealth,
                  { transform: [{ scale: breatheScale }] },
                ]}
              >
                <Ionicons name="heart" size={28} color="#FFFFFF" />
              </Animated.View>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Connect Your Health Data</Text>
          <Text style={styles.subtitle}>
            Sync workouts and steps automatically from your favorite app
          </Text>

          {/* Platform Selector */}
          <View style={styles.platformSelectorContainer}>
            <PlatformSelector selectedPlatform={selectedPlatform} onSelect={setSelectedPlatform} />
          </View>

          {/* Connect Button */}
          <TouchableOpacity
            style={[
              styles.connectButton,
              phase === "connecting" && styles.connectButtonConnecting,
              !selectedPlatform && styles.connectButtonDisabled,
            ]}
            onPress={handleConnect}
            disabled={phase === "connecting" || !selectedPlatform}
          >
            {phase === "connecting" ? (
              <View style={styles.connectingContent}>
                <Ionicons name="refresh" size={20} color="#9CA3AF" />
                <Text style={styles.connectingText}>Connecting...</Text>
              </View>
            ) : (
              <Text style={styles.connectButtonText}>Connect</Text>
            )}
          </TouchableOpacity>

          {/* Manual Option */}
          <TouchableOpacity onPress={handleSkip} style={styles.manualButton}>
            <Text style={styles.manualText}>I{"'"}ll track manually</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Note */}
        <View style={styles.footer}>
          <Text style={styles.privacyText}>🔒 Your health data stays private and secure</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },

  // Content
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: -32,
  },

  // Icons
  iconsContainer: {
    marginBottom: 32,
    position: "relative",
  },
  glowBackground: {
    position: "absolute",
    width: 200,
    height: 100,
    backgroundColor: "#A7F3D0",
    opacity: 0.4,
    borderRadius: 100,
    top: -20,
    left: -40,
    transform: [{ scaleX: 1.5 }],
  },
  iconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  appIconFit: {
    backgroundColor: "#10B981",
  },
  appIconHealth: {
    backgroundColor: "#EC4899",
  },

  // Pulse
  pulseContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  pulseRing2: {
    borderColor: "#6EE7B7",
  },

  // Title
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
    maxWidth: 280,
  },

  // Platform Selector
  platformSelectorContainer: {
    width: "100%",
    maxWidth: 320,
    marginBottom: 32,
  },
  platformList: {
    gap: 8,
  },
  platformItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  platformItemSelected: {
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  platformItemDisabled: {
    opacity: 0.5,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  platformInfo: {
    flex: 1,
    marginLeft: 12,
  },
  platformName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  platformStatus: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  platformCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },

  // Connect Button
  connectButton: {
    width: "100%",
    maxWidth: 320,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#10B981",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonConnecting: {
    backgroundColor: "#F3F4F6",
    shadowOpacity: 0,
  },
  connectButtonDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  connectingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectingText: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "600",
  },

  // Manual Button
  manualButton: {
    marginTop: 16,
    padding: 8,
  },
  manualText: {
    color: "#9CA3AF",
    fontSize: 14,
  },

  // Footer
  footer: {
    padding: 24,
    paddingBottom: 32,
  },
  privacyText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },

  // Success Screen
  successContainer: {
    flex: 1,
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 280,
  },

  // Data Preview
  dataPreview: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  dataPreviewLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 12,
  },
  dataGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  dataItem: {
    alignItems: "center",
  },
  dataValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  dataUnit: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  // Let's Go Button
  letsGoButton: {
    width: "100%",
    maxWidth: 320,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#10B981",
    alignItems: "center",
    marginTop: 32,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  letsGoButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
