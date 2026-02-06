// src/components/v2/create/StepReview.tsx
// Step 5: Review challenge details before submitting

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { UserIcon } from "react-native-heroicons/outline";
import {
  getActivityIcon,
  activityColors,
  type ActivityType,
} from "@/components/icons/ActivityIcons";
import {
  CHALLENGE_TYPES,
  DURATION_PRESETS,
  WIN_CONDITIONS,
  type StepReviewProps,
} from "./types";

// Horizontal connector line between milestones
function MilestoneConnector({ color }: { color: string }) {
  return <View style={[styles.connector, { backgroundColor: color }]} />;
}

export function StepReview({
  mode,
  challengeType,
  formData,
  friends,
  selectedFriendIds,
  onBack,
}: StepReviewProps) {
  const { colors, radius } = useAppTheme();
  const typeConfig = CHALLENGE_TYPES.find((t) => t.id === challengeType);
  const duration = DURATION_PRESETS.find(
    (d) => d.id === formData.durationPreset,
  );
  const winConfig = WIN_CONDITIONS.find((w) => w.id === formData.winCondition);
  const goalNum = parseInt(formData.goal, 10) || 0;
  const Icon = getActivityIcon(challengeType as ActivityType);
  const typeColors =
    activityColors[challengeType as ActivityType] || activityColors.custom;

  const invitedFriends = friends.filter((f) =>
    selectedFriendIds.includes(f.friend_profile.id),
  );

  // Milestones at 25/50/75/100%
  const milestones = [25, 50, 75, 100].map((pct) => ({
    pct,
    value: Math.round((goalNum * pct) / 100),
  }));

  // Unit display
  const unitLabel =
    challengeType === "custom" && formData.customUnit
      ? formData.customUnit
      : typeConfig?.unit || "units";

  // Summary rows
  const summaryRows: { label: string; value: string }[] = [
    {
      label: "Goal",
      value: `${goalNum.toLocaleString()} ${unitLabel}`,
    },
    {
      label: "Duration",
      value:
        formData.durationPreset === "custom"
          ? `${formData.customDurationDays} days`
          : duration?.label || "Custom",
    },
    {
      label: "Starts",
      value:
        formData.startMode === "scheduled"
          ? formData.scheduledStart.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Immediately",
    },
  ];

  const dailyTarget = parseInt(formData.dailyTarget, 10);
  if (dailyTarget > 0) {
    summaryRows.push({
      label: "Daily Target",
      value: `${dailyTarget.toLocaleString()} ${unitLabel}/day`,
    });
  }

  if (mode === "social") {
    summaryRows.push({
      label: "Win Condition",
      value: winConfig?.label || "Highest Total",
    });
    summaryRows.push({
      label: "Invited",
      value: `${selectedFriendIds.length} friend${selectedFriendIds.length !== 1 ? "s" : ""}`,
    });
  }

  return (
    <View style={styles.container}>
      {/* Challenge Summary Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderRadius: radius["2xl"],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: typeColors.bg, borderRadius: radius.xl },
            ]}
          >
            <Icon size={20} color={typeColors.text} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.challengeName, { color: colors.textPrimary }]}>
              {formData.name || "Untitled"}
            </Text>
            <Text
              style={[styles.challengeMeta, { color: colors.textSecondary }]}
            >
              {typeConfig?.name} ·{" "}
              {mode === "solo" ? "Personal Goal" : "Challenge"}
            </Text>
          </View>
        </View>

        {formData.description.length > 0 && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {formData.description}
          </Text>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Summary Rows */}
        {summaryRows.map((row) => (
          <View key={row.label} style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              {row.label}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Invited Friends (social only) */}
      {mode === "social" && invitedFriends.length > 0 && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: radius["2xl"],
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Invited Friends
          </Text>
          <View style={styles.friendsList}>
            {invitedFriends.map((friend) => (
              <View key={friend.id} style={styles.friendRow}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: colors.background,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <UserIcon size={16} color={colors.textMuted} />
                </View>
                <View>
                  <Text
                    style={[styles.friendName, { color: colors.textPrimary }]}
                  >
                    {friend.friend_profile.display_name ||
                      friend.friend_profile.username}
                  </Text>
                  <Text
                    style={[
                      styles.friendUsername,
                      { color: colors.textSecondary },
                    ]}
                  >
                    @{friend.friend_profile.username}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Milestones Preview */}
      {goalNum > 0 && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: radius["2xl"],
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Milestones
          </Text>
          <View style={styles.milestonesRow}>
            {milestones.map((m, idx) => (
              <React.Fragment key={m.pct}>
                <View style={styles.milestone}>
                  <View
                    style={[
                      styles.milestoneCircle,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Text
                      style={[
                        styles.milestonePct,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {m.pct}%
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.milestoneValue,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {m.value.toLocaleString()}
                  </Text>
                </View>
                {idx < milestones.length - 1 && (
                  <MilestoneConnector color={colors.border} />
                )}
              </React.Fragment>
            ))}
          </View>
          <Text style={[styles.milestoneHint, { color: colors.textMuted }]}>
            You'll be notified at each milestone
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  challengeMeta: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 1,
  },
  description: {
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  friendsList: {
    gap: 10,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  friendName: {
    fontSize: 14,
    fontWeight: "500",
  },
  friendUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  milestonesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  milestone: {
    flex: 1,
    alignItems: "center",
  },
  milestoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  milestonePct: {
    fontSize: 11,
    fontWeight: "700",
  },
  milestoneValue: {
    fontSize: 12,
  },
  connector: {
    width: 24,
    height: StyleSheet.hairlineWidth,
    marginBottom: 20, // offset to align with circle center
  },
  milestoneHint: {
    fontSize: 12,
    textAlign: "center",
  },
});
