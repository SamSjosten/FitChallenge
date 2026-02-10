// src/components/BiometricSignInButton.tsx
// Small Face ID / Touch ID button for login screens
//
// Behavior:
// - Always visible (if device supports biometrics)
// - If NOT set up: Shows tooltip/message to set up
// - If set up: Triggers biometric auth → auto sign-in

import React, { useState, useEffect } from "react";
import { TouchableOpacity, StyleSheet, ActivityIndicator, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FaceIDIcon } from "@/components/FaceIDIcon";
import {
  checkBiometricCapability,
  isBiometricSignInEnabled,
  performBiometricSignIn,
  BiometricCapability,
  SignInFunction,
} from "@/lib/biometricSignIn";

interface BiometricSignInButtonProps {
  /** The signIn function from useAuth - routes through AuthProvider */
  signIn: SignInFunction;
  /** Called when sign-in is successful */
  onSignInSuccess: () => void;
  /** Called when user needs to set up biometric (tapped button but not configured) */
  onSetupRequired: () => void;
  /** Called on error */
  onError: (message: string) => void;
  /** Disable button during other operations */
  disabled?: boolean;
}

export function BiometricSignInButton({
  signIn,
  onSignInSuccess,
  onSetupRequired,
  onError,
  disabled = false,
}: BiometricSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Check capabilities on mount
  useEffect(() => {
    console.log(`🔘 [BiometricButton] useEffect - checking capabilities`);
    checkCapabilities();
  }, []);

  const checkCapabilities = async () => {
    console.log(`🔘 [BiometricButton] checkCapabilities called`);
    const cap = await checkBiometricCapability();
    console.log(
      `🔘 [BiometricButton] capability result: isAvailable=${cap.isAvailable}, type=${cap.biometricType}`,
    );
    setCapability(cap);

    if (cap.isAvailable) {
      const enabled = await isBiometricSignInEnabled();
      setIsEnabled(enabled);
    }
  };

  const handlePress = async () => {
    console.log(
      `🔘 [BiometricButton] handlePress called, isLoading=${isLoading}, disabled=${disabled}, isEnabled=${isEnabled}`,
    );
    if (isLoading || disabled) return;

    // Re-check if enabled (might have changed)
    const enabled = await isBiometricSignInEnabled();
    setIsEnabled(enabled);

    if (!enabled) {
      // Not set up - inform user they need to sign in first
      onSetupRequired();
      return;
    }

    // Perform biometric sign-in (routes through AuthProvider)
    setIsLoading(true);
    try {
      const result = await performBiometricSignIn(signIn);

      if (result.success) {
        console.log(`🔘 [BiometricButton] Sign-in successful, calling onSignInSuccess callback`);
        onSignInSuccess();
      } else if (!result.cancelled) {
        onError(result.error || "Authentication failed");
      }
      // If cancelled, do nothing
    } catch (error: any) {
      onError(error.message || "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if biometrics not available
  if (!capability?.isAvailable) {
    return null;
  }

  const isFaceId = capability.biometricType === "face";

  // Determine icon based on biometric type
  const getIcon = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" color="#10B981" />;
    }

    // Face ID - use custom icon with smiley face
    if (isFaceId) {
      return <FaceIDIcon size={24} color="#10B981" />;
    }

    // Fingerprint / Touch ID
    return <Ionicons name="finger-print" size={24} color="#10B981" />;
  };

  return (
    <TouchableOpacity
      style={[styles.button, isEnabled && styles.buttonEnabled, disabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={disabled || isLoading}
      accessibilityLabel={isFaceId ? "Sign in with Face ID" : "Sign in with Touch ID"}
      accessibilityHint={
        isEnabled
          ? "Double tap to sign in using biometrics"
          : "Sign in with password first to enable"
      }
    >
      {getIcon()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonEnabled: {
    borderColor: "#10B981",
    borderWidth: 2,
    backgroundColor: "#ECFDF5",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default BiometricSignInButton;
