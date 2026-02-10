// src/components/home/ActivityRow.tsx
// Activity row component for recent activity display
// Design System - Based on prototype

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  getActivityIcon,
  activityColors,
  type ActivityType,
} from "@/components/icons/ActivityIcons";
import { getDayLabel } from "@/lib/serverTime";

export interface ActivityRowProps {
  id: string;
  type: ActivityType;
  name: string;
  duration: number; // in minutes
  date: string; // "Today", "Yesterday", etc.
  time: string; // "7:32 AM"
  points: number;
  onPress?: () => void;
  showBorder?: boolean;
}

export function ActivityRow({
  id,
  type,
  name,
  duration,
  date,
  time,
  points,
  onPress,
  showBorder = true,
}: ActivityRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const IconComponent = getActivityIcon(type);
  const typeColors = activityColors[type] || activityColors.custom;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        showBorder && {
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Activity Icon */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: typeColors.bg,
            borderRadius: radius.md,
          },
        ]}
      >
        <IconComponent size={18} color={typeColors.text} />
      </View>

      {/* Activity Info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {duration} min • {date}
        </Text>
      </View>

      {/* Points & Time */}
      <View style={styles.statsContainer}>
        <Text style={[styles.points, { color: colors.primary.main }]}>{points} pts</Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Compact version for lists
export interface ActivityRowCompactProps {
  type: ActivityType;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  onPress?: () => void;
}

export function ActivityRowCompact({
  type,
  name,
  value,
  unit,
  timestamp,
  onPress,
}: ActivityRowCompactProps) {
  const { colors, spacing, radius } = useAppTheme();
  const IconComponent = getActivityIcon(type);
  const typeColors = activityColors[type] || activityColors.custom;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.compactContainer,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
      ]}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Icon */}
      <View
        style={[
          styles.compactIconContainer,
          {
            backgroundColor: typeColors.bg,
            borderRadius: radius.sm,
          },
        ]}
      >
        <IconComponent size={16} color={typeColors.text} />
      </View>

      {/* Info */}
      <View style={styles.compactInfoContainer}>
        <Text style={[styles.compactName, { color: colors.textPrimary }]}>{name}</Text>
        <Text style={[styles.compactMeta, { color: colors.textSecondary }]}>
          {getDayLabel(timestamp)} • {formatTime(timestamp)}
        </Text>
      </View>

      {/* Value */}
      <View style={styles.compactValueContainer}>
        <Text style={[styles.compactValue, { color: colors.textPrimary }]}>
          {value.toLocaleString()}
        </Text>
        <Text style={[styles.compactUnit, { color: colors.textSecondary }]}>{unit}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Section header for recent activity
export interface RecentActivityHeaderProps {
  onSeeAll?: () => void;
}

export function RecentActivityHeader({ onSeeAll }: RecentActivityHeaderProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.headerContainer, { marginBottom: spacing.sm }]}>
      <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>RECENT ACTIVITY</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary.main }]}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Empty state for no recent activity
export function NoRecentActivity() {
  const { colors, spacing, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.emptyContainer,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.xl,
        },
      ]}
    >
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Recent Activity</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Your workout history will appear here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  statsContainer: {
    alignItems: "flex-end",
  },
  points: {
    fontSize: 15,
    fontWeight: "600",
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },

  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  compactIconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  compactInfoContainer: {
    flex: 1,
    marginLeft: 10,
  },
  compactName: {
    fontSize: 14,
    fontWeight: "500",
  },
  compactMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  compactValueContainer: {
    alignItems: "flex-end",
  },
  compactValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  compactUnit: {
    fontSize: 11,
    marginTop: 1,
  },

  // Header styles
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "500",
  },

  // Empty state styles
  emptyContainer: {
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default ActivityRow;
