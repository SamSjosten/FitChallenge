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

// Logging prefix for easy filtering
const LOG = "🔑 [Biometric]";

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
  console.log(`${LOG} Checking capability...`);
  try {
    // Check if hardware supports biometrics
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    console.log(`${LOG} Has hardware: ${hasHardware}`);
    if (!hasHardware) {
      console.log(`${LOG} ❌ No biometric hardware`);
      return {
        isAvailable: false,
        biometricType: "none",
        displayName: "Not Available",
      };
    }

    // Check if biometrics are enrolled
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    console.log(`${LOG} Is enrolled: ${isEnrolled}`);
    if (!isEnrolled) {
      console.log(`${LOG} ❌ No biometrics enrolled in device settings`);
      return {
        isAvailable: false,
        biometricType: "none",
        displayName: "Not Set Up",
      };
    }

    // Get supported authentication types
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    console.log(`${LOG} Supported types: ${JSON.stringify(supportedTypes)}`);

    // Determine biometric type
    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
    ) {
      const result = {
        isAvailable: true,
        biometricType: "face" as const,
        displayName: Platform.OS === "ios" ? "Face ID" : "Face Recognition",
      };
      console.log(`${LOG} ✅ Available: ${result.displayName}`);
      return result;
    }

    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      )
    ) {
      const result = {
        isAvailable: true,
        biometricType: "fingerprint" as const,
        displayName: Platform.OS === "ios" ? "Touch ID" : "Fingerprint",
      };
      console.log(`${LOG} ✅ Available: ${result.displayName}`);
      return result;
    }

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      const result = {
        isAvailable: true,
        biometricType: "iris" as const,
        displayName: "Iris Recognition",
      };
      console.log(`${LOG} ✅ Available: ${result.displayName}`);
      return result;
    }

    console.log(`${LOG} ❌ No supported biometric type found`);
    return {
      isAvailable: false,
      biometricType: "none",
      displayName: "Not Available",
    };
  } catch (error) {
    console.error(`${LOG} ❌ Capability check failed:`, error);
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
  console.log(`${LOG} Checking if enabled...`);
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    const isEnabled = enabled === "true";
    console.log(`${LOG} Enabled flag value: "${enabled}" → ${isEnabled}`);
    return isEnabled;
  } catch (error) {
    console.error(`${LOG} ❌ Failed to check enabled status:`, error);
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
  console.log(`${LOG} 🔧 SETUP starting for ${email.substring(0, 3)}***`);
  try {
    // First, authenticate to confirm user wants to set this up
    console.log(`${LOG} Step 1: Requesting biometric authentication...`);
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to enable quick sign-in",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use Passcode",
    });
    const authError = "error" in authResult ? authResult.error : undefined;
    console.log(
      `${LOG} Auth result: success=${authResult.success}, error=${authError}`,
    );

    if (!authResult.success) {
      console.log(`${LOG} ❌ Setup cancelled/failed: ${authError}`);
      return {
        success: false,
        cancelled: authError === "user_cancel",
        error:
          authError === "user_cancel" ? "Cancelled" : "Authentication failed",
      };
    }

    // Store credentials with biometric protection
    console.log(
      `${LOG} Step 2: Storing credentials with requireAuthentication=true...`,
    );
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
    console.log(`${LOG} ✅ Credentials stored`);

    // Mark as enabled
    console.log(`${LOG} Step 3: Setting enabled flag...`);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
    console.log(`${LOG} ✅ Enabled flag set`);

    console.log(`${LOG} 🔧 SETUP complete`);
    return { success: true };
  } catch (error: any) {
    console.error(`${LOG} ❌ Setup failed:`, error?.message || error);
    return {
      success: false,
      error: error.message || "Failed to set up biometric sign-in",
    };
  }
}

/**
 * Remove stored credentials and disable biometric sign-in
 * Deletes the enabled flag FIRST to ensure isBiometricSignInEnabled returns false
 * even if credential deletion fails (credentials can't be used without the flag)
 */
export async function disableBiometricSignIn(): Promise<void> {
  console.log(`${LOG} 🗑️ DISABLING biometric sign-in...`);

  // Delete the enabled flag FIRST - this is what isBiometricSignInEnabled checks
  // Even if credential deletion fails, sign-in won't work without this flag
  try {
    console.log(
      `${LOG} Step 1: Deleting enabled flag (${BIOMETRIC_ENABLED_KEY})...`,
    );
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    console.log(`${LOG} ✅ Enabled flag deleted`);
  } catch (error: any) {
    console.error(
      `${LOG} ❌ Failed to delete enabled flag:`,
      error?.message || error,
    );
    // Continue anyway - try to delete credentials too
  }

  // Then delete credentials - this might fail on some devices but that's OK
  // since the enabled flag is already gone
  try {
    console.log(`${LOG} Step 2: Deleting credentials (${CREDENTIALS_KEY})...`);
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    console.log(`${LOG} ✅ Credentials deleted`);
  } catch (error: any) {
    // This can fail if the item was stored with requireAuthentication
    // and the OS requires auth to delete. That's OK - credentials are orphaned
    // and can't be used since the enabled flag is gone.
    console.warn(
      `${LOG} ⚠️ Credential deletion failed (safe to ignore):`,
      error?.message || error,
    );
  }

  // Verify deletion worked
  try {
    const stillEnabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    console.log(`${LOG} Verification: enabled flag is now "${stillEnabled}"`);
    if (stillEnabled === "true") {
      console.error(`${LOG} ❌ CRITICAL: Flag still exists after deletion!`);
    }
  } catch (error) {
    console.log(`${LOG} Verification: flag read failed (probably deleted)`);
  }

  console.log(`${LOG} 🗑️ DISABLE complete`);
}

// Alias for clarity in settings screens
export const clearBiometricSignIn = disableBiometricSignIn;

// =============================================================================
// BIOMETRIC SIGN-IN
// =============================================================================

/**
 * Perform biometric authentication and auto sign-in
 * Returns the result of the sign-in attempt
 */
export async function performBiometricSignIn(): Promise<BiometricSignInResult> {
  console.log(`${LOG} 🚀 SIGN-IN starting...`);
  try {
    // Check if enabled
    console.log(`${LOG} Step 1: Checking if enabled...`);
    const enabled = await isBiometricSignInEnabled();
    if (!enabled) {
      console.log(`${LOG} ❌ Not enabled, aborting`);
      return {
        success: false,
        error: "Biometric sign-in not set up",
      };
    }

    // Retrieve credentials (this will trigger biometric prompt via SecureStore)
    // On iOS, SecureStore with requireAuthentication will automatically show Face ID
    console.log(
      `${LOG} Step 2: Retrieving credentials (will trigger Face ID)...`,
    );
    const credentialsJson = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Sign in with Face ID",
    });
    console.log(
      `${LOG} Credentials retrieved: ${credentialsJson ? "yes" : "no"}`,
    );

    if (!credentialsJson) {
      // Credentials were deleted or corrupted
      console.log(`${LOG} ❌ No credentials found, disabling...`);
      await disableBiometricSignIn();
      return {
        success: false,
        error:
          "Saved credentials not found. Please sign in with your password.",
      };
    }

    const credentials: StoredCredentials = JSON.parse(credentialsJson);
    console.log(
      `${LOG} Step 3: Signing in as ${credentials.email.substring(0, 3)}***...`,
    );

    // Perform sign-in with stored credentials
    // ⚠️ NOTE: This bypasses AuthProvider.signIn() - the onAuthStateChange listener
    // will receive a SIGNED_IN event that wasn't "handled" by authActionHandledRef
    console.log(
      `${LOG} ⚠️ Calling signInWithPassword DIRECTLY (bypasses AuthProvider)`,
    );
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    console.log(
      `${LOG} signInWithPassword returned: error=${error?.message || "none"}, session=${data?.session ? "YES" : "NO"}`,
    );

    if (error) {
      console.log(`${LOG} ❌ Supabase auth error: ${error.message}`);
      // If password changed, disable biometric sign-in
      if (error.message.includes("Invalid login credentials")) {
        console.log(`${LOG} Password changed, disabling biometric...`);
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

    console.log(`${LOG} ✅ SIGN-IN successful!`);
    return { success: true };
  } catch (error: any) {
    console.error(`${LOG} ❌ Sign-in exception:`, error?.message || error);

    // Handle user cancellation
    if (
      error.message?.includes("User canceled") ||
      error.message?.includes("user_cancel") ||
      error.message?.includes("cancelled")
    ) {
      console.log(`${LOG} User cancelled Face ID prompt`);
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
