// src/components/challenge-detail/LeaderboardSection.tsx
//
// CONTRACTS ENFORCED:
// - `viewerRole` required → component gates itself (no external if/else)
// - Percent display clamped to match bar (fixes B5)

import React, { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useAppTheme } from "@/providers/ThemeProvider";
import { Avatar } from "@/components/shared";
import { TestIDs } from "@/constants/testIDs";
import { formatNumber, RANK_EMOJI, LEADERBOARD_DISPLAY_LIMIT } from "./helpers";
import type { LeaderboardSectionProps } from "./types";

// =============================================================================
// ANIMATED BAR
// =============================================================================

function AnimatedBar({ percent, color }: { percent: number; color: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(percent, 100), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute" as const,
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: `${color}15`,
          borderRightWidth: 2,
          borderRightColor: `${color}40`,
        },
        animatedStyle,
      ]}
    />
  );
}

// =============================================================================
// LEADERBOARD SECTION
// =============================================================================

export function LeaderboardSection({
  leaderboard,
  goalValue,
  currentUserId,
  viewerRole,
  showAll,
  onToggleShowAll,
}: LeaderboardSectionProps) {
  const { colors, spacing, typography } = useAppTheme();

  // Pending invitees see lock message — gated by contract, not by parent
  if (viewerRole === "pending") {
    return (
      <View
        testID={TestIDs.challengeDetail.leaderboardLocked}
        style={{ padding: spacing.lg, alignItems: "center" }}
      >
        <Text
          style={{
            fontSize: typography.fontSize.base,
            fontFamily: "PlusJakartaSans_500Medium",
            color: colors.textMuted,
          }}
        >
          🔒 Accept the challenge to view leaderboard
        </Text>
      </View>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: "center" }}>
        <Text style={{ color: colors.textMuted }}>No participants yet</Text>
      </View>
    );
  }

  const displayList = showAll
    ? leaderboard
    : leaderboard.slice(0, LEADERBOARD_DISPLAY_LIMIT);
  const remaining = leaderboard.length - LEADERBOARD_DISPLAY_LIMIT;

  return (
    <View
      style={{ borderRadius: 10, overflow: "hidden" }}
      testID={TestIDs.challengeDetail.leaderboardSection}
    >
      {displayList.map((entry, index) => {
        // Clamp percent for both bar AND text (fixes B5)
        const rawPercent =
          goalValue > 0 ? (entry.current_progress / goalValue) * 100 : 0;
        const clampedPercent = Math.min(rawPercent, 100);
        const isYou = entry.user_id === currentUserId;
        const barColor = isYou ? colors.primary.main : colors.textMuted;
        const isLast = index === displayList.length - 1 && remaining <= 0;

        return (
          <View
            key={entry.user_id}
            testID={
              isYou
                ? TestIDs.challengeDetail.leaderboardEntryHighlighted(
                    entry.profile.username,
                  )
                : TestIDs.challengeDetail.leaderboardEntry(index)
            }
            style={{
              position: "relative",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: colors.border,
              overflow: "hidden",
            }}
          >
            {/* Background fill bar (animated) */}
            <AnimatedBar percent={clampedPercent} color={barColor} />

            {/* Content */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
                zIndex: 1,
              }}
            >
              {/* Rank */}
              <View style={{ width: 22, alignItems: "center" }}>
                {entry.rank <= 3 ? (
                  <Text style={{ fontSize: 14 }}>{RANK_EMOJI[entry.rank]}</Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "PlusJakartaSans_700Bold",
                      color: colors.textMuted,
                    }}
                  >
                    {entry.rank}
                  </Text>
                )}
              </View>

              {/* Avatar */}
              <Avatar
                name={entry.profile.display_name || entry.profile.username}
                size="sm"
                style={
                  isYou ? { backgroundColor: colors.primary.main } : undefined
                }
              />

              {/* Name */}
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: isYou
                    ? "PlusJakartaSans_600SemiBold"
                    : "PlusJakartaSans_500Medium",
                  color: colors.textPrimary,
                }}
                numberOfLines={1}
              >
                {isYou
                  ? "You"
                  : entry.profile.display_name || entry.profile.username}
              </Text>

              {/* Today's Change */}
              {entry.today_change > 0 && (
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.primary.dark,
                  }}
                >
                  +{formatNumber(entry.today_change)}
                </Text>
              )}

              {/* Percentage — clamped to match bar (fixes B5) */}
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: isYou ? colors.primary.dark : colors.textSecondary,
                  width: 38,
                  textAlign: "right",
                }}
              >
                {Math.round(clampedPercent)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* +X more button */}
      {remaining > 0 && !showAll && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 12,
          }}
          onPress={onToggleShowAll}
          accessibilityLabel={`Show ${remaining} more participants`}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
            }}
          >
            +{remaining} more
          </Text>
        </TouchableOpacity>
      )}

      {/* Show less button */}
      {showAll && leaderboard.length > LEADERBOARD_DISPLAY_LIMIT && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 12,
          }}
          onPress={onToggleShowAll}
          accessibilityLabel="Show fewer participants"
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
            }}
          >
            Show less
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
