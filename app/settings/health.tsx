// app/settings/health.tsx
// Health Data Settings - Connect/manage HealthKit or Google Fit
// Design System v1.0 aligned

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeftIcon,
  HeartIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "react-native-heroicons/outline";
import { HeartIcon as HeartIconSolid } from "react-native-heroicons/solid";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useHealthConnection, useHealthSync } from "@/services/health";
import type { HealthSyncLog, SyncStatus } from "@/services/health";
import { formatTimeAgo } from "@/lib/serverTime";

export default function HealthSettingsScreen() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);

  const {
    status,
    connection,
    lastSync,
    isLoading,
    isConnecting,
    isDisconnecting,
    isAvailable,
    connect,
    disconnect,
    refresh: refreshConnection,
  } = useHealthConnection();

  const {
    sync,
    isSyncing,
    lastResult,
    syncHistory,
    isLoadingHistory,
    refreshHistory,
  } = useHealthSync();

  const providerName = Platform.OS === "ios" ? "Apple Health" : "Google Fit";
  const isConnected = status === "connected";

  const handleConnect = async () => {
    try {
      await connect();
      Alert.alert("Connected", `Successfully connected to ${providerName}`);
    } catch (error) {
      Alert.alert(
        "Connection Failed",
        error instanceof Error
          ? error.message
          : "Could not connect to health data",
      );
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Health Data",
      `Are you sure you want to disconnect from ${providerName}? Your synced data will remain, but no new data will be imported.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect();
            } catch (error) {
              Alert.alert("Error", "Failed to disconnect");
            }
          },
        },
      ],
    );
  };

  const handleSync = async () => {
    try {
      const result = await sync({ syncType: "manual" });
      if (result.success) {
        Alert.alert(
          "Sync Complete",
          `Synced ${result.recordsInserted} new activities`,
        );
      } else {
        Alert.alert(
          "Sync Completed with Issues",
          `Inserted: ${result.recordsInserted}\nErrors: ${result.errors.length}`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Sync Failed",
        error instanceof Error ? error.message : "Could not sync health data",
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    refreshConnection();
    refreshHistory();
    setRefreshing(false);
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Never";
    return formatTimeAgo(date);
  };

  const getSyncStatusIcon = (syncStatus: SyncStatus) => {
    switch (syncStatus) {
      case "completed":
        return <CheckCircleIcon size={16} color={colors.success} />;
      case "failed":
        return <XCircleIcon size={16} color={colors.error} />;
      case "partial":
        return <ExclamationTriangleIcon size={16} color={colors.warning} />;
      default:
        return <ClockIcon size={16} color={colors.textMuted} />;
    }
  };

  const formatSyncDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isAvailable) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header colors={colors} spacing={spacing} typography={typography} />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing.xl,
          }}
        >
          <HeartIcon size={64} color={colors.textMuted} />
          <Text
            style={{
              marginTop: spacing.lg,
              fontSize: typography.fontSize.lg,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            Health Data Not Available
          </Text>
          <Text
            style={{
              marginTop: spacing.sm,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            {Platform.OS === "ios"
              ? "Apple Health is not available on this device."
              : "Google Fit is not available on this device."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header colors={colors} spacing={spacing} typography={typography} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Connection Status Card */}
        <View
          style={{
            marginTop: spacing.lg,
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            overflow: "hidden",
            ...shadows.card,
          }}
        >
          <View
            style={{
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                backgroundColor: isConnected
                  ? colors.success + "20"
                  : colors.textMuted + "20",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isConnected ? (
                <HeartIconSolid size={28} color={colors.success} />
              ) : (
                <HeartIcon size={28} color={colors.textMuted} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: colors.textPrimary,
                }}
              >
                {providerName}
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: isConnected ? colors.success : colors.textMuted,
                  marginTop: 2,
                }}
              >
                {isConnected ? "Connected" : "Not Connected"}
              </Text>
            </View>
          </View>

          {isConnected && (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: spacing.md,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                  }}
                >
                  Last synced
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.textPrimary,
                  }}
                >
                  {formatLastSync(lastSync)}
                </Text>
              </View>
              {connection?.permissions_granted && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.textMuted,
                    }}
                  >
                    Permissions: {connection.permissions_granted.join(", ")}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View
          style={{
            marginTop: spacing.lg,
            marginHorizontal: spacing.lg,
            gap: spacing.md,
          }}
        >
          {isConnected ? (
            <>
              {/* Sync Button */}
              <TouchableOpacity
                onPress={handleSync}
                disabled={isSyncing}
                style={{
                  backgroundColor: colors.primary.main,
                  borderRadius: radius.button,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isSyncing ? 0.7 : 1,
                }}
              >
                {isSyncing ? (
                  <ActivityIndicator color={colors.primary.contrast} />
                ) : (
                  <ArrowPathIcon size={20} color={colors.primary.contrast} />
                )}
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.primary.contrast,
                  }}
                >
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </Text>
              </TouchableOpacity>

              {/* Disconnect Button */}
              <TouchableOpacity
                onPress={handleDisconnect}
                disabled={isDisconnecting}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.button,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.error,
                }}
              >
                {isDisconnecting ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <XCircleIcon size={20} color={colors.error} />
                )}
                <Text
                  style={{
                    marginLeft: spacing.sm,
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.error,
                  }}
                >
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Connect Button */
            <TouchableOpacity
              onPress={handleConnect}
              disabled={isConnecting || isLoading}
              style={{
                backgroundColor: colors.primary.main,
                borderRadius: radius.button,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                opacity: isConnecting ? 0.7 : 1,
              }}
            >
              {isConnecting ? (
                <ActivityIndicator color={colors.primary.contrast} />
              ) : (
                <HeartIcon size={24} color={colors.primary.contrast} />
              )}
              <Text
                style={{
                  marginLeft: spacing.sm,
                  fontSize: typography.fontSize.lg,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: colors.primary.contrast,
                }}
              >
                {isConnecting ? "Connecting..." : `Connect ${providerName}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Last Sync Result */}
        {lastResult && (
          <View
            style={{
              marginTop: spacing.lg,
              marginHorizontal: spacing.lg,
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.lg,
              ...shadows.card,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textMuted,
                marginBottom: spacing.sm,
              }}
            >
              LAST SYNC RESULT
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.lg,
              }}
            >
              <StatItem
                label="Processed"
                value={lastResult.recordsProcessed}
                colors={colors}
                typography={typography}
              />
              <StatItem
                label="Inserted"
                value={lastResult.recordsInserted}
                colors={colors}
                typography={typography}
              />
              <StatItem
                label="Duplicates"
                value={lastResult.recordsDeduplicated}
                colors={colors}
                typography={typography}
              />
            </View>
          </View>
        )}

        {/* Sync History */}
        {isConnected && syncHistory.length > 0 && (
          <View
            style={{
              marginTop: spacing.lg,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textMuted,
                marginBottom: spacing.sm,
              }}
            >
              SYNC HISTORY
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                overflow: "hidden",
                ...shadows.card,
              }}
            >
              {syncHistory.slice(0, 5).map((log, index) => (
                <View
                  key={log.id}
                  style={{
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth:
                      index < Math.min(syncHistory.length, 5) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  {getSyncStatusIcon(log.status)}
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: colors.textPrimary,
                      }}
                    >
                      {log.sync_type.charAt(0).toUpperCase() +
                        log.sync_type.slice(1)}{" "}
                      sync
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textMuted,
                      }}
                    >
                      {formatSyncDate(log.started_at)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: colors.textMuted,
                    }}
                  >
                    +{log.records_inserted}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Info Text */}
        {!isConnected && (
          <View
            style={{
              marginTop: spacing.lg,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Connect to {providerName} to automatically sync your fitness data
              with your challenges. Your steps, workouts, and activity minutes
              will be imported to track your progress.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Header Component
function Header({
  colors,
  spacing,
  typography,
}: {
  colors: ReturnType<typeof useAppTheme>["colors"];
  spacing: ReturnType<typeof useAppTheme>["spacing"];
  typography: ReturnType<typeof useAppTheme>["typography"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ padding: spacing.xs }}
      >
        <ChevronLeftIcon size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text
        style={{
          flex: 1,
          fontSize: typography.fontSize.lg,
          fontFamily: "PlusJakartaSans_700Bold",
          color: colors.textPrimary,
          marginLeft: spacing.md,
        }}
      >
        Health Data
      </Text>
    </View>
  );
}

// Stat Item Component
function StatItem({
  label,
  value,
  colors,
  typography,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useAppTheme>["colors"];
  typography: ReturnType<typeof useAppTheme>["typography"];
}) {
  return (
    <View>
      <Text
        style={{
          fontSize: typography.fontSize["2xl"],
          fontFamily: "PlusJakartaSans_700Bold",
          color: colors.textPrimary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: typography.fontSize.xs,
          fontFamily: "PlusJakartaSans_500Medium",
          color: colors.textMuted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
