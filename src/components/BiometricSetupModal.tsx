// src/components/BiometricSetupModal.tsx
// Post-login modal prompt to enable Face ID / Touch ID quick sign-in
//
// Shown after successful password sign-in if:
// - Device supports biometrics
// - User hasn't set up biometric sign-in yet

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  checkBiometricCapability,
  setupBiometricSignIn,
  BiometricCapability,
} from "@/lib/biometricSignIn";

interface BiometricSetupModalProps {
  visible: boolean;
  email: string;
  password: string;
  onComplete: (enabled: boolean) => void;
  onDismiss: () => void;
}

export function BiometricSetupModal({
  visible,
  email,
  password,
  onComplete,
  onDismiss,
}: BiometricSetupModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [capability, setCapability] = useState<BiometricCapability | null>(
    null,
  );

  // Check biometric type on mount
  useEffect(() => {
    if (visible) {
      checkBiometricCapability().then(setCapability);
    }
  }, [visible]);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const result = await setupBiometricSignIn(email, password);

      if (result.success) {
        onComplete(true);
      } else if (result.cancelled) {
        // User cancelled - keep modal open
        setIsLoading(false);
      } else {
        // Failed - dismiss and continue
        console.log("[BiometricSetupModal] Setup failed:", result.error);
        onComplete(false);
      }
    } catch (error) {
      console.error("[BiometricSetupModal] Error:", error);
      onComplete(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotNow = () => {
    onDismiss();
  };

  const biometricName = capability?.displayName || "Face ID";
  const isFaceId = capability?.biometricType === "face";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleNotNow}
    >
      <TouchableWithoutFeedback onPress={handleNotNow}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <Ionicons
                  name={isFaceId ? "scan" : "finger-print"}
                  size={48}
                  color="#10B981"
                />
              </View>

              {/* Title */}
              <Text style={styles.title}>Enable {biometricName}?</Text>

              {/* Description */}
              <Text style={styles.description}>
                Sign in faster next time with{" "}
                {isFaceId
                  ? Platform.OS === "ios"
                    ? "Face ID"
                    : "face recognition"
                  : Platform.OS === "ios"
                    ? "Touch ID"
                    : "your fingerprint"}{" "}
                instead of your password.
              </Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleNotNow}
                  disabled={isLoading}
                >
                  <Text style={styles.secondaryButtonText}>Not Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleEnable}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Enable</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  iconContainer: {
    width: 88,
    height: 88,
    backgroundColor: "#ECFDF5",
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  primaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#10B981",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default BiometricSetupModal;
