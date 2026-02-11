// src/components/challenge-detail/ChallengeInfoSection.tsx

import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { formatWinCondition } from "./helpers";
import { WORKOUT_TYPE_CATALOG } from "@/components/create-challenge/types";
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

  // Build workout types summary for workout challenges
  const getWorkoutTypeSummary = (): string | null => {
    if (challenge.challenge_type !== "workouts") return null;
    const allowed = challenge.allowed_workout_types;
    // DB convention: null/empty = all types allowed
    if (!allowed || allowed.length === 0) {
      return "All types";
    }
    // Show names of selected types (max 3, then "+N more")
    const names = allowed
      .map((id: string) => WORKOUT_TYPE_CATALOG.find((w) => w.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return "All types"; // All IDs unrecognized — safe fallback
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
  };

  const infoItems: { label: string; value: string }[] = [
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

  // Insert workout types row after Goal for workout challenges
  const workoutSummary = getWorkoutTypeSummary();
  if (workoutSummary) {
    infoItems.splice(1, 0, {
      label: "Workout Types",
      value: workoutSummary,
    });
  }

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
              flexShrink: 1,
              textAlign: "right",
              maxWidth: "60%",
            }}
            numberOfLines={2}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
