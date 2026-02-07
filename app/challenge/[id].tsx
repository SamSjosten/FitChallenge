// app/challenge/[id].tsx
// Challenge detail screen

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { LoadingScreen } from "@/components/ui";
import { ChallengeDetailScreenV2 } from "@/components/challenge-detail-v2";

// =============================================================================
// ROUTER COMPONENT
// =============================================================================

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <LoadingScreen />;
  }

  return <ChallengeDetailScreenV2 challengeId={id} />;
}
