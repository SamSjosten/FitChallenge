// app/settings/security.tsx
// Security settings screen - biometric authentication toggle

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  useSecurityStore,
  BIOMETRIC_TIMEOUT_OPTIONS,
  formatTimeout,
} from "@/stores/securityStore";
import {
  checkBiometricCapability,
  authenticateWithBiometrics,
  BiometricCapability,
} from "@/lib/biometricAuth";

export default function SecuritySettingsScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const {
    biometricsEnabled,
    biometricTimeout,
    enableBiometrics,
    disableBiometrics,
    setBiometricTimeout,
    recordAuthentication,
  } = useSecurityStore();

  const [capability, setCapability] = useState<BiometricCapability | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeoutPicker, setShowTimeoutPicker] = useState(false);

  // Check biometric capability on mount
  useEffect(() => {
    const checkCapability = async () => {
      const cap = await checkBiometricCapability();
      setCapability(cap);
      setIsLoading(false);
    };
    checkCapability();
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      // Enabling - verify biometric first
      const result = await authenticateWithBiometrics(
        `Enable ${capability?.displayName || "Biometrics"}`,
      );

      if (result.success) {
        enableBiometrics();
        recordAuthentication();
      } else if (result.error && result.error !== "cancelled") {
        Alert.alert("Authentication Failed", result.error);
      }
    } else {
      // Disabling - no verification needed
      disableBiometrics();
    }
  };

  const timeoutOptions = [
    { label: "Immediately", value: BIOMETRIC_TIMEOUT_OPTIONS.IMMEDIATELY },
    { label: "1 minute", value: BIOMETRIC_TIMEOUT_OPTIONS.ONE_MINUTE },
    { label: "5 minutes", value: BIOMETRIC_TIMEOUT_OPTIONS.FIVE_MINUTES },
    { label: "15 minutes", value: BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES },
    { label: "30 minutes", value: BIOMETRIC_TIMEOUT_OPTIONS.THIRTY_MINUTES },
  ];

  const handleSelectTimeout = (value: number) => {
    setBiometricTimeout(value);
    setShowTimeoutPicker(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
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
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            BIOMETRIC AUTHENTICATION
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderRadius: radius.lg },
            ]}
          >
            {/* Biometric Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconContainer}>
                  <Ionicons
                    name={
                      capability?.biometricType === "facial"
                        ? "scan-outline"
                        : "finger-print-outline"
                    }
                    size={24}
                    color={colors.primary.main}
                  />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingTitle, { color: colors.textPrimary }]}
                  >
                    {capability?.displayName || "Biometrics"}
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {capability?.isAvailable
                      ? "Unlock the app with biometrics"
                      : "Not available on this device"}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                disabled={!capability?.isAvailable}
                trackColor={{ false: "#E5E7EB", true: "#A7F3D0" }}
                thumbColor={biometricsEnabled ? "#10B981" : "#F9FAFB"}
                ios_backgroundColor="#E5E7EB"
              />
            </View>

            {/* Timeout Setting (only visible when biometrics enabled) */}
            {biometricsEnabled && (
              <>
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => setShowTimeoutPicker(!showTimeoutPicker)}
                >
                  <View style={styles.settingInfo}>
                    <View style={styles.settingIconContainer}>
                      <Ionicons
                        name="time-outline"
                        size={24}
                        color={colors.primary.main}
                      />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: colors.textPrimary },
                        ]}
                      >
                        Require Authentication
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        After app is in background
                      </Text>
                    </View>
                  </View>
                  <View style={styles.settingValue}>
                    <Text
                      style={[
                        styles.valueText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatTimeout(biometricTimeout)}
                    </Text>
                    <Ionicons
                      name={showTimeoutPicker ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Timeout Picker */}
                {showTimeoutPicker && (
                  <View style={styles.pickerContainer}>
                    {timeoutOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.pickerOption,
                          biometricTimeout === option.value && {
                            backgroundColor: colors.primary.light,
                          },
                        ]}
                        onPress={() => handleSelectTimeout(option.value)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: colors.textPrimary },
                            biometricTimeout === option.value && {
                              color: colors.primary.main,
                              fontWeight: "600",
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {biometricTimeout === option.value && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={colors.primary.main}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Info Text */}
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            {biometricsEnabled
              ? `FitChallenge will require ${capability?.displayName || "biometric"} authentication when returning to the app after ${formatTimeout(biometricTimeout).toLowerCase()}.`
              : `Enable ${capability?.displayName || "biometric authentication"} for an extra layer of security.`}
          </Text>
        </View>

        {/* Additional Security Section (placeholder for future) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            ACCOUNT SECURITY
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderRadius: radius.lg },
            ]}
          >
            <TouchableOpacity style={styles.settingRow} disabled>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconContainer}>
                  <Ionicons
                    name="key-outline"
                    size={24}
                    color={colors.textMuted}
                  />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingTitle, { color: colors.textMuted }]}
                  >
                    Change Password
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: colors.textMuted },
                    ]}
                  >
                    Coming soon
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
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
