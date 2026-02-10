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
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    console.log(`${LOG} Supported types: ${JSON.stringify(supportedTypes)}`);

    // Determine biometric type
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      const result = {
        isAvailable: true,
        biometricType: "face" as const,
        displayName: Platform.OS === "ios" ? "Face ID" : "Face Recognition",
      };
      console.log(`${LOG} ✅ Available: ${result.displayName}`);
      return result;
    }

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
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
    console.log(`${LOG} Auth result: success=${authResult.success}, error=${authError}`);

    if (!authResult.success) {
      console.log(`${LOG} ❌ Setup cancelled/failed: ${authError}`);

      // Check for specific error types (expo-local-authentication error codes)
      if (authError === "user_cancel" || authError === "system_cancel") {
        return {
          success: false,
          cancelled: true,
          error: "Cancelled",
        };
      }

      if (authError === "lockout") {
        return {
          success: false,
          error: "Too many failed attempts. Please try again later.",
        };
      }

      if (authError === "user_fallback") {
        // User chose to use passcode instead - this is still a valid auth
        // But since we're setting up biometric specifically, treat as cancel
        return {
          success: false,
          cancelled: true,
          error: "Please use biometric authentication to set up quick sign-in.",
        };
      }

      return {
        success: false,
        cancelled: false,
        error: "Authentication failed. Please try again.",
      };
    }

    // Store credentials with biometric protection
    console.log(`${LOG} Step 2: Storing credentials with requireAuthentication=true...`);
    const credentials: StoredCredentials = { email, password };

    await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      requireAuthentication: true,
      authenticationPrompt: "Access your saved sign-in credentials",
    });
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
    console.log(`${LOG} Step 1: Deleting enabled flag (${BIOMETRIC_ENABLED_KEY})...`);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    console.log(`${LOG} ✅ Enabled flag deleted`);
  } catch (error: any) {
    console.error(`${LOG} ❌ Failed to delete enabled flag:`, error?.message || error);
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
    console.warn(`${LOG} ⚠️ Credential deletion failed (safe to ignore):`, error?.message || error);
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
 * Type for the signIn function from AuthProvider.
 * This ensures biometric sign-in uses the same code path as manual sign-in,
 * preventing auth state desync issues.
 */
export type SignInFunction = (email: string, password: string) => Promise<void>;

/**
 * Perform biometric authentication and auto sign-in
 *
 * @param signIn - The signIn function from AuthProvider. This ensures all sign-ins
 *                 go through the central auth state management, preventing state desync.
 *                 The bug we fixed: when biometric called Supabase directly,
 *                 AuthProvider's authActionHandledRef wasn't set, causing the
 *                 onAuthStateChange listener to skip processing the SIGNED_IN event.
 * @returns The result of the sign-in attempt
 */
export async function performBiometricSignIn(
  signIn: SignInFunction,
): Promise<BiometricSignInResult> {
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
    console.log(`${LOG} Step 2: Retrieving credentials (will trigger Face ID)...`);
    const credentialsJson = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Sign in with Face ID",
    });
    console.log(`${LOG} Credentials retrieved: ${credentialsJson ? "yes" : "no"}`);

    if (!credentialsJson) {
      // Credentials were deleted or corrupted
      console.log(`${LOG} ❌ No credentials found, disabling...`);
      await disableBiometricSignIn();
      return {
        success: false,
        error: "Saved credentials not found. Please sign in with your password.",
      };
    }

    // Parse credentials with error handling
    let credentials: StoredCredentials;
    try {
      credentials = JSON.parse(credentialsJson);
      if (!credentials.email || !credentials.password) {
        throw new Error("Invalid credential format");
      }
    } catch (parseError) {
      console.log(`${LOG} ❌ Credentials corrupted, disabling...`);
      await disableBiometricSignIn();
      return {
        success: false,
        error: "Saved credentials are corrupted. Please sign in with your password.",
      };
    }

    console.log(`${LOG} Step 3: Signing in as ${credentials.email.substring(0, 3)}***...`);

    // Perform sign-in through AuthProvider for consistent state management
    // This ensures authActionHandledRef is set correctly, preventing the bug where
    // onAuthStateChange would skip processing because actionHandled was stale
    console.log(`${LOG} ✅ Calling signIn through AuthProvider`);
    try {
      await signIn(credentials.email, credentials.password);
      console.log(`${LOG} ✅ SIGN-IN successful!`);
      return { success: true };
    } catch (signInError: any) {
      console.log(`${LOG} ❌ Auth error: ${signInError.message}`);

      // If password changed, disable biometric sign-in
      if (signInError.message?.includes("Invalid login credentials")) {
        console.log(`${LOG} Password changed, disabling biometric...`);
        await disableBiometricSignIn();
        return {
          success: false,
          error: "Your password has changed. Please sign in with your new password.",
        };
      }
      return {
        success: false,
        error: signInError.message || "Sign-in failed",
      };
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error(`${LOG} ❌ Sign-in exception:`, errorMessage);

    // Handle user cancellation (various forms iOS can report this)
    if (
      errorMessage.includes("User canceled") ||
      errorMessage.includes("user_cancel") ||
      errorMessage.includes("cancelled") ||
      errorMessage.includes("Canceled") ||
      errorMessage.includes("LAErrorUserCancel")
    ) {
      console.log(`${LOG} User cancelled Face ID prompt`);
      return {
        success: false,
        cancelled: true,
        error: "Cancelled",
      };
    }

    // Handle biometric lockout (too many failed attempts)
    if (
      errorMessage.includes("locked out") ||
      errorMessage.includes("LAErrorBiometryLockout") ||
      errorMessage.includes("Too many attempts")
    ) {
      console.log(`${LOG} Biometric locked out`);
      return {
        success: false,
        error: "Too many failed attempts. Please use your password.",
      };
    }

    // Handle biometric not available (user disabled Face ID)
    if (
      errorMessage.includes("not available") ||
      errorMessage.includes("LAErrorBiometryNotAvailable") ||
      errorMessage.includes("not enrolled")
    ) {
      console.log(`${LOG} Biometric no longer available, disabling...`);
      await disableBiometricSignIn();
      return {
        success: false,
        error:
          "Biometric authentication is no longer available. Please sign in with your password.",
      };
    }

    // Handle authentication failed (not cancelled, just failed)
    if (
      errorMessage.includes("Authentication failed") ||
      errorMessage.includes("LAErrorAuthenticationFailed")
    ) {
      console.log(`${LOG} Biometric authentication failed`);
      return {
        success: false,
        error: "Authentication failed. Please try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Biometric sign-in failed",
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
