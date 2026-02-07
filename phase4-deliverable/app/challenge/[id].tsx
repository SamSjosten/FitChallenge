// app/challenge/[id].tsx
// Challenge detail screen

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { LoadingScreen } from "@/components/shared";
import { ChallengeDetailScreen } from "@/components/challenge-detail";

// =============================================================================
// ROUTER COMPONENT
// =============================================================================

export default function ChallengeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <LoadingScreen />;
  }

  return <ChallengeDetailScreen challengeId={id} />;
}
