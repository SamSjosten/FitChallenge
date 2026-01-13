// app/(tabs)/challenges.tsx
// Challenges list screen

import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  useActiveChallenges,
  useCompletedChallenges,
} from "@/hooks/useChallenges";
import { Card, Badge, ProgressBar, LoadingScreen } from "@/components/ui";
import { router } from "expo-router";

export default function ChallengesScreen() {
  const { colors, spacing, typography } = useAppTheme();
  const { data: activeChallenges, isLoading: loadingActive } =
    useActiveChallenges();
  const { data: completedChallenges, isLoading: loadingCompleted } =
    useCompletedChallenges();

  if (loadingActive && loadingCompleted) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Text
        style={{
          fontSize: typography.textStyles.display.fontSize,
          fontFamily: "PlusJakartaSans_700Bold",
          color: colors.textPrimary,
          marginBottom: spacing.lg,
        }}
      >
        All Challenges
      </Text>

      {/* Active Challenges */}
      {activeChallenges?.map((challenge) => (
        <Card
          key={challenge.id}
          style={{ marginBottom: spacing.md }}
          onPress={() => router.push(`/challenge/${challenge.id}`)}
        >
          <Text style={{ color: colors.textPrimary }}>{challenge.title}</Text>
          <Badge variant="primary">Active</Badge>
        </Card>
      ))}

      {/* Completed Challenges */}
      {completedChallenges?.map((challenge) => (
        <Card
          key={challenge.id}
          style={{ marginBottom: spacing.md }}
          onPress={() => router.push(`/challenge/${challenge.id}`)}
        >
          <Text style={{ color: colors.textPrimary }}>{challenge.title}</Text>
          <Badge variant="achievement">Completed</Badge>
        </Card>
      ))}
    </ScrollView>
  );
}
