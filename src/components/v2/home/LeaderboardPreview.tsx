// src/components/v2/home/LeaderboardPreview.tsx
// L4 stacked progress bar leaderboard for expanded challenge cards
// Design System v2.0 - Based on home screen mockup
//
// Features:
// - Compact horizontal bars showing relative progress
// - Highlights "You" row with primary color
// - Shows top N participants (configurable)
// - "View all" link when more participants exist
// - Loading skeleton state

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import type { LeaderboardEntry } from "@/services/challenges";

// ============================================================================
// CONFIGURATION - Easy to update
// ============================================================================
export const MAX_LEADERBOARD_PREVIEW = 10;

// ============================================================================
// TYPES
// ============================================================================
export interface LeaderboardPreviewProps {
  entries: LeaderboardEntry[];
  goalValue: number;
  isLoading?: boolean;
  onViewAll?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================
function getRankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

// ============================================================================
// COMPONENT
// ============================================================================
export function LeaderboardPreview({
  entries,
  goalValue,
  isLoading,
  onViewAll,
}: LeaderboardPreviewProps) {
  const { colors, spacing, radius } = useAppTheme();
  const { user } = useAuth();
  const currentUserId = user?.id;

  // Calculate max progress for relative bar widths (use goal or max progress)
  const maxProgress = Math.max(
    goalValue,
    ...entries.map((e) => e.current_progress),
    1,
  );

  // Limit entries for preview
  const displayEntries = entries.slice(0, MAX_LEADERBOARD_PREVIEW);
  const hasMore = entries.length > MAX_LEADERBOARD_PREVIEW;
  const totalParticipants = entries.length;

  // Loading state - show skeleton rows
  if (isLoading) {
    return (
      <View style={styles.container}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.skeletonRow,
              {
                backgroundColor: `${colors.textMuted}15`,
                borderRadius: radius.sm,
                marginBottom: spacing.xs,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingVertical: spacing.md }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No participants yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Leaderboard rows */}
      {displayEntries.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        const progressPercent = Math.min(
          (entry.current_progress / maxProgress) * 100,
          100,
        );
        const displayName = isCurrentUser
          ? "You"
          : entry.profile.display_name || entry.profile.username;

        return (
          <View
            key={entry.user_id}
            style={[
              styles.entryRow,
              {
                backgroundColor: isCurrentUser
                  ? `${colors.primary.main}12`
                  : "transparent",
                borderRadius: radius.sm,
                paddingVertical: 6,
                paddingHorizontal: spacing.sm,
                marginBottom: 4,
              },
            ]}
          >
            {/* Rank */}
            <Text
              style={[
                styles.rankText,
                {
                  color:
                    entry.rank <= 3 ? colors.textPrimary : colors.textMuted,
                  fontWeight: entry.rank <= 3 ? "600" : "400",
                },
              ]}
            >
              {getRankDisplay(entry.rank)}
            </Text>

            {/* Name */}
            <Text
              style={[
                styles.nameText,
                {
                  color: isCurrentUser
                    ? colors.primary.main
                    : colors.textSecondary,
                  fontWeight: isCurrentUser ? "700" : "500",
                },
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>

            {/* Progress bar */}
            <View
              style={[
                styles.progressBarContainer,
                {
                  backgroundColor: `${colors.textMuted}20`,
                  borderRadius: radius.xs,
                },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.max(progressPercent, 2)}%`, // Min 2% for visibility
                    backgroundColor: isCurrentUser
                      ? colors.primary.main
                      : `${colors.textPrimary}50`,
                    borderRadius: radius.xs,
                  },
                ]}
              />
            </View>

            {/* Progress number */}
            <Text
              style={[
                styles.progressText,
                {
                  color: isCurrentUser ? colors.primary.main : colors.textMuted,
                  fontWeight: isCurrentUser ? "600" : "400",
                },
              ]}
            >
              {entry.current_progress.toLocaleString()}
            </Text>
          </View>
        );
      })}

      {/* View all link */}
      {(hasMore || onViewAll) && totalParticipants > 0 && (
        <TouchableOpacity
          style={[styles.viewAllButton, { marginTop: spacing.sm }]}
          onPress={onViewAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewAllText, { color: colors.primary.main }]}>
            {hasMore
              ? `View all ${totalParticipants} participants →`
              : "View full leaderboard →"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {},
  skeletonRow: {
    height: 32,
    opacity: 0.5,
  },
  emptyContainer: {
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    width: 24,
    textAlign: "left",
  },
  nameText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    width: 56,
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    marginHorizontal: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },
  progressText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    minWidth: 48,
    textAlign: "right",
  },
  viewAllButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
