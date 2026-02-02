// src/components/v2/NotificationFilters.tsx
// Notification category filter tabs
// Design System v2.0 - Based on prototype

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  InboxIcon,
  EnvelopeOpenIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  TrophyIcon,
} from "react-native-heroicons/outline";

export type NotificationFilterType =
  | "unread"
  | "all"
  | "social"
  | "challenges"
  | "archived";

export interface FilterOption {
  id: NotificationFilterType;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  count?: number;
}

export const DEFAULT_NOTIFICATION_FILTERS: Omit<FilterOption, "count">[] = [
  { id: "unread", label: "Unread", icon: EnvelopeOpenIcon },
  { id: "all", label: "All", icon: InboxIcon },
  { id: "social", label: "Social", icon: UserGroupIcon },
  { id: "challenges", label: "Challenges", icon: TrophyIcon },
  { id: "archived", label: "Archived", icon: ArchiveBoxIcon },
];

export interface NotificationFiltersProps {
  activeFilter: NotificationFilterType;
  onFilterChange: (filter: NotificationFilterType) => void;
  counts?: {
    unread?: number;
    all?: number;
    social?: number;
    challenges?: number;
    archived?: number;
  };
}

export function NotificationFilters({
  activeFilter,
  onFilterChange,
  counts = {},
}: NotificationFiltersProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          { paddingHorizontal: spacing.lg },
        ]}
      >
        {DEFAULT_NOTIFICATION_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const Icon = filter.icon;
          const count = counts[filter.id];

          return (
            <TouchableOpacity
              key={filter.id}
              onPress={() => onFilterChange(filter.id)}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isActive
                    ? colors.primary.main
                    : colors.surfaceElevated,
                },
              ]}
              activeOpacity={0.7}
            >
              <Icon
                size={14}
                color={isActive ? "#FFFFFF" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color: isActive ? "#FFFFFF" : colors.textSecondary,
                  },
                ]}
              >
                {filter.label}
              </Text>
              {count !== undefined && count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.2)"
                        : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      {
                        color: isActive ? "#FFFFFF" : colors.textSecondary,
                      },
                    ]}
                  >
                    {count > 99 ? "99+" : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Header component for notifications screen
export interface NotificationHeaderProps {
  unreadCount: number;
  onMarkAllRead?: () => void;
  isMarkingAll?: boolean;
}

export function NotificationHeader({
  unreadCount,
  onMarkAllRead,
  isMarkingAll = false,
}: NotificationHeaderProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
      <View>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Notifications
        </Text>
        {unreadCount > 0 && (
          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            {unreadCount} unread
          </Text>
        )}
      </View>
      {unreadCount > 0 && onMarkAllRead && (
        <TouchableOpacity
          onPress={onMarkAllRead}
          disabled={isMarkingAll}
          style={{ opacity: isMarkingAll ? 0.5 : 1 }}
        >
          <Text style={[styles.markAllRead, { color: colors.primary.main }]}>
            {isMarkingAll ? "Marking..." : "Mark all read"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Swipe hint component
export interface SwipeHintProps {
  isArchiveTab?: boolean;
}

export function SwipeHint({ isArchiveTab = false }: SwipeHintProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.swipeHint, { paddingHorizontal: spacing.lg }]}>
      <Text style={[styles.swipeHintText, { color: colors.textMuted }]}>
        {isArchiveTab ? "← Swipe left to restore" : "← Swipe left to archive"}
      </Text>
    </View>
  );
}

// Group header for time-based grouping
export interface NotificationGroupHeaderProps {
  title: string;
}

export function NotificationGroupHeader({
  title,
}: NotificationGroupHeaderProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <Text
      style={[
        styles.groupHeader,
        {
          color: colors.textMuted,
          marginHorizontal: spacing.lg,
          marginTop: spacing.lg,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {title.toUpperCase()}
    </Text>
  );
}

// Utility function to group notifications by time
export function groupNotificationsByTime<T extends { created_at: string }>(
  notifications: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const notification of notifications) {
    const date = new Date(notification.created_at);
    let group: string;

    if (date >= today) {
      group = "Today";
    } else if (date >= yesterday) {
      group = "Yesterday";
    } else if (date >= weekAgo) {
      group = "This Week";
    } else {
      group = "Earlier";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(notification);
  }

  return groups;
}

const styles = StyleSheet.create({
  wrapper: {
    height: 46,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 10,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  markAllRead: {
    fontSize: 14,
    fontWeight: "600",
  },
  swipeHint: {
    alignItems: "center",
    paddingVertical: 8,
  },
  swipeHintText: {
    fontSize: 12,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default NotificationFilters;
