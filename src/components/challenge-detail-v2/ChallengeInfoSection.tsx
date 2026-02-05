// src/components/challenge-detail-v2/ChallengeInfoSection.tsx

import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { formatWinCondition } from "./helpers";
import type { ChallengeInfoSectionProps } from "./types";

export function ChallengeInfoSection({
  challenge,
  status: _status, // Available for future lifecycle-aware rendering
}: ChallengeInfoSectionProps) {
  const { colors, spacing, typography } = useAppTheme();

  const formatDateRange = () => {
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    return `${start.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}`;
  };

  const infoItems = [
    {
      label: "Goal",
      value: `${challenge.goal_value.toLocaleString()} ${challenge.goal_unit}`,
    },
    { label: "Duration", value: formatDateRange() },
    {
      label: "Win Condition",
      value: formatWinCondition(challenge.win_condition),
    },
    { label: "Created by", value: challenge.creator_name || "Unknown" },
  ];

  return (
    <View>
      {infoItems.map((item, index) => (
        <View
          key={item.label}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: spacing.sm,
            borderBottomWidth: index < infoItems.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.textMuted,
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textPrimary,
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
