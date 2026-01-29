// src/lib/biometricSignIn.ts
// Biometric Quick Sign-In - Secure credential storage with biometric protection
//
// This module handles:
// - Storing credentials encrypted, requiring biometric to access
// - Checking if biometric sign-in is set up
// - Performing biometric authentication and auto sign-in
//
// SECURITY: Credentials are stored with WHEN_UNLOCKED_THIS_DEVICE_ONLY
// and requireAuthentication=true, meaning Face ID/Touch ID is required
// every time credentials are accessed.

import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import { getSupabaseClient } from "./supabase";

// =============================================================================
// CONSTANTS
// =============================================================================

const CREDENTIALS_KEY = "fitchallenge_biometric_credentials";
const BIOMETRIC_ENABLED_KEY = "fitchallenge_biometric_signin_enabled";

// =============================================================================
// TYPES
// =============================================================================

export interface BiometricCapability {
  isAvailable: boolean;
  biometricType: "face" | "fingerprint" | "iris" | "none";
  displayName: string;
}

export interface StoredCredentials {
  email: string;
  password: string;
}

export interface BiometricSignInResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
}

// =============================================================================
// CAPABILITY CHECK
// =============================================================================

/**
 * Check device biometric capabilities
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  try {
    // Check if hardware supports biometrics
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        isAvailable: false,
        biometricType: "none",
        displayName: "Not Available",
      };
    }

    // Check if biometrics are enrolled
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return {
        isAvailable: false,
        biometricType: "none",
        displayName: "Not Set Up",
      };
    }

    // Get supported authentication types
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    // Determine biometric type
    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
    ) {
      return {
        isAvailable: true,
        biometricType: "face",
        displayName: Platform.OS === "ios" ? "Face ID" : "Face Recognition",
      };
    }

    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      )
    ) {
      return {
        isAvailable: true,
        biometricType: "fingerprint",
        displayName: Platform.OS === "ios" ? "Touch ID" : "Fingerprint",
      };
    }

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return {
        isAvailable: true,
        biometricType: "iris",
        displayName: "Iris Recognition",
      };
    }

    return {
      isAvailable: false,
      biometricType: "none",
      displayName: "Not Available",
    };
  } catch (error) {
    console.error("[BiometricSignIn] Capability check failed:", error);
    return {
      isAvailable: false,
      biometricType: "none",
      displayName: "Error",
    };
  }
}

// =============================================================================
// SETUP STATUS
// =============================================================================

/**
 * Check if biometric sign-in is set up (credentials stored)
 */
export async function isBiometricSignInEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.error("[BiometricSignIn] Failed to check enabled status:", error);
    return false;
  }
}

// =============================================================================
// CREDENTIAL STORAGE
// =============================================================================

/**
 * Store credentials with biometric protection
 * Requires biometric authentication to store
 */
export async function setupBiometricSignIn(
  email: string,
  password: string,
): Promise<BiometricSignInResult> {
  try {
    // First, authenticate to confirm user wants to set this up
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to enable quick sign-in",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use Passcode",
    });

    if (!authResult.success) {
      return {
        success: false,
        cancelled: authResult.error === "user_cancel",
        error:
          authResult.error === "user_cancel"
            ? "Cancelled"
            : "Authentication failed",
      };
    }

    // Store credentials with biometric protection
    const credentials: StoredCredentials = { email, password };

    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify(credentials),
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        requireAuthentication: true,
        authenticationPrompt: "Access your saved sign-in credentials",
      },
    );

    // Mark as enabled
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");

    console.log("[BiometricSignIn] Setup complete");
    return { success: true };
  } catch (error: any) {
    console.error("[BiometricSignIn] Setup failed:", error);
    return {
      success: false,
      error: error.message || "Failed to set up biometric sign-in",
    };
  }
}

/**
 * Remove stored credentials and disable biometric sign-in
 */
export async function disableBiometricSignIn(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    console.log("[BiometricSignIn] Disabled");
  } catch (error) {
    console.error("[BiometricSignIn] Failed to disable:", error);
  }
}

// =============================================================================
// BIOMETRIC SIGN-IN
// =============================================================================

/**
 * Perform biometric authentication and auto sign-in
 * Returns the result of the sign-in attempt
 */
export async function performBiometricSignIn(): Promise<BiometricSignInResult> {
  try {
    // Check if enabled
    const enabled = await isBiometricSignInEnabled();
    if (!enabled) {
      return {
        success: false,
        error: "Biometric sign-in not set up",
      };
    }

    // Retrieve credentials (this will trigger biometric prompt via SecureStore)
    // On iOS, SecureStore with requireAuthentication will automatically show Face ID
    const credentialsJson = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Sign in with Face ID",
    });

    if (!credentialsJson) {
      // Credentials were deleted or corrupted
      await disableBiometricSignIn();
      return {
        success: false,
        error:
          "Saved credentials not found. Please sign in with your password.",
      };
    }

    const credentials: StoredCredentials = JSON.parse(credentialsJson);

    // Perform sign-in with stored credentials
    const { error } = await getSupabaseClient().auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      // If password changed, disable biometric sign-in
      if (error.message.includes("Invalid login credentials")) {
        await disableBiometricSignIn();
        return {
          success: false,
          error:
            "Your password has changed. Please sign in with your new password.",
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    console.log("[BiometricSignIn] Sign-in successful");
    return { success: true };
  } catch (error: any) {
    console.error("[BiometricSignIn] Sign-in failed:", error);

    // Handle user cancellation
    if (
      error.message?.includes("User canceled") ||
      error.message?.includes("user_cancel") ||
      error.message?.includes("cancelled")
    ) {
      return {
        success: false,
        cancelled: true,
        error: "Cancelled",
      };
    }

    return {
      success: false,
      error: error.message || "Biometric sign-in failed",
    };
  }
}

// =============================================================================
// UTILITY
// =============================================================================

/**
 * Get the stored email (for display purposes, without requiring biometric)
 * Note: This only returns email, not password
 */
export async function getStoredEmail(): Promise<string | null> {
  try {
    // We can't get the email without biometric auth since it's stored together
    // Instead, we could store email separately (unprotected) if needed for display
    // For now, return null - the button will show generic text
    return null;
  } catch (error) {
    return null;
  }
}
