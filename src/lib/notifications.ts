// src/lib/notifications.ts
// Notification platform setup — no React, no hooks
//
// Extracted from app/_layout.tsx (Phase 3 refactor)
// No logic changes — identical to the inline version.

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Configure how notifications appear when the app is in the foreground.
 * Must be called at module scope (before any component renders).
 */
export function configureForegroundHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Create the Android notification channel (required for Android 8+).
 * No-op on iOS. Safe to call multiple times.
 */
export async function setupNotificationChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("challenge-notifications", {
      name: "Challenge Notifications",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00D26A", // Electric Mint
    });
  }
}
