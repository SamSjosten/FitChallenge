// app/settings/developer.tsx
// Developer settings screen with feature flags

import React from "react";
import { View, Text, Switch, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useFeatureFlags } from "@/lib/featureFlags";

export default function DeveloperSettingsScreen() {
  const { colors, spacing } = useAppTheme();
  const { uiVersion, isV2, setVersion, isLoading } = useFeatureFlags();

  const handleToggle = (value: boolean) => {
    setVersion(value ? "v2" : "v1");
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Header */}
        <Text
          style={[
            styles.sectionHeader,
            { color: colors.textSecondary, marginBottom: spacing.md },
          ]}
        >
          FEATURE FLAGS
        </Text>

        {/* V2 UI Toggle */}
        <View
          style={[
            styles.settingRow,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.labelContainer}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Use V2 UI
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Enable the redesigned interface with new welcome flow, updated
              tabs, and improved visuals.
            </Text>
          </View>
          <Switch
            value={isV2}
            onValueChange={handleToggle}
            trackColor={{
              false: colors.border,
              true: colors.primary.main,
            }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Current Version Display */}
        <View
          style={[
            styles.infoRow,
            {
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              marginTop: spacing.sm,
            },
          ]}
        >
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Current Version
          </Text>
          <Text style={[styles.infoValue, { color: colors.primary.main }]}>
            {uiVersion?.toUpperCase() || "V1"}
          </Text>
        </View>

        {/* Info Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.primary.main + "15",
              borderRadius: 12,
              padding: spacing.md,
              marginTop: spacing.lg,
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.primary.main }]}>
            ℹ️ About V2 UI
          </Text>
          <Text
            style={[
              styles.infoText,
              { color: colors.textSecondary, marginTop: spacing.sm },
            ]}
          >
            The V2 interface includes:{"\n"}• New welcome & onboarding flow
            {"\n"}• Redesigned tab navigation{"\n"}• Health data sync setup
            {"\n"}• Improved challenge cards{"\n\n"}
            Toggle off to return to the classic interface.
          </Text>
        </View>

        {/* Warning */}
        <Text
          style={[
            styles.footerNote,
            {
              color: colors.textSecondary,
              marginTop: spacing.xl,
              textAlign: "center",
            },
          ]}
        >
          Changes take effect after signing out and back in.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoCard: {},
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  footerNote: {
    fontSize: 12,
  },
});
