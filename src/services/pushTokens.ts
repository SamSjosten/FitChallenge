// src/services/pushTokens.ts
// Push token registration service
// CONTRACT: Tokens are self-managed via RLS policy

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { getSupabaseClient, withAuth } from "@/lib/supabase";

// =============================================================================
// TYPES
// =============================================================================

type PushTokenPlatform = "ios" | "android" | "web";

interface RegistrationResult {
  success: boolean;
  token?: string;
  error?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the current platform as a DB-compatible string
 */
function getPlatform(): PushTokenPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/**
 * Check if push notifications are supported on this device
 */
function isNotificationSupported(): boolean {
  return Device.isDevice;
}

// =============================================================================
// SERVICE
// =============================================================================

export const pushTokenService = {
  /**
   * Request notification permission from the user
   * Returns true if granted, false otherwise
   * Does NOT throw on denial - caller should handle gracefully
   */
  async requestPermission(): Promise<boolean> {
    if (!isNotificationSupported()) {
      console.warn("Push notifications not supported (not a physical device)");
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === "granted") {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  },

  /**
   * Check if notification permission is currently granted
   * Useful for conditional UI display
   */
  async hasPermission(): Promise<boolean> {
    if (!isNotificationSupported()) {
      return false;
    }

    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  },

  /**
   * Register the device's push token with the server
   *
   * CONTRACT: Uses upsert to handle re-registration gracefully
   * CONTRACT: Updates last_seen_at to track active tokens
   *
   * @param skipPermissionCheck - If true, assumes permission already granted
   * @returns RegistrationResult with success status and optional token/error
   */
  async registerToken(skipPermissionCheck = false): Promise<RegistrationResult> {
    if (!isNotificationSupported()) {
      return {
        success: false,
        error: "Push notifications not supported on this device",
      };
    }

    // Check/request permission unless skipped
    if (!skipPermissionCheck) {
      const hasPermission = await this.hasPermission();
      if (!hasPermission) {
        return {
          success: false,
          error: "Notification permission not granted",
        };
      }
    }

    try {
      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const token = tokenData.data;

      if (!token) {
        return {
          success: false,
          error: "Failed to get push token",
        };
      }

      // Upsert token to database
      return withAuth(async (userId) => {
        const { error } = await getSupabaseClient().from("push_tokens").upsert(
          {
            user_id: userId,
            token,
            platform: getPlatform(),
            last_seen_at: new Date().toISOString(),
            disabled_at: null, // Re-enable if previously disabled
          },
          {
            onConflict: "user_id,token",
          },
        );

        if (error) {
          console.error("Failed to upsert push token:", error);
          return {
            success: false,
            error: error.message,
          };
        }

        return {
          success: true,
          token,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Push token registration failed:", message);
      return {
        success: false,
        error: message,
      };
    }
  },

  /**
   * Disable the current device's push token
   * Called on sign-out to prevent pushes to signed-out devices
   *
   * CONTRACT: Sets disabled_at rather than deleting (audit trail)
   */
  async disableCurrentToken(): Promise<void> {
    if (!isNotificationSupported()) {
      return;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const token = tokenData.data;

      if (!token) {
        return;
      }

      // Disable token in database (RLS ensures user can only update their own)
      const { error } = await getSupabaseClient()
        .from("push_tokens")
        .update({ disabled_at: new Date().toISOString() })
        .eq("token", token);

      if (error) {
        console.warn("Failed to disable push token:", error);
      }
    } catch (err) {
      // Non-critical - log and continue with sign-out
      console.warn("Error disabling push token:", err);
    }
  },

  /**
   * Request permission and register token in one call
   * Convenience method for contextual permission requests
   *
   * @returns RegistrationResult with success status
   */
  async requestAndRegister(): Promise<RegistrationResult> {
    const granted = await this.requestPermission();

    if (!granted) {
      return {
        success: false,
        error: "Permission denied by user",
      };
    }

    return this.registerToken(true); // Skip permission check since we just requested
  },
};
