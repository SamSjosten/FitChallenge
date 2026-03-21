// src/hooks/useNotificationHandler.ts
// Push notification tap → deep link routing
//
// Handles three app states:
// - Foreground: listener fires immediately
// - Background: listener fires when app resumes
// - Killed: getLastNotificationResponseAsync() catches queued tap
//
// Safety:
// - Buffers intents until auth hydration completes (prevents pre-auth routing)
// - Deduplicates cold-start replays from getLastNotificationResponseAsync()
// - Validates payloads with Zod at parse boundary
// - Only routes on DEFAULT_ACTION_IDENTIFIER (future-proofs custom actions)

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient, QueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { z } from "zod";

import { notificationsService } from "@/services/notifications";
import { notificationsKeys } from "@/lib/queryKeys";
import { captureError } from "@/lib/sentry";

// =============================================================================
// PAYLOAD VALIDATION
// =============================================================================

const notificationPayloadSchema = z
  .object({
    challenge_id: z.string().uuid().optional(),
    notification_type: z.string().optional(),
    notification_id: z.string().uuid().optional(),
  })
  .passthrough();

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

export function parseNotificationPayload(
  data: unknown,
): NotificationPayload | null {
  const result = notificationPayloadSchema.safeParse(data);
  if (!result.success) {
    if (__DEV__) console.warn("Invalid notification payload:", data);
    captureError(new Error("Invalid notification payload"), {
      context: "notification-payload-parse",
    });
    return null;
  }
  return result.data;
}

// =============================================================================
// MARK-READ HELPER
// =============================================================================

async function markNotificationReadFromTap(
  notificationId: string,
  queryClient: QueryClient,
): Promise<void> {
  try {
    await notificationsService.markAsRead(notificationId);
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() }),
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.unreadCount(),
      }),
    ]);
  } catch {
    // Non-fatal: notification will appear unread until next sync
  }
}

// =============================================================================
// RESPONSE KEY (for cold-start dedupe)
// =============================================================================

export function getResponseKey(
  response: Notifications.NotificationResponse,
): string {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Handles notification tap responses and navigates to the relevant screen.
 * Must be called inside a navigation context (after router is available).
 *
 * @param isHydrated - Pass `true` once auth loading is complete (!isLoading).
 *   When false, intents are buffered and flushed on hydration.
 * @param hasSession - Pass `true` when an authenticated session exists.
 *   Prevents routing when hydration completes without auth (logged-out state).
 */
export function useNotificationHandler(isHydrated: boolean, hasSession: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const pendingResponse =
    useRef<Notifications.NotificationResponse | null>(null);
  const handledResponseKey = useRef<string | null>(null);

  function routeFromResponse(
    response: Notifications.NotificationResponse,
    isColdStart = false,
  ) {
    // Only navigate for default tap action; custom actions would branch here
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
      return;

    // Cold-start dedupe: prevent getLastNotificationResponseAsync() replay
    if (isColdStart) {
      const key = getResponseKey(response);
      if (handledResponseKey.current === key) return;
      handledResponseKey.current = key;
    }

    const data = parseNotificationPayload(
      response.notification.request.content.data,
    );
    if (!data) return;

    if (data.challenge_id) {
      router.push({
        pathname: "/challenge/[id]",
        params: { id: data.challenge_id },
      });
    } else if (data.notification_type === "friend_request_received") {
      router.push("/(tabs)/friends");
    }

    // Mark notification read if ID available
    if (data.notification_id) {
      markNotificationReadFromTap(data.notification_id, queryClient);
    }
  }

  // Flush buffered intent once hydrated AND authenticated (cold-start path)
  useEffect(() => {
    if (isHydrated && hasSession && pendingResponse.current) {
      routeFromResponse(pendingResponse.current, true);
      pendingResponse.current = null;
    }
  }, [isHydrated, hasSession]);

  // Clear buffered intent if hydration completes without a session
  // Prevents stale replay if a different user logs in later
  useEffect(() => {
    if (isHydrated && !hasSession) {
      pendingResponse.current = null;
    }
  }, [isHydrated, hasSession]);

  useEffect(() => {
    let cancelled = false;

    function handleResponse(
      response: Notifications.NotificationResponse,
      isColdStart = false,
    ) {
      if (cancelled) return;
      if (!isHydrated) {
        pendingResponse.current = response; // Still loading — buffer
        return;
      }
      if (!hasSession) {
        pendingResponse.current = null; // Hydrated but no user — discard
        return;
      }
      routeFromResponse(response, isColdStart);
    }

    // Handle notification taps (foreground + background)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((r) =>
        handleResponse(r, false),
      );

    // Cold-start: handle queued tap, then clear emitter state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleResponse(response, true);
        // Clean up emitter state to prevent stale replays
        void Notifications.clearLastNotificationResponseAsync?.().catch(
          () => {},
        );
      }
    });

    return () => {
      cancelled = true;
      responseListener.current?.remove();
    };
  }, [router, isHydrated, hasSession, queryClient]);
}
