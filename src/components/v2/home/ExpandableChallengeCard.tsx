// src/components/v2/home/ExpandableChallengeCard.tsx
// V2 Expandable challenge card with inline leaderboard
// Design System v2.0 - Based on home screen mockup
//
// Features:
// - Left accent border (green for active)
// - Collapsed: icon, title, meta, progress %, rank badge, chevron
// - Expanded: Log Activity button, goal text, inline leaderboard (L4)
// - Progress bar hidden when expanded (R1 behavior)
// - Lazy-loads leaderboard data when expanded
// - Title tap navigates to challenge detail

import React from "react";
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
import { useLeaderboard } from "@/hooks/useChallenges";
import { LeaderboardPreview } from "./LeaderboardPreview";
import { getDaysRemaining } from "@/lib/serverTime";
import { ChevronDownIcon, ChevronUpIcon } from "react-native-heroicons/outline";
import { PlusIcon } from "react-native-heroicons/solid";
import type { ChallengeWithParticipation } from "@/services/challenges";
import {
  getActivityIcon,
  type ActivityType,
} from "@/components/icons/ActivityIcons";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// TYPES
// ============================================================================
export interface ExpandableChallengeCardProps {
  challenge: ChallengeWithParticipation;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================
function getRankEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

// ============================================================================
// COMPONENT
// ============================================================================
export function ExpandableChallengeCard({
  challenge,
  isExpanded,
  onToggleExpand,
}: ExpandableChallengeCardProps) {
  const { colors, spacing, radius } = useAppTheme();

  // Lazy-load leaderboard only when expanded
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(
    challenge.id,
    { enabled: isExpanded, limit: 10 }, // Only fetch when expanded, limit to top 10
  );

  // Derived values
  const progress = challenge.my_participation?.current_progress || 0;
  const progressPercent = Math.min(
    (progress / challenge.goal_value) * 100,
    100,
  );
  const rank = challenge.my_rank || 1;
  const daysLeft = getDaysRemaining(challenge.end_date);

  // Get activity icon
  const ActivityIcon = getActivityIcon(
    challenge.challenge_type as ActivityType,
  );

  // Navigation handlers
  const handleTitlePress = () => {
    router.push(`/challenge/${challenge.id}`);
  };

  const handleLogActivity = () => {
    router.push(`/challenge/${challenge.id}/log`);
  };

  const handleViewAllParticipants = () => {
    router.push(`/challenge/${challenge.id}?tab=leaderboard`);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${colors.primary.main}08`,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: `${colors.primary.main}20`,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary.main,
        },
      ]}
    >
      {/* ================================================================== */}
      {/* CARD HEADER - Tappable to expand/collapse */}
      {/* ================================================================== */}
      <TouchableOpacity
        style={[styles.header, { padding: spacing.md }]}
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.headerRow}>
          {/* Icon + Title + Meta */}
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: `${colors.primary.main}20`,
                  borderRadius: radius.md,
                },
              ]}
            >
              <ActivityIcon size={18} color={colors.primary.main} />
            </View>

            <View style={styles.titleContainer}>
              {/* Title - tappable to go to detail */}
              <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.7}>
                <Text
                  style={[styles.title, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {challenge.title}
                </Text>
              </TouchableOpacity>

              {/* Meta line: days left + progress % */}
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left •{" "}
                <Text style={{ color: colors.primary.main, fontWeight: "600" }}>
                  {Math.round(progressPercent)}% complete
                </Text>
              </Text>
            </View>
          </View>

          {/* Rank badge + Chevron */}
          <View style={styles.headerRight}>
            <View
              style={[
                styles.rankBadge,
                {
                  backgroundColor:
                    rank === 1
                      ? "rgba(255, 215, 0, 0.15)"
                      : `${colors.textMuted}15`,
                  borderRadius: radius.full,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                },
              ]}
            >
              <Text style={styles.rankEmoji}>{getRankEmoji(rank)}</Text>
            </View>
            {isExpanded ? (
              <ChevronUpIcon size={16} color={colors.textMuted} />
            ) : (
              <ChevronDownIcon size={16} color={colors.textMuted} />
            )}
          </View>
        </View>

        {/* ================================================================ */}
        {/* PROGRESS BAR - Hidden when expanded (R1 rule) */}
        {/* ================================================================ */}
        {!isExpanded && (
          <View style={{ marginTop: spacing.sm }}>
            <View style={styles.progressRow}>
              <Text
                style={[styles.progressCurrent, { color: colors.textPrimary }]}
              >
                {progress.toLocaleString()}
              </Text>
              <Text style={[styles.progressGoal, { color: colors.textMuted }]}>
                / {challenge.goal_value.toLocaleString()} {challenge.goal_unit}
              </Text>
            </View>
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
                    width: `${progressPercent}%`,
                    backgroundColor: colors.primary.main,
                    borderRadius: radius.xs,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* ==================================================================== */}
      {/* EXPANDED CONTENT - Leaderboard + Actions */}
      {/* ==================================================================== */}
      {isExpanded && (
        <View
          style={[
            styles.expandedContent,
            {
              borderTopWidth: 1,
              borderTopColor: `${colors.primary.main}15`,
              backgroundColor: `${colors.primary.main}04`,
              padding: spacing.md,
            },
          ]}
        >
          {/* Header row: Log Activity button + Goal */}
          <View style={styles.expandedHeader}>
            <TouchableOpacity
              style={[
                styles.logButton,
                {
                  backgroundColor: colors.primary.main,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 10,
                },
              ]}
              onPress={handleLogActivity}
              activeOpacity={0.8}
            >
              <PlusIcon size={14} color="#000" />
              <Text style={styles.logButtonText}>Log Activity</Text>
            </TouchableOpacity>

            <Text style={[styles.goalText, { color: colors.textMuted }]}>
              Goal: {challenge.goal_value.toLocaleString()}{" "}
              {challenge.goal_unit}
            </Text>
          </View>

          {/* Leaderboard Preview */}
          <View style={{ marginTop: spacing.md }}>
            <LeaderboardPreview
              entries={leaderboard || []}
              goalValue={challenge.goal_value}
              isLoading={isLeaderboardLoading}
              onViewAll={handleViewAllParticipants}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  header: {},
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankEmoji: {
    fontSize: 13,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  progressCurrent: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  progressGoal: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },
  expandedContent: {},
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logButtonText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#000",
  },
  goalText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
