// src/hooks/useNotificationHandler.ts
// Push notification tap → deep link routing
//
// Extracted from app/_layout.tsx (Phase 3 refactor)
// No logic changes — identical to the inline version.
//
// Handles three app states:
// - Foreground: listener fires immediately
// - Background: listener fires when app resumes
// - Killed: getLastNotificationResponseAsync() catches queued tap

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

/**
 * Handles notification tap responses and navigates to the relevant screen.
 * Must be called inside a navigation context (after router is available).
 */
export function useNotificationHandler() {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Handle notification taps (foreground + background)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      if (data?.challenge_id) {
        router.push({
          pathname: "/challenge/[id]",
          params: { id: data.challenge_id as string },
        });
      } else if (data?.notification_type === "friend_request_received") {
        router.push("/(tabs)/friends");
      }
    });

    // Handle tap from killed state (queued notification response)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data?.challenge_id) {
          router.push({
            pathname: "/challenge/[id]",
            params: { id: data.challenge_id as string },
          });
        } else if (data?.notification_type === "friend_request_received") {
          router.push("/(tabs)/friends");
        }
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);
}
