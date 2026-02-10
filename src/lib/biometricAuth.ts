// src/lib/biometricAuth.ts
// Biometric authentication utility for Face ID / Touch ID

import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

export interface BiometricCapability {
  isAvailable: boolean;
  biometricType: BiometricType;
  displayName: string;
}

/**
 * Check if device supports biometric authentication
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
        displayName: "Not Enrolled",
      };
    }

    // Get supported biometric types
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricType = "none";
    let displayName = "Biometrics";

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = "facial";
      displayName = Platform.OS === "ios" ? "Face ID" : "Face Recognition";
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = "fingerprint";
      displayName = Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = "iris";
      displayName = "Iris Recognition";
    }

    return {
      isAvailable: biometricType !== "none",
      biometricType,
      displayName,
    };
  } catch (error) {
    console.error("Error checking biometric capability:", error);
    return {
      isAvailable: false,
      biometricType: "none",
      displayName: "Error",
    };
  }
}

/**
 * Prompt user for biometric authentication
 */
export async function authenticateWithBiometrics(
  promptMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const capability = await checkBiometricCapability();

    if (!capability.isAvailable) {
      return {
        success: false,
        error: "Biometric authentication is not available",
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || `Unlock FitChallenge`,
      cancelLabel: "Use Password",
      disableDeviceFallback: false, // Allow passcode fallback
      fallbackLabel: "Use Passcode",
    });

    if (result.success) {
      return { success: true };
    }

    // Handle different error cases
    if (result.error === "user_cancel") {
      return { success: false, error: "cancelled" };
    } else if (result.error === "user_fallback") {
      return { success: false, error: "fallback" };
    } else if (result.error === "system_cancel") {
      return { success: false, error: "system_cancel" };
    } else if (result.error === "lockout") {
      return {
        success: false,
        error: "Too many attempts. Please try again later.",
      };
    }

    return { success: false, error: result.error || "Authentication failed" };
  } catch (error) {
    console.error("Biometric authentication error:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get user-friendly biometric name for UI
 */
export function getBiometricDisplayName(type: BiometricType): string {
  switch (type) {
    case "facial":
      return Platform.OS === "ios" ? "Face ID" : "Face Recognition";
    case "fingerprint":
      return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    case "iris":
      return "Iris Recognition";
    default:
      return "Biometrics";
  }
}
