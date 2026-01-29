// app/settings/index.tsx
// Settings screen - Design System v1.0
// Provides account management, health data, sign out, and app info

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeftIcon,
  BellIcon,
  ShieldCheckIcon,
  UserIcon,
  QuestionMarkCircleIcon,
  ArrowRightOnRectangleIcon,
  ChevronRightIcon,
  HeartIcon,
  BeakerIcon,
} from "react-native-heroicons/outline";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { TestIDs } from "@/constants/testIDs";

export default function SettingsScreen() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/login");
          } catch (err) {
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
  };

  const settingsItems = [
    {
      icon: UserIcon,
      label: "Account",
      subtitle: "Profile, email, password",
      onPress: () => Alert.alert("Coming Soon", "Account settings coming soon"),
    },
    {
      icon: HeartIcon,
      label: "Health Data",
      subtitle: "Connect Apple Health or Google Fit",
      onPress: () => router.push("/settings/health"),
      testID: TestIDs.settings.healthDataButton,
    },
    {
      icon: BellIcon,
      label: "Notifications",
      subtitle: "Push notifications, reminders",
      onPress: () =>
        Alert.alert("Coming Soon", "Notification settings coming soon"),
    },
    {
      icon: ShieldCheckIcon,
      label: "Privacy",
      subtitle: "Data, visibility, permissions",
      onPress: () => Alert.alert("Coming Soon", "Privacy settings coming soon"),
    },
    {
      icon: QuestionMarkCircleIcon,
      label: "Help & Support",
      subtitle: "FAQ, contact us",
      onPress: () => Alert.alert("Coming Soon", "Help center coming soon"),
    },
    ...(__DEV__
      ? [
          {
            icon: BeakerIcon,
            label: "Developer",
            subtitle: "UI version, debug tools",
            onPress: () => router.push("/settings/developer"),
            testID: TestIDs.settings.developerButton,
          },
        ]
      : []),
  ];

  return (
    <SafeAreaView
      testID={TestIDs.screens.settings}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: spacing.xs }}
        >
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: typography.fontSize.lg,
            fontFamily: "PlusJakartaSans_700Bold",
            color: colors.textPrimary,
            marginLeft: spacing.md,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Settings Items */}
        <View
          style={{
            marginTop: spacing.lg,
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            overflow: "hidden",
            ...shadows.card,
          }}
        >
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              testID={item.testID}
              onPress={item.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: spacing.lg,
                borderBottomWidth: index < settingsItems.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: colors.primary.subtle,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <item.icon size={20} color={colors.primary.main} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.textPrimary,
                  }}
                >
                  {item.label}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                  }}
                >
                  {item.subtitle}
                </Text>
              </View>
              <ChevronRightIcon size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          testID={TestIDs.settings.signOutButton}
          onPress={handleSignOut}
          style={{
            marginTop: spacing.xl,
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            padding: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            ...shadows.card,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "#FEE2E2",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ArrowRightOnRectangleIcon size={20} color={colors.error} />
          </View>
          <Text
            style={{
              flex: 1,
              marginLeft: spacing.md,
              fontSize: typography.fontSize.base,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.error,
            }}
          >
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* Version */}
        <Text
          style={{
            textAlign: "center",
            marginTop: spacing.xl,
            marginBottom: spacing["2xl"],
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_500Medium",
            color: colors.textMuted,
          }}
        >
          FitChallenge v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
