// app/notifications.tsx
// Notifications inbox screen - Routes to V1 or V2 based on feature flag
//
// This is a thin router that delegates to version-specific implementations.
// V1: src/components/NotificationsScreen.tsx
// V2: src/components/v2/NotificationsScreen.tsx

import React from "react";
import { LoadingScreen } from "@/components/ui";
import { useFeatureFlags } from "@/lib/featureFlags";
import { V1NotificationsScreen } from "@/components/NotificationsScreen";
import { V2NotificationsScreen } from "@/components/v2";

export default function NotificationsScreen() {
  const { isV2, isLoading: flagsLoading } = useFeatureFlags();

  // Show loading while determining version
  if (flagsLoading) {
    return <LoadingScreen />;
  }

  // Route to appropriate version
  if (isV2) {
    return <V2NotificationsScreen />;
  }

  return <V1NotificationsScreen />;
}
