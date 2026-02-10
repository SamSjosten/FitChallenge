// src/components/challenge-detail/HeaderCard.tsx
//
// The header hero card showing challenge title, status badge, stats row,
// progress bar, and log activity button.
//
// CONTRACTS ENFORCED:
// - `status` is a required prop → impossible to forget displaying it
// - `formatTimeRemaining` replaces raw `${daysLeft} days left` →
//   correct text for every lifecycle state
// - Theme tokens used for all borderRadius values

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { PlusIcon } from "react-native-heroicons/outline";
import { useAppTheme } from "@/providers/ThemeProvider";
import { getStatusLabel, getStatusColor } from "@/lib/challengeStatus";
import { getDaysRemaining } from "@/lib/serverTime";
import { TestIDs } from "@/constants/testIDs";
import { formatNumber, formatTimeRemaining, ACTIVITY_ICONS, RANK_EMOJI } from "./helpers";
import type { HeaderCardProps } from "./types";

export function HeaderCard({
  challenge,
  computedValues,
  status,
  canLog,
  onLogActivity,
}: HeaderCardProps) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const {
    myProgress,
    myRank,
    goalValue,
    progressPercent,
    daysLeft,
    participantCount,
    todayProgress,
    avgPerDay,
    showTrend,
    trend,
  } = computedValues;

  const activityIcon = ACTIVITY_ICONS[challenge.challenge_type] || "🎯";
  const statusLabel = getStatusLabel(status);
  const statusColor = getStatusColor(status);

  // Calculate days until start for upcoming challenges
  const daysUntilStart =
    status === "upcoming" ? Math.max(0, getDaysRemaining(challenge.start_date)) : undefined;

  const badgeText = formatTimeRemaining(status, daysLeft, daysUntilStart);

  return (
    <View>
      {/* Title Section */}
      <View
        style={{
          padding: spacing.md,
          backgroundColor: `${colors.primary.main}08`,
          borderBottomWidth: 1,
          borderBottomColor: `${colors.primary.main}15`,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              backgroundColor: `${colors.primary.main}20`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>{activityIcon}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: typography.fontSize.lg,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
              }}
              numberOfLines={1}
              testID={TestIDs.challengeDetail.challengeTitle}
            >
              {challenge.title}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginTop: spacing.xs,
              }}
            >
              {/* Status badge — always visible, lifecycle-aware */}
              <View
                style={{
                  backgroundColor: `${statusColor}18`,
                  paddingVertical: 2,
                  paddingHorizontal: 10,
                  borderRadius: radius.lg,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: statusColor,
                  }}
                  testID={TestIDs.challengeDetail.daysRemaining}
                >
                  {badgeText}
                </Text>
              </View>

              {/* Status label for non-active challenges */}
              {status !== "active" && (
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: statusColor,
                  }}
                >
                  • {statusLabel}
                </Text>
              )}

              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textMuted,
                }}
              >
                • {participantCount} participant
                {participantCount !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* Rank */}
        <View
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Rank
          </Text>
          <Text style={{ fontSize: 22 }}>{RANK_EMOJI[myRank] || myRank || "-"}</Text>
        </View>

        {/* Today */}
        <View
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Today
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.lg,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            {todayProgress.toLocaleString()}
          </Text>
        </View>

        {/* Trend or Avg/Day */}
        <View style={{ flex: 1, paddingVertical: 14, alignItems: "center" }}>
          {showTrend ? (
            <>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                Trend
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: trend >= 0 ? colors.primary.main : colors.error,
                }}
              >
                {trend >= 0 ? "↑" : "↓"}
                {Math.abs(trend)}%
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                Avg/Day
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: colors.textPrimary,
                }}
              >
                {formatNumber(avgPerDay)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Progress Section */}
      <View style={{ padding: spacing.md }} testID={TestIDs.challengeDetail.progressCard}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: spacing.sm,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.primary.main,
            }}
            testID={TestIDs.challengeDetail.progressText}
          >
            {myProgress.toLocaleString()}
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textMuted,
            }}
          >
            / {goalValue.toLocaleString()} {challenge.goal_unit}
          </Text>
        </View>

        <View
          style={{
            height: 8,
            backgroundColor: colors.primary.subtle,
            borderRadius: radius.progressBar,
            overflow: "hidden",
            marginBottom: spacing.md,
          }}
          testID={TestIDs.challengeDetail.progressBar}
        >
          <View
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              backgroundColor: colors.primary.main,
              borderRadius: radius.progressBar,
            }}
          />
        </View>

        {/* Log Activity button — only when canLog is true */}
        {canLog && (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              padding: 14,
              backgroundColor: colors.primary.main,
              borderRadius: radius.xl,
            }}
            onPress={onLogActivity}
            testID={TestIDs.challengeDetail.logActivityButton}
            accessibilityLabel="Log activity"
            accessibilityRole="button"
          >
            <PlusIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text
              style={{
                fontSize: typography.fontSize.base - 1,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: "#FFFFFF",
              }}
            >
              Log Activity
            </Text>
          </TouchableOpacity>
        )}

        {/* Contextual message when logging is unavailable */}
        {!canLog && status === "upcoming" && (
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textMuted,
              textAlign: "center",
              fontFamily: "PlusJakartaSans_500Medium",
            }}
          >
            Activity logging opens when the challenge starts
          </Text>
        )}
        {!canLog && status === "completed" && (
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textMuted,
              textAlign: "center",
              fontFamily: "PlusJakartaSans_500Medium",
            }}
          >
            Challenge completed — final results above
          </Text>
        )}
      </View>
    </View>
  );
}
