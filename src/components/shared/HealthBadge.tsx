// src/components/shared/HealthBadge.tsx
// ============================================
// Health Badge Component
// ============================================
// Displays health provider connection status with
// sync indicators and action buttons.
//
// Usage:
//   <HealthBadge
//     provider="healthkit"
//     connected={true}
//     lastSync={new Date()}
//     onSync={() => sync()}
//   />

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import {
  HeartIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
} from "react-native-heroicons/outline";
import { HeartIcon as HeartIconSolid } from "react-native-heroicons/solid";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type HealthProvider = "healthkit" | "googlefit" | "mock";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "syncing"
  | "error"
  | "partial";

export interface HealthBadgeProps {
  /** Health provider type */
  provider: HealthProvider;

  /** Connection status */
  status: ConnectionStatus;

  /** Last successful sync time */
  lastSync?: Date | null;

  /** Whether currently syncing */
  isSyncing?: boolean;

  /** Sync progress (0-100) */
  syncProgress?: number;

  /** Error message if status is error */
  errorMessage?: string;

  /** Connect button handler */
  onConnect?: () => void;

  /** Disconnect button handler */
  onDisconnect?: () => void;

  /** Manual sync handler */
  onSync?: () => void;

  /** Settings/permissions handler */
  onSettings?: () => void;

  /** Display variant */
  variant?: "compact" | "full" | "inline";

  /** Container style */
  style?: ViewStyle;

  /** Test ID */
  testID?: string;
}

// =============================================================================
// PROVIDER CONFIGURATIONS
// =============================================================================

interface ProviderConfig {
  name: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

const getProviderConfig = (
  provider: HealthProvider,
  colors: ReturnType<typeof useTheme>["colors"],
): ProviderConfig => {
  const configs: Record<HealthProvider, ProviderConfig> = {
    healthkit: {
      name: "Apple Health",
      icon: HeartIconSolid,
      color: "#FF2D55", // Apple Health pink
    },
    googlefit: {
      name: "Google Fit",
      icon: HeartIcon,
      color: "#4285F4", // Google blue
    },
    mock: {
      name: "Demo Mode",
      icon: HeartIcon,
      color: colors.textSecondary,
    },
  };

  return configs[provider];
};

// =============================================================================
// HELPERS
// =============================================================================

const formatLastSync = (date: Date | null | undefined): string => {
  if (!date) return "Never synced";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getStatusConfig = (
  status: ConnectionStatus,
  colors: ReturnType<typeof useTheme>["colors"],
) => {
  const configs: Record<
    ConnectionStatus,
    { label: string; color: string; icon: typeof CheckCircleIcon }
  > = {
    connected: {
      label: "Connected",
      color: colors.success,
      icon: CheckCircleIcon,
    },
    disconnected: {
      label: "Not connected",
      color: colors.textMuted,
      icon: LinkIcon,
    },
    syncing: {
      label: "Syncing...",
      color: colors.primary.main,
      icon: ArrowPathIcon,
    },
    error: {
      label: "Error",
      color: colors.error,
      icon: ExclamationCircleIcon,
    },
    partial: {
      label: "Limited access",
      color: colors.warning,
      icon: ExclamationCircleIcon,
    },
  };

  return configs[status];
};

// =============================================================================
// COMPACT VARIANT
// =============================================================================

function CompactBadge({
  provider,
  status,
  isSyncing,
  onConnect,
  onSync,
  colors,
  typography,
  spacing,
  radius,
  testID,
}: HealthBadgeProps & ReturnType<typeof useTheme>) {
  const providerConfig = getProviderConfig(provider, colors);
  const statusConfig = getStatusConfig(status, colors);
  const ProviderIcon = providerConfig.icon;

  const isConnected = status === "connected" || status === "syncing";

  return (
    <TouchableOpacity
      style={[
        styles.compactContainer,
        {
          backgroundColor: isConnected
            ? `${providerConfig.color}15`
            : colors.surface,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: 1,
          borderColor: isConnected ? providerConfig.color : colors.border,
        },
      ]}
      onPress={isConnected ? onSync : onConnect}
      disabled={isSyncing}
      activeOpacity={0.7}
      testID={testID}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={providerConfig.color} />
      ) : (
        <ProviderIcon size={16} color={providerConfig.color} />
      )}
      <Text
        style={[
          styles.compactText,
          {
            color: isConnected ? providerConfig.color : colors.textSecondary,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium as any,
            marginLeft: spacing.xs,
          },
        ]}
      >
        {isConnected ? providerConfig.name : "Connect"}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// INLINE VARIANT
// =============================================================================

function InlineBadge({
  provider,
  status,
  lastSync,
  isSyncing,
  colors,
  typography,
  spacing,
  testID,
}: HealthBadgeProps & ReturnType<typeof useTheme>) {
  const providerConfig = getProviderConfig(provider, colors);
  const statusConfig = getStatusConfig(status, colors);
  const StatusIcon = statusConfig.icon;

  return (
    <View style={styles.inlineContainer} testID={testID}>
      <StatusIcon size={14} color={statusConfig.color} />
      <Text
        style={[
          styles.inlineText,
          {
            color: statusConfig.color,
            fontSize: typography.fontSize.xs,
            marginLeft: 4,
          },
        ]}
      >
        {isSyncing ? "Syncing..." : statusConfig.label}
      </Text>
      {status === "connected" && lastSync && (
        <Text
          style={[
            styles.inlineTime,
            {
              color: colors.textMuted,
              fontSize: typography.fontSize.xs,
              marginLeft: spacing.xs,
            },
          ]}
        >
          • {formatLastSync(lastSync)}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// FULL VARIANT
// =============================================================================

function FullBadge({
  provider,
  status,
  lastSync,
  isSyncing,
  syncProgress,
  errorMessage,
  onConnect,
  onDisconnect,
  onSync,
  onSettings,
  colors,
  typography,
  spacing,
  radius,
  shadows,
  style,
  testID,
}: HealthBadgeProps & ReturnType<typeof useTheme>) {
  const providerConfig = getProviderConfig(provider, colors);
  const statusConfig = getStatusConfig(status, colors);
  const ProviderIcon = providerConfig.icon;
  const StatusIcon = statusConfig.icon;

  const isConnected =
    status === "connected" || status === "syncing" || status === "partial";

  return (
    <View
      style={[
        styles.fullContainer,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          padding: spacing.lg,
          ...shadows.card,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.fullHeader}>
        <View
          style={[
            styles.providerIconContainer,
            {
              backgroundColor: `${providerConfig.color}15`,
              borderRadius: radius.md,
              padding: spacing.sm,
            },
          ]}
        >
          <ProviderIcon size={24} color={providerConfig.color} />
        </View>

        <View style={[styles.providerInfo, { marginLeft: spacing.md }]}>
          <Text
            style={[
              styles.providerName,
              {
                color: colors.textPrimary,
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.semibold as any,
              },
            ]}
          >
            {providerConfig.name}
          </Text>

          <View style={[styles.statusRow, { marginTop: 4 }]}>
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.primary.main} />
            ) : (
              <StatusIcon size={14} color={statusConfig.color} />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: statusConfig.color,
                  fontSize: typography.fontSize.sm,
                  marginLeft: 4,
                },
              ]}
            >
              {isSyncing
                ? syncProgress !== undefined
                  ? `Syncing ${syncProgress}%`
                  : "Syncing..."
                : statusConfig.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Last sync info */}
      {isConnected && (
        <View style={[styles.syncInfo, { marginTop: spacing.md }]}>
          <Text
            style={[
              styles.syncLabel,
              {
                color: colors.textMuted,
                fontSize: typography.fontSize.sm,
              },
            ]}
          >
            Last synced: {formatLastSync(lastSync)}
          </Text>
        </View>
      )}

      {/* Error message */}
      {status === "error" && errorMessage && (
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor: `${colors.error}10`,
              borderRadius: radius.sm,
              padding: spacing.sm,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text
            style={[
              styles.errorText,
              {
                color: colors.error,
                fontSize: typography.fontSize.sm,
              },
            ]}
          >
            {errorMessage}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View
        style={[styles.actions, { marginTop: spacing.lg, gap: spacing.sm }]}
      >
        {isConnected ? (
          <>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: colors.primary.main,
                  borderRadius: radius.button,
                  paddingVertical: spacing.sm,
                  flex: 1,
                },
              ]}
              onPress={onSync}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary.contrast}
                />
              ) : (
                <>
                  <ArrowPathIcon size={18} color={colors.primary.contrast} />
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: colors.primary.contrast,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold as any,
                        marginLeft: spacing.xs,
                      },
                    ]}
                  >
                    Sync Now
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.button,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                },
              ]}
              onPress={onSettings || onDisconnect}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color: colors.textSecondary,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium as any,
                  },
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: providerConfig.color,
                borderRadius: radius.button,
                paddingVertical: spacing.md,
                flex: 1,
              },
            ]}
            onPress={onConnect}
            activeOpacity={0.8}
          >
            <LinkIcon size={18} color="#FFFFFF" />
            <Text
              style={[
                styles.buttonText,
                {
                  color: "#FFFFFF",
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.semibold as any,
                  marginLeft: spacing.sm,
                },
              ]}
            >
              Connect {providerConfig.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HealthBadge(props: HealthBadgeProps) {
  const theme = useTheme();
  const { variant = "full" } = props;

  switch (variant) {
    case "compact":
      return <CompactBadge {...props} {...theme} />;
    case "inline":
      return <InlineBadge {...props} {...theme} />;
    case "full":
    default:
      return <FullBadge {...props} {...theme} />;
  }
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Compact variant
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  compactText: {
    // Styles applied inline
  },

  // Inline variant
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  inlineText: {
    // Styles applied inline
  },
  inlineTime: {
    // Styles applied inline
  },

  // Full variant
  fullContainer: {
    // Styles applied inline
  },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    // Styles applied inline
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    // Styles applied inline
  },
  syncInfo: {
    // Styles applied inline
  },
  syncLabel: {
    // Styles applied inline
  },
  errorContainer: {
    // Styles applied inline
  },
  errorText: {
    // Styles applied inline
  },
  actions: {
    flexDirection: "row",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    // Styles applied inline
  },
});

export default HealthBadge;
