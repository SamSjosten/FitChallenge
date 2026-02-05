// src/components/challenge-detail-v2/YourActivitySection.tsx
//
// CONTRACTS ENFORCED:
// - `serverNow` is a required prop → impossible to use device clock for date formatting
// - No redundant .slice(0, 5) — parent already limits data

import React from "react";
import { View, Text } from "react-native";
import { HeartIcon } from "react-native-heroicons/outline";
import { useAppTheme } from "@/providers/ThemeProvider";
import { formatActivityDate } from "./helpers";
import type { YourActivitySectionProps } from "./types";

export function YourActivitySection({
  activities,
  goalUnit,
  serverNow,
}: YourActivitySectionProps) {
  const { colors, spacing, typography } = useAppTheme();

  if (!activities || activities.length === 0) {
    return (
      <View style={{ padding: spacing.md, alignItems: "center" }}>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: typography.fontSize.sm,
          }}
        >
          No activity logged yet
        </Text>
      </View>
    );
  }

  return (
    <View>
      {activities.map((activity, index) => (
        <View
          key={activity.id}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: spacing.sm,
            borderBottomWidth: index < activities.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {(activity.source === "healthkit" ||
              activity.source === "googlefit") && (
              <HeartIcon size={11} color={colors.error} />
            )}
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.textMuted,
              }}
            >
              {formatActivityDate(activity.recorded_at, serverNow)}
            </Text>
          </View>
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textPrimary,
            }}
          >
            +{activity.value.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}
