// src/components/v2/ActivityCard.tsx
// Activity card component for activity history and detail views
// Design System v2.0

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  getActivityIcon,
  activityColors,
  type ActivityType,
} from "@/components/icons/ActivityIcons";
import {
  ClockIcon,
  FireIcon,
  HeartIcon,
  MapPinIcon,
} from "react-native-heroicons/outline";

export interface ActivityCardProps {
  id: string;
  type: ActivityType;
  name: string;
  value: number;
  unit: string;
  duration?: number; // minutes
  calories?: number;
  heartRate?: number;
  distance?: number;
  points: number;
  recordedAt: Date;
  source: "manual" | "healthkit" | "googlefit";
  challengeName?: string;
  onPress?: () => void;
}

export function ActivityCard({
  id,
  type,
  name,
  value,
  unit,
  duration,
  calories,
  heartRate,
  distance,
  points,
  recordedAt,
  source,
  challengeName,
  onPress,
}: ActivityCardProps) {
  const { colors, spacing, radius } = useAppTheme();
  const IconComponent = getActivityIcon(type);
  const typeColors = activityColors[type] || activityColors.custom;

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return date.toLocaleDateString(undefined, { weekday: "long" });
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getSourceLabel = () => {
    switch (source) {
      case "healthkit":
        return "Apple Health";
      case "googlefit":
        return "Google Fit";
      default:
        return "Manual";
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: typeColors.bg,
              borderRadius: radius.lg,
            },
          ]}
        >
          <IconComponent size={24} color={typeColors.text} />
        </View>

        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {name}
          </Text>
          <Text style={[styles.dateTime, { color: colors.textSecondary }]}>
            {formatDate(recordedAt)} • {formatTime(recordedAt)}
          </Text>
        </View>

        <View style={styles.pointsContainer}>
          <Text style={[styles.points, { color: colors.primary.main }]}>
            +{points}
          </Text>
          <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>
            pts
          </Text>
        </View>
      </View>

      {/* Main value */}
      <View style={[styles.valueRow, { marginTop: spacing.md }]}>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {value.toLocaleString()}
        </Text>
        <Text style={[styles.unit, { color: colors.textSecondary }]}>
          {unit}
        </Text>
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
        {duration !== undefined && (
          <View style={styles.stat}>
            <ClockIcon size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {duration} min
            </Text>
          </View>
        )}
        {calories !== undefined && (
          <View style={styles.stat}>
            <FireIcon size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {calories} cal
            </Text>
          </View>
        )}
        {heartRate !== undefined && (
          <View style={styles.stat}>
            <HeartIcon size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {heartRate} bpm
            </Text>
          </View>
        )}
        {distance !== undefined && (
          <View style={styles.stat}>
            <MapPinIcon size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {distance.toFixed(1)} mi
            </Text>
          </View>
        )}
      </View>

      {/* Challenge & Source info */}
      <View
        style={[
          styles.footer,
          {
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        ]}
      >
        {challengeName && (
          <View
            style={[
              styles.challengeBadge,
              {
                backgroundColor: colors.primary.subtle,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.xs,
                paddingVertical: 2,
              },
            ]}
          >
            <Text
              style={[styles.challengeText, { color: colors.primary.main }]}
            >
              {challengeName}
            </Text>
          </View>
        )}
        <Text style={[styles.sourceText, { color: colors.textMuted }]}>
          via {getSourceLabel()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Compact version for lists
export interface ActivityListItemProps {
  type: ActivityType;
  name: string;
  value: number;
  unit: string;
  points: number;
  recordedAt: Date;
  onPress?: () => void;
  showBorder?: boolean;
}

export function ActivityListItem({
  type,
  name,
  value,
  unit,
  points,
  recordedAt,
  onPress,
  showBorder = true,
}: ActivityListItemProps) {
  const { colors, spacing, radius } = useAppTheme();
  const IconComponent = getActivityIcon(type);
  const typeColors = activityColors[type] || activityColors.custom;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      style={[
        styles.listItem,
        showBorder && {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.listItemIcon,
          {
            backgroundColor: typeColors.bg,
            borderRadius: radius.md,
          },
        ]}
      >
        <IconComponent size={18} color={typeColors.text} />
      </View>

      <View style={styles.listItemContent}>
        <Text style={[styles.listItemName, { color: colors.textPrimary }]}>
          {name}
        </Text>
        <Text style={[styles.listItemMeta, { color: colors.textSecondary }]}>
          {value.toLocaleString()} {unit} • {formatTime(recordedAt)}
        </Text>
      </View>

      <View style={styles.listItemPoints}>
        <Text
          style={[styles.listItemPointsValue, { color: colors.primary.main }]}
        >
          +{points}
        </Text>
        <Text style={[styles.listItemPointsLabel, { color: colors.textMuted }]}>
          pts
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  dateTime: {
    fontSize: 13,
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: "flex-end",
  },
  points: {
    fontSize: 18,
    fontWeight: "700",
  },
  pointsLabel: {
    fontSize: 12,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
  },
  unit: {
    fontSize: 16,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  challengeBadge: {},
  challengeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sourceText: {
    fontSize: 12,
  },

  // List item styles
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listItemIcon: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: "500",
  },
  listItemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  listItemPoints: {
    alignItems: "flex-end",
  },
  listItemPointsValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  listItemPointsLabel: {
    fontSize: 11,
  },
});

export default ActivityCard;
