// src/components/BiometricLockScreen.tsx
// Full-screen lock overlay that requires biometric or password authentication

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  authenticateWithBiometrics,
  checkBiometricCapability,
  BiometricType,
} from "@/lib/biometricAuth";
import { useSecurityStore } from "@/stores/securityStore";

interface BiometricLockScreenProps {
  onUnlock: () => void;
  onUsePassword: () => void;
}

export default function BiometricLockScreen({
  onUnlock,
  onUsePassword,
}: BiometricLockScreenProps) {
  const insets = useSafeAreaInsets();
  const { unlock } = useSecurityStore();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [biometricName, setBiometricName] = useState("Biometrics");

  // Check biometric capability on mount
  useEffect(() => {
    const checkCapability = async () => {
      const capability = await checkBiometricCapability();
      setBiometricType(capability.biometricType);
      setBiometricName(capability.displayName);

      // Auto-prompt on mount
      if (capability.isAvailable) {
        handleAuthenticate();
      }
    };
    checkCapability();
  }, []);

  const handleAuthenticate = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    const result = await authenticateWithBiometrics("Unlock FitChallenge");

    setIsAuthenticating(false);

    if (result.success) {
      unlock();
      onUnlock();
    } else if (result.error === "cancelled" || result.error === "fallback") {
      // User cancelled or chose fallback - do nothing, let them tap button
    } else if (result.error) {
      Alert.alert("Authentication Failed", result.error);
    }
  };

  const getBiometricIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (biometricType) {
      case "facial":
        return "scan-outline";
      case "fingerprint":
        return "finger-print-outline";
      default:
        return "lock-closed-outline";
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#059669", "#10B981", "#34D399"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Logo / Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="fitness-outline" size={48} color="#10B981" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>FitChallenge</Text>
        <Text style={styles.subtitle}>Locked</Text>

        {/* Biometric Button */}
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={handleAuthenticate}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#10B981" size="large" />
          ) : (
            <>
              <Ionicons name={getBiometricIcon()} size={64} color="#FFFFFF" />
              <Text style={styles.biometricText}>Tap to unlock with</Text>
              <Text style={styles.biometricName}>{biometricName}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Use Password Button */}
        <TouchableOpacity
          style={styles.passwordButton}
          onPress={onUsePassword}
          disabled={isAuthenticating}
        >
          <Ionicons
            name="key-outline"
            size={20}
            color="#FFFFFF"
            style={styles.passwordIcon}
          />
          <Text style={styles.passwordText}>Use Password Instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 60,
  },
  biometricButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 48,
  },
  biometricText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 12,
  },
  biometricName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 4,
  },
  passwordButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  passwordIcon: {
    marginRight: 8,
  },
  passwordText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
