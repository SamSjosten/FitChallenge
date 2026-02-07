// app/challenge/[id].tsx
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { LoadingState } from "@/components/shared";
import { ChallengeDetailScreen } from "@/components/challenge-detail";

export default function ChallengeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <LoadingState message="Loading challenge..." />;
  }

  return <ChallengeDetailScreen challengeId={id} />;
}
