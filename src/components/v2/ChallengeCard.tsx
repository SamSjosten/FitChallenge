// src/components/v2/ChallengeCard.tsx
// V2 Collapsible challenge card component
// Design System v2.0 - Based on prototype

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";
import { ProgressBar } from "@/components/ui";
import { getDaysRemaining } from "@/lib/serverTime";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UsersIcon,
} from "react-native-heroicons/outline";
import type { ChallengeWithParticipation } from "@/services/challenges";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ChallengeCardProps {
  challenge: ChallengeWithParticipation;
  defaultExpanded?: boolean;
  onPress?: () => void;
}

function getRankText(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

export function ChallengeCard({
  challenge,
  defaultExpanded = false,
  onPress,
}: ChallengeCardProps) {
  const { colors, spacing, radius } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const progress = challenge.my_participation?.current_progress || 0;
  const progressPercent = Math.min(
    (progress / challenge.goal_value) * 100,
    100,
  );
  const rank = challenge.my_rank || 1;
  const participantCount = challenge.participant_count || 1;
  const friendCount = Math.max(0, participantCount - 1);
  const daysLeft = getDaysRemaining(challenge.end_date);

  // Rank colors
  const rankColor =
    rank === 1
      ? "#FFB800" // Gold
      : rank === 2
        ? "#94A3B8" // Silver
        : rank === 3
          ? "#CD7C2F" // Bronze
          : colors.primary.main;

  const toggleExpanded = () => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setExpanded(!expanded);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/challenge/${challenge.id}`);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: expanded ? 1.5 : 1,
          borderColor: expanded ? colors.primary.main : colors.border,
        },
      ]}
    >
      {/* Header - Always visible */}
      <TouchableOpacity
        style={[styles.header, { padding: spacing.md }]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {challenge.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <UsersIcon size={12} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {friendCount > 0
                  ? `vs ${friendCount} friend${friendCount > 1 ? "s" : ""}`
                  : "Solo"}
              </Text>
            </View>
            <Text style={[styles.metaDot, { color: colors.textMuted }]}>•</Text>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.rankText, { color: rankColor }]}>
            {getRankText(rank)}
          </Text>
          {expanded ? (
            <ChevronUpIcon size={16} color={colors.textMuted} />
          ) : (
            <ChevronDownIcon size={16} color={colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <View
          style={[
            styles.expandedContent,
            {
              borderTopWidth: 1,
              borderTopColor: colors.border,
              padding: spacing.md,
            },
          ]}
        >
          {/* Rank badge */}
          <View style={styles.rankBadgeRow}>
            <View
              style={[
                styles.rankBadge,
                {
                  backgroundColor: rankColor,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                },
              ]}
            >
              {rank <= 3 && (
                <Text style={styles.rankMedal}>{getRankMedal(rank)}</Text>
              )}
              <Text style={styles.rankBadgeText}>{getRankText(rank)}</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={{ marginBottom: spacing.lg }}>
            <View style={styles.progressHeader}>
              <Text
                style={[styles.progressLabel, { color: colors.textSecondary }]}
              >
                Progress
              </Text>
              <Text
                style={[styles.progressValue, { color: colors.primary.main }]}
              >
                {progress.toLocaleString()} /{" "}
                {challenge.goal_value.toLocaleString()}
              </Text>
            </View>
            <ProgressBar
              progress={progressPercent}
              variant="primary"
              size="large"
            />
          </View>

          {/* View button */}
          <TouchableOpacity
            style={[
              styles.viewButton,
              {
                backgroundColor: colors.primary.main,
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
              },
            ]}
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <Text style={styles.viewButtonText}>View Challenge</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Compact version for completed challenges
export interface CompletedChallengeRowProps {
  challenge: ChallengeWithParticipation;
  onPress?: () => void;
}

export function CompletedChallengeRow({
  challenge,
  onPress,
}: CompletedChallengeRowProps) {
  const { colors, spacing, radius } = useAppTheme();
  const rank = challenge.my_rank || 1;
  const participantCount = challenge.participant_count || 1;
  const friendCount = Math.max(0, participantCount - 1);

  const endDate = new Date(challenge.end_date);
  const endDateStr = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const rankColor =
    rank === 1
      ? "#FFB800"
      : rank === 2
        ? "#94A3B8"
        : rank === 3
          ? "#CD7C2F"
          : colors.achievement.main;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/challenge/${challenge.id}`);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.completedRow,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.completedMedal}>
        {rank <= 3 ? getRankMedal(rank) : rank}
      </Text>
      <View style={styles.completedContent}>
        <Text
          style={[styles.completedTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {challenge.title}
        </Text>
        <Text style={[styles.completedMeta, { color: colors.textMuted }]}>
          Ended {endDateStr} •{" "}
          {friendCount > 0
            ? `${friendCount} friend${friendCount > 1 ? "s" : ""}`
            : "Solo"}
        </Text>
      </View>
      <Text style={[styles.completedRank, { color: rankColor }]}>
        {getRankText(rank)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  metaDot: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rankText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  expandedContent: {},
  rankBadgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rankMedal: {
    fontSize: 12,
  },
  rankBadgeText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#FFFFFF",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  progressValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  viewButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  // Completed row styles
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  completedMedal: {
    fontSize: 16,
    width: 24,
    textAlign: "center",
    marginRight: 12,
  },
  completedContent: {
    flex: 1,
  },
  completedTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 2,
  },
  completedMeta: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  completedRank: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginLeft: 8,
  },
});
