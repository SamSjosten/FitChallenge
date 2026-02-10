// app/settings/security.tsx
// Security settings screen - biometric sign-in toggle

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FaceIDIcon } from "@/components/FaceIDIcon";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  checkBiometricCapability,
  isBiometricSignInEnabled,
  clearBiometricSignIn,
  BiometricCapability,
} from "@/lib/biometricSignIn";

export default function SecuritySettingsScreen() {
  const { colors, spacing, radius } = useAppTheme();

  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [biometricSignInEnabled, setBiometricSignInEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check biometric capability and sign-in status
  const checkStatus = useCallback(async () => {
    const cap = await checkBiometricCapability();
    setCapability(cap);

    if (cap.isAvailable) {
      const enabled = await isBiometricSignInEnabled();
      setBiometricSignInEnabled(enabled);
    }

    setIsLoading(false);
  }, []);

  // Check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Re-check when screen gains focus (in case user set up Face ID elsewhere)
  useFocusEffect(
    useCallback(() => {
      checkStatus();
    }, [checkStatus]),
  );

  const handleToggleBiometrics = async (value: boolean) => {
    console.log(`[Security] Toggle biometrics: ${value}`);
    if (value) {
      // Can't enable from here - need to sign in with password first
      console.log(`[Security] Showing enable instructions alert`);
      Alert.alert(
        "Set Up Face ID",
        "To enable Face ID sign-in, sign out and sign back in with your password. You'll be prompted to set up Face ID after signing in.",
        [{ text: "OK" }],
      );
    } else {
      // Disabling - confirm first
      console.log(`[Security] Showing disable confirmation alert`);
      Alert.alert(
        "Disable Face ID",
        "Are you sure you want to disable Face ID sign-in? You'll need to use your password to sign in.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => console.log(`[Security] User cancelled disable`),
          },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              console.log(`[Security] User confirmed disable, calling clearBiometricSignIn...`);
              try {
                await clearBiometricSignIn();
                console.log(`[Security] clearBiometricSignIn completed, updating UI state`);
                setBiometricSignInEnabled(false);

                // Verify it was actually disabled
                console.log(`[Security] Verifying disable...`);
                const stillEnabled = await isBiometricSignInEnabled();
                console.log(`[Security] Still enabled after clear: ${stillEnabled}`);

                if (stillEnabled) {
                  console.error(`[Security] FAILED: Face ID still enabled after clear!`);
                  Alert.alert("Error", "Failed to disable Face ID. Please try again.", [
                    { text: "OK" },
                  ]);
                  // Re-check status to sync UI
                  checkStatus();
                } else {
                  console.log("[Security] Successfully disabled");
                }
              } catch (error: any) {
                console.error(`[Security] Exception:`, error?.message || error);
                Alert.alert("Error", "Failed to disable Face ID. Please try again.", [
                  { text: "OK" },
                ]);
              }
            },
          },
        ],
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Security" }} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking biometric capabilities...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Stack.Screen options={{ title: "Security" }} />

      <ScrollView style={styles.scrollView}>
        {/* Biometric Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>QUICK SIGN-IN</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            {/* Biometric Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconContainer}>
                  {capability?.biometricType === "face" ? (
                    <FaceIDIcon size={24} color={colors.primary.main} />
                  ) : (
                    <Ionicons name="finger-print-outline" size={24} color={colors.primary.main} />
                  )}
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>
                    {capability?.displayName || "Biometrics"} Sign-In
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {capability?.isAvailable
                      ? biometricSignInEnabled
                        ? "Sign in quickly with Face ID"
                        : "Sign in with password required"
                      : "Not available on this device"}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricSignInEnabled}
                onValueChange={handleToggleBiometrics}
                disabled={!capability?.isAvailable}
                trackColor={{ false: "#E5E7EB", true: "#A7F3D0" }}
                thumbColor={biometricSignInEnabled ? "#10B981" : "#F9FAFB"}
                ios_backgroundColor="#E5E7EB"
              />
            </View>
          </View>

          {/* Info Text */}
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            {biometricSignInEnabled
              ? `${capability?.displayName || "Biometric"} sign-in is enabled. You can sign in without entering your password.`
              : `Enable ${capability?.displayName || "biometric"} sign-in for faster access. Sign out and sign back in to set it up.`}
          </Text>
        </View>

        {/* Additional Security Section (placeholder for future) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ACCOUNT SECURITY
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <TouchableOpacity style={styles.settingRow} disabled>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="key-outline" size={24} color={colors.textMuted} />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingTitle, { color: colors.textMuted }]}>
                    Change Password
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textMuted }]}>
                    Coming soon
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    minHeight: 72,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
  },
  settingValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  valueText: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  pickerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    marginHorizontal: 4,
  },
});
