// src/components/shared/ActivityCard.tsx
// ============================================
// Activity Card Component
// ============================================
// Displays an activity log entry with icon, values, and metadata.
//
// Usage:
//   <ActivityCard
//     type="steps"
//     value={5000}
//     unit="steps"
//     timestamp={new Date()}
//     source="healthkit"
//   />

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import {
  ArrowTrendingUpIcon,
  ClockIcon,
  FireIcon,
  MapPinIcon,
  HeartIcon,
  BoltIcon,
} from "react-native-heroicons/outline";
import {
  CheckCircleIcon,
  DevicePhoneMobileIcon,
} from "react-native-heroicons/solid";
import { useTheme } from "@/constants/theme";
import { MiniProgress } from "./ProgressRing";

// =============================================================================
// TYPES
// =============================================================================

export type ActivityType =
  | "steps"
  | "active_minutes"
  | "workouts"
  | "distance"
  | "calories"
  | "custom";

export type ActivitySource = "manual" | "healthkit" | "googlefit";

export interface ActivityCardProps {
  /** Activity type */
  type: ActivityType;

  /** Activity value */
  value: number;

  /** Value unit (e.g., "steps", "min", "km") */
  unit: string;

  /** When the activity occurred */
  timestamp: Date;

  /** Data source */
  source: ActivitySource;

  /** Optional challenge this activity contributes to */
  challengeTitle?: string;

  /** Optional progress toward goal (0-1) */
  progress?: number;

  /** Optional goal value */
  goalValue?: number;

  /** Press handler */
  onPress?: () => void;

  /** Container style */
  style?: ViewStyle;

  /** Test ID */
  testID?: string;
}

// =============================================================================
// TYPE CONFIGURATIONS
// =============================================================================

// Icon type that accepts both outline (size: NumberProp) and solid (size: number) heroicons
type IconComponent = React.ComponentType<{
  size?: number | string;
  color?: string;
}>;

interface TypeConfig {
  icon: IconComponent;
  label: string;
  color: string;
}

const getTypeConfig = (
  type: ActivityType,
  colors: ReturnType<typeof useTheme>["colors"],
): TypeConfig => {
  const configs: Record<ActivityType, TypeConfig> = {
    steps: {
      icon: ArrowTrendingUpIcon,
      label: "Steps",
      color: colors.primary.main,
    },
    active_minutes: {
      icon: ClockIcon,
      label: "Active Minutes",
      color: colors.energy.main,
    },
    workouts: {
      icon: BoltIcon,
      label: "Workout",
      color: colors.achievement.main,
    },
    distance: {
      icon: MapPinIcon,
      label: "Distance",
      color: colors.social.main,
    },
    calories: {
      icon: FireIcon,
      label: "Calories",
      color: "#EF4444",
    },
    custom: {
      icon: CheckCircleIcon,
      label: "Activity",
      color: colors.textSecondary,
    },
  };

  return configs[type];
};

const getSourceConfig = (source: ActivitySource) => {
  const configs: Record<
    ActivitySource,
    { label: string; icon: IconComponent }
  > = {
    manual: {
      label: "Manual",
      icon: CheckCircleIcon,
    },
    healthkit: {
      label: "Apple Health",
      icon: HeartIcon,
    },
    googlefit: {
      label: "Google Fit",
      icon: DevicePhoneMobileIcon,
    },
  };

  return configs[source];
};

// =============================================================================
// HELPERS
// =============================================================================

const formatValue = (value: number, unit: string): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  if (value >= 1000) {
    return value.toLocaleString();
  }
  return value.toString();
};

const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

// =============================================================================
// COMPONENT
// =============================================================================

export function ActivityCard({
  type,
  value,
  unit,
  timestamp,
  source,
  challengeTitle,
  progress,
  goalValue,
  onPress,
  style,
  testID,
}: ActivityCardProps) {
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const typeConfig = getTypeConfig(type, colors);
  const sourceConfig = getSourceConfig(source);
  const IconComponent = typeConfig.icon;
  const SourceIcon = sourceConfig.icon;

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          padding: spacing.md,
          ...shadows.card,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Left: Icon */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: `${typeConfig.color}15`,
            borderRadius: radius.md,
            padding: spacing.sm,
          },
        ]}
      >
        <IconComponent size={24} color={typeConfig.color} />
      </View>

      {/* Center: Content */}
      <View style={[styles.content, { marginLeft: spacing.md }]}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.value,
              {
                color: colors.textPrimary,
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold as any,
              },
            ]}
          >
            {formatValue(value, unit)}
          </Text>
          <Text
            style={[
              styles.unit,
              {
                color: colors.textSecondary,
                fontSize: typography.fontSize.base,
                marginLeft: spacing.xs,
              },
            ]}
          >
            {unit}
          </Text>

          {goalValue && (
            <Text
              style={[
                styles.goal,
                {
                  color: colors.textMuted,
                  fontSize: typography.fontSize.sm,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              / {formatValue(goalValue, unit)}
            </Text>
          )}
        </View>

        <View style={[styles.bottomRow, { marginTop: spacing.xs }]}>
          <View style={styles.metaItem}>
            <SourceIcon size={12} color={colors.textMuted} />
            <Text
              style={[
                styles.metaText,
                {
                  color: colors.textMuted,
                  fontSize: typography.fontSize.xs,
                  marginLeft: 4,
                },
              ]}
            >
              {sourceConfig.label}
            </Text>
          </View>

          <Text
            style={[
              styles.timestamp,
              {
                color: colors.textMuted,
                fontSize: typography.fontSize.xs,
                marginLeft: spacing.md,
              },
            ]}
          >
            {formatTimestamp(timestamp)}
          </Text>

          {challengeTitle && (
            <Text
              style={[
                styles.challenge,
                {
                  color: colors.primary.main,
                  fontSize: typography.fontSize.xs,
                  marginLeft: spacing.md,
                },
              ]}
              numberOfLines={1}
            >
              {challengeTitle}
            </Text>
          )}
        </View>
      </View>

      {/* Right: Progress (optional) */}
      {progress !== undefined && (
        <View style={[styles.progressContainer, { marginLeft: spacing.md }]}>
          <MiniProgress
            progress={progress}
            color={typeConfig.color}
            size={32}
          />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// =============================================================================
// ACTIVITY CARD SKELETON (loading state)
// =============================================================================

export function ActivityCardSkeleton() {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          padding: spacing.md,
          ...shadows.card,
        },
      ]}
    >
      {/* Icon placeholder */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.surfacePressed,
            borderRadius: radius.md,
            width: 40,
            height: 40,
          },
        ]}
      />

      {/* Content placeholders */}
      <View style={[styles.content, { marginLeft: spacing.md }]}>
        <View
          style={{
            backgroundColor: colors.surfacePressed,
            width: 80,
            height: 20,
            borderRadius: radius.sm,
          }}
        />
        <View
          style={{
            backgroundColor: colors.surfacePressed,
            width: 120,
            height: 14,
            borderRadius: radius.sm,
            marginTop: spacing.xs,
          }}
        />
      </View>
    </View>
  );
}

// =============================================================================
// COMPACT ACTIVITY ITEM (for lists)
// =============================================================================

export interface CompactActivityProps {
  type: ActivityType;
  value: number;
  unit: string;
  timestamp: Date;
}

export function CompactActivity({
  type,
  value,
  unit,
  timestamp,
}: CompactActivityProps) {
  const { colors, typography, spacing } = useTheme();
  const typeConfig = getTypeConfig(type, colors);
  const IconComponent = typeConfig.icon;

  return (
    <View style={styles.compactContainer}>
      <IconComponent size={16} color={typeConfig.color} />
      <Text
        style={[
          styles.compactValue,
          {
            color: colors.textPrimary,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold as any,
            marginLeft: spacing.xs,
          },
        ]}
      >
        {formatValue(value, unit)} {unit}
      </Text>
      <Text
        style={[
          styles.compactTime,
          {
            color: colors.textMuted,
            fontSize: typography.fontSize.xs,
            marginLeft: spacing.sm,
          },
        ]}
      >
        {formatTimestamp(timestamp)}
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  value: {
    // Styles applied inline
  },
  unit: {
    // Styles applied inline
  },
  goal: {
    // Styles applied inline
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    // Styles applied inline
  },
  timestamp: {
    // Styles applied inline
  },
  challenge: {
    flex: 1,
  },
  progressContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  compactValue: {
    // Styles applied inline
  },
  compactTime: {
    // Styles applied inline
  },
});

export default ActivityCard;
