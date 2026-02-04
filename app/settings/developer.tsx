// app/settings/developer.tsx
// Developer settings screen with feature flags and debug tools

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useFeatureFlags } from "@/lib/featureFlags";
import { getSupabaseClient } from "@/lib/supabase";

// Storage keys for debug reset
const STREAK_BANNER_STORAGE_KEY = "fitchallenge_streak_banner_dismissed";

export default function DeveloperSettingsScreen() {
  const { colors, spacing } = useAppTheme();
  const { uiVersion, isV2, setVersion, isLoading } = useFeatureFlags();
  const [resetting, setResetting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    currentStreak: number | null;
    bannerDismissedDate: string | null;
    userId: string | null;
  }>({ currentStreak: null, bannerDismissedDate: null, userId: null });
  const [loadingDebug, setLoadingDebug] = useState(false);

  const handleToggle = (value: boolean) => {
    setVersion(value ? "v2" : "v1");
  };

  // Fetch debug info on mount
  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const fetchDebugInfo = async () => {
    setLoadingDebug(true);
    try {
      const supabase = getSupabaseClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Get profile streak
      let currentStreak = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("current_streak")
          .eq("id", user.id)
          .single();
        currentStreak = profile?.current_streak ?? null;
      }

      // Get banner dismissed date
      const bannerDismissedDate = await AsyncStorage.getItem(
        STREAK_BANNER_STORAGE_KEY,
      );

      setDebugInfo({
        currentStreak,
        bannerDismissedDate,
        userId: user?.id ?? null,
      });
    } catch (error) {
      console.error("Failed to fetch debug info:", error);
    } finally {
      setLoadingDebug(false);
    }
  };

  const handleResetStreakBanner = async () => {
    setResetting(true);
    try {
      await AsyncStorage.removeItem(STREAK_BANNER_STORAGE_KEY);
      await fetchDebugInfo(); // Refresh debug info
      Alert.alert(
        "Success",
        "Streak banner reset. It will appear on the home screen if you have an active streak.",
      );
    } catch (error) {
      console.error("Failed to reset streak banner:", error);
      Alert.alert("Error", "Failed to reset streak banner state.");
    } finally {
      setResetting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Header */}
        <Text
          style={[
            styles.sectionHeader,
            { color: colors.textSecondary, marginBottom: spacing.md },
          ]}
        >
          FEATURE FLAGS
        </Text>

        {/* V2 UI Toggle */}
        <View
          style={[
            styles.settingRow,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Use V2 UI
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Enable the redesigned interface with new welcome flow, updated
              tabs, and improved visuals.
            </Text>
          </View>
          <Switch
            value={isV2}
            onValueChange={handleToggle}
            trackColor={{
              false: colors.border,
              true: colors.primary.main,
            }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Current Version Display */}
        <View
          style={[
            styles.infoRow,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginTop: spacing.sm,
            },
          ]}
        >
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Current Version
          </Text>
          <Text style={[styles.infoValue, { color: colors.primary.main }]}>
            {uiVersion?.toUpperCase() || "V1"}
          </Text>
        </View>

        {/* Info Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.primary.main + "15",
              borderRadius: 12,
              padding: spacing.md,
              marginTop: spacing.lg,
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.primary.main }]}>
            ℹ️ About V2 UI
          </Text>
          <Text
            style={[
              styles.infoText,
              { color: colors.textSecondary, marginTop: spacing.sm },
            ]}
          >
            The V2 interface includes:{"\n"}• New welcome & onboarding flow
            {"\n"}• Redesigned tab navigation{"\n"}• Health data sync setup
            {"\n"}• Improved challenge cards{"\n\n"}
            Toggle off to return to the classic interface.
          </Text>
        </View>

        {/* Debug Tools Section */}
        <Text
          style={[
            styles.sectionHeader,
            {
              color: colors.textSecondary,
              marginTop: spacing.xl,
              marginBottom: spacing.md,
            },
          ]}
        >
          DEBUG TOOLS
        </Text>

        {/* Debug Info Display */}
        <View
          style={[
            styles.debugInfoCard,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <Text style={[styles.debugInfoTitle, { color: colors.textPrimary }]}>
            Streak Banner Debug Info
          </Text>
          {loadingDebug ? (
            <Text
              style={[styles.debugInfoText, { color: colors.textSecondary }]}
            >
              Loading...
            </Text>
          ) : (
            <>
              <Text
                style={[styles.debugInfoText, { color: colors.textSecondary }]}
              >
                Current Streak:{" "}
                <Text
                  style={{
                    color:
                      debugInfo.currentStreak && debugInfo.currentStreak > 0
                        ? colors.primary.main
                        : colors.error,
                    fontWeight: "600",
                  }}
                >
                  {debugInfo.currentStreak ?? "N/A"}
                </Text>
                {debugInfo.currentStreak === 0 && " (banner won't show)"}
              </Text>
              <Text
                style={[styles.debugInfoText, { color: colors.textSecondary }]}
              >
                Banner Dismissed:{" "}
                <Text style={{ fontWeight: "600" }}>
                  {debugInfo.bannerDismissedDate ?? "Not dismissed"}
                </Text>
              </Text>
              <Text
                style={[
                  styles.debugInfoText,
                  { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
                ]}
              >
                User ID: {debugInfo.userId?.slice(0, 8)}...
              </Text>
            </>
          )}
          <TouchableOpacity
            onPress={fetchDebugInfo}
            style={{ marginTop: spacing.sm }}
          >
            <Text style={{ color: colors.primary.main, fontSize: 13 }}>
              ↻ Refresh
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reset Streak Banner */}
        <TouchableOpacity
          onPress={handleResetStreakBanner}
          disabled={resetting}
          style={[
            styles.debugButton,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              opacity: resetting ? 0.6 : 1,
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Reset Streak Banner
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Clears the "dismissed today" state so the streak banner will
              appear again on the home screen.
            </Text>
          </View>
          <Text style={[styles.actionText, { color: colors.primary.main }]}>
            {resetting ? "..." : "Reset"}
          </Text>
        </TouchableOpacity>

        {/* Warning */}
        <Text
          style={[
            styles.footerNote,
            {
              color: colors.textSecondary,
              marginTop: spacing.xl,
              textAlign: "center",
            },
          ]}
        >
          Changes take effect after signing out and back in.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoCard: {},
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  footerNote: {
    fontSize: 12,
  },
  debugButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  debugInfoCard: {},
  debugInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  debugInfoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
