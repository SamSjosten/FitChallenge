// app/settings/developer.tsx
// Developer settings screen with feature flags and debug tools

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "@/providers/ThemeProvider";
import { authService } from "@/services/auth";
import { useHealthConnection, useHealthSync } from "@/services/health";
import type { SyncStatus, HealthSyncLog } from "@/services/health";
import { formatTimeAgo } from "@/lib/serverTime";

// Storage keys for debug reset
const STREAK_BANNER_STORAGE_KEY = "fitchallenge_streak_banner_dismissed";

export default function DeveloperSettingsScreen() {
  const { colors, spacing } = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  // =========================================================================
  // STREAK BANNER DEBUG STATE (existing)
  // =========================================================================
  const [resetting, setResetting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    currentStreak: number | null;
    bannerDismissedDate: string | null;
    userId: string | null;
  }>({ currentStreak: null, bannerDismissedDate: null, userId: null });
  const [loadingDebug, setLoadingDebug] = useState(false);

  // =========================================================================
  // HEALTH DEBUG STATE
  // =========================================================================
  const {
    status: healthStatus,
    connection,
    lastSync,
    isLoading: healthLoading,
    isConnecting,
    isDisconnecting,
    isAvailable,
    disconnect,
    refresh: refreshConnection,
  } = useHealthConnection();

  const { sync, isSyncing, lastResult, syncHistory, isLoadingHistory, refreshHistory } =
    useHealthSync();

  const [resettingOnboarding, setResettingOnboarding] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const isConnected = healthStatus === "connected";
  const providerName = Platform.OS === "ios" ? "Apple Health" : "Google Fit";

  // =========================================================================
  // STREAK BANNER DEBUG (existing logic)
  // =========================================================================
  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const fetchDebugInfo = async () => {
    setLoadingDebug(true);
    try {
      const { currentStreak, userId } = await authService.getDebugInfo();
      const bannerDismissedDate = await AsyncStorage.getItem(STREAK_BANNER_STORAGE_KEY);

      setDebugInfo({
        currentStreak,
        bannerDismissedDate,
        userId,
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
      await fetchDebugInfo();
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

  // =========================================================================
  // HEALTH DEBUG ACTIONS
  // =========================================================================

  const handleManualSync = async () => {
    if (!isConnected) {
      Alert.alert("Not Connected", "Connect to health data first via Settings → Health Data.");
      return;
    }

    try {
      const result = await sync({ syncType: "manual" });
      const duration = result.duration ? `${result.duration}ms` : "N/A";
      Alert.alert(
        result.success ? "Sync Complete" : "Sync Completed with Issues",
        [
          `Processed: ${result.recordsProcessed}`,
          `Inserted: ${result.recordsInserted}`,
          `Deduplicated: ${result.recordsDeduplicated}`,
          `Duration: ${duration}`,
          result.errors.length > 0 ? `Errors: ${result.errors.length}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (error) {
      Alert.alert(
        "Sync Failed",
        error instanceof Error ? error.message : "Unknown error during sync",
      );
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Health Data",
      `This will disconnect ${providerName} and clear the health query cache. You can reconnect from Settings → Health Data or by resetting onboarding.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect();
              queryClient.removeQueries({ queryKey: ["health"] });
              Alert.alert("Disconnected", "Health data disconnected and cache cleared.");
            } catch (error) {
              Alert.alert("Error", error instanceof Error ? error.message : "Failed to disconnect");
            }
          },
        },
      ],
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      "Reset Onboarding",
      "This will set onboarding_completed to false, clear health_setup_completed_at, and redirect you to the onboarding flow. You will go through the health setup screen again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResettingOnboarding(true);
            try {
              await authService.resetOnboardingForCurrentUser();

              // updateUser() emits USER_UPDATED, which AuthProvider handles
              // by updating React state with the new session metadata.
              // Navigate — ProtectedRoute now sees onboarding_completed=false
              // and won't fight the redirect
              router.replace("/(auth)/onboarding");
            } catch (error) {
              Alert.alert(
                "Error",
                error instanceof Error ? error.message : "Failed to reset onboarding",
              );
            } finally {
              setResettingOnboarding(false);
            }
          },
        },
      ],
    );
  };

  const handleClearHealthCache = async () => {
    setClearingCache(true);
    try {
      queryClient.removeQueries({ queryKey: ["health"] });
      refreshConnection();
      refreshHistory();
      Alert.alert("Cache Cleared", "Health query cache cleared and refreshed.");
    } catch (error) {
      Alert.alert("Error", "Failed to clear health cache.");
    } finally {
      setClearingCache(false);
    }
  };

  // =========================================================================
  // HELPERS
  // =========================================================================

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Never";
    return formatTimeAgo(date);
  };

  const getSyncStatusLabel = (status: SyncStatus): { text: string; color: string } => {
    switch (status) {
      case "completed":
        return { text: "✅", color: colors.success };
      case "failed":
        return { text: "❌", color: colors.error };
      case "partial":
        return { text: "⚠️", color: colors.warning };
      default:
        return { text: "⏳", color: colors.textMuted };
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* =================================================================
            STREAK BANNER DEBUG (existing section, unchanged)
            ================================================================= */}
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
            <Text style={[styles.debugInfoText, { color: colors.textSecondary }]}>Loading...</Text>
          ) : (
            <>
              <Text style={[styles.debugInfoText, { color: colors.textSecondary }]}>
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
              <Text style={[styles.debugInfoText, { color: colors.textSecondary }]}>
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
          <TouchableOpacity onPress={fetchDebugInfo} style={{ marginTop: spacing.sm }}>
            <Text style={{ color: colors.primary.main, fontSize: 13 }}>↻ Refresh</Text>
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
            <Text style={[styles.label, { color: colors.textPrimary }]}>Reset Streak Banner</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Clears the {'"'}dismissed today{'"'} state so the streak banner will appear again on
              the home screen.
            </Text>
          </View>
          <Text style={[styles.actionText, { color: colors.primary.main }]}>
            {resetting ? "..." : "Reset"}
          </Text>
        </TouchableOpacity>

        {/* =================================================================
            HEALTH STATUS
            ================================================================= */}
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
          HEALTH STATUS
        </Text>

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
            {providerName} Connection
          </Text>

          {healthLoading ? (
            <ActivityIndicator size="small" color={colors.primary.main} />
          ) : (
            <>
              <DebugRow
                label="Status"
                value={healthStatus}
                valueColor={
                  healthStatus === "connected"
                    ? colors.success
                    : healthStatus === "syncing"
                      ? colors.primary.main
                      : healthStatus === "partial"
                        ? colors.warning
                        : healthStatus === "error"
                          ? colors.error
                          : colors.textMuted // disconnected
                }
                colors={colors}
              />
              <DebugRow
                label="HealthKit Available"
                value={isAvailable ? "Yes" : "No"}
                valueColor={isAvailable ? colors.success : colors.error}
                colors={colors}
              />
              {connection && (
                <>
                  <DebugRow label="Provider" value={connection.provider} colors={colors} />
                  <DebugRow
                    label="Permissions"
                    value={
                      Array.isArray(connection.permissions_granted)
                        ? (connection.permissions_granted as string[]).join(", ") || "None"
                        : "N/A"
                    }
                    colors={colors}
                  />
                </>
              )}
              <DebugRow label="Last Sync" value={formatLastSync(lastSync)} colors={colors} />
              <DebugRow
                label="Total Syncs"
                value={isLoadingHistory ? "..." : String(syncHistory.length)}
                colors={colors}
              />
              {lastResult && (
                <DebugRow
                  label="Last Result"
                  value={`+${lastResult.recordsInserted} ins, ${lastResult.recordsDeduplicated} dup, ${lastResult.recordsProcessed} total`}
                  colors={colors}
                />
              )}
            </>
          )}
          <TouchableOpacity
            onPress={() => {
              refreshConnection();
              refreshHistory();
            }}
            style={{ marginTop: spacing.sm }}
          >
            <Text style={{ color: colors.primary.main, fontSize: 13 }}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* =================================================================
            HEALTH ACTIONS
            ================================================================= */}
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
          HEALTH ACTIONS
        </Text>

        {/* Trigger Manual Sync */}
        <TouchableOpacity
          onPress={handleManualSync}
          disabled={isSyncing || isConnecting}
          style={[
            styles.debugButton,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: isSyncing ? 0.6 : 1,
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Trigger Manual Sync</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Fires a manual sync (7-day lookback) and shows detailed results.
            </Text>
          </View>
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.primary.main} />
          ) : (
            <Text style={[styles.actionText, { color: colors.primary.main }]}>Sync</Text>
          )}
        </TouchableOpacity>

        {/* Disconnect Health */}
        {isConnected && (
          <TouchableOpacity
            onPress={handleDisconnect}
            disabled={isDisconnecting}
            style={[
              styles.debugButton,
              {
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.sm,
                opacity: isDisconnecting ? 0.6 : 1,
              },
            ]}
          >
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Disconnect Health Data
              </Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                Calls disconnect RPC and clears health query cache. Reconnect via Settings or
                onboarding reset.
              </Text>
            </View>
            <Text style={[styles.actionText, { color: colors.error }]}>
              {isDisconnecting ? "..." : "Disconnect"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Reset Onboarding */}
        <TouchableOpacity
          onPress={handleResetOnboarding}
          disabled={resettingOnboarding}
          style={[
            styles.debugButton,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: resettingOnboarding ? 0.6 : 1,
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Reset Onboarding Flow</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Sets onboarding_completed=false, clears health_setup_completed_at, and redirects to
              onboarding. Re-test the full health connect screen.
            </Text>
          </View>
          <Text style={[styles.actionText, { color: colors.error }]}>
            {resettingOnboarding ? "..." : "Reset"}
          </Text>
        </TouchableOpacity>

        {/* Clear Health Cache */}
        <TouchableOpacity
          onPress={handleClearHealthCache}
          disabled={clearingCache}
          style={[
            styles.debugButton,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: clearingCache ? 0.6 : 1,
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Clear Health Query Cache
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Drops all cached health data from React Query and refetches fresh from the database.
            </Text>
          </View>
          <Text style={[styles.actionText, { color: colors.primary.main }]}>
            {clearingCache ? "..." : "Clear"}
          </Text>
        </TouchableOpacity>

        {/* =================================================================
            SYNC HISTORY
            ================================================================= */}
        {syncHistory.length > 0 && (
          <>
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
              SYNC HISTORY (LAST 5)
            </Text>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: spacing.xl,
              }}
            >
              {syncHistory.slice(0, 5).map((log: HealthSyncLog, index: number) => {
                const statusInfo = getSyncStatusLabel(log.status);
                const syncDate = new Date(log.started_at);
                const dateStr = syncDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <View
                    key={log.id}
                    style={{
                      padding: spacing.md,
                      borderBottomWidth: index < Math.min(syncHistory.length, 5) - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ fontSize: 14, marginRight: 8 }}>{statusInfo.text}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.debugInfoText,
                            { color: colors.textPrimary, fontWeight: "600" },
                          ]}
                        >
                          {log.sync_type.charAt(0).toUpperCase() + log.sync_type.slice(1)} sync
                        </Text>
                        <Text
                          style={[
                            styles.debugInfoText,
                            { color: colors.textSecondary, fontSize: 11 },
                          ]}
                        >
                          {dateStr}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: colors.textPrimary,
                          }}
                        >
                          +{log.records_inserted}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          {log.records_processed} proc / {log.records_deduplicated} dup
                        </Text>
                      </View>
                    </View>
                    {log.error_message && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.error,
                          marginTop: 4,
                          marginLeft: 22,
                        }}
                        numberOfLines={2}
                      >
                        {log.error_message}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {syncHistory.length === 0 && !isLoadingHistory && (
          <>
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
              SYNC HISTORY
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.xl,
              }}
            >
              <Text
                style={[styles.debugInfoText, { color: colors.textMuted, textAlign: "center" }]}
              >
                No sync history
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function DebugRow({
  label,
  value,
  valueColor,
  colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text style={[styles.debugInfoText, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.debugInfoText,
          {
            color: valueColor ?? colors.textPrimary,
            fontWeight: "600",
            flexShrink: 1,
            textAlign: "right",
          },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
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
