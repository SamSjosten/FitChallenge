// app/(tabs)/profile.tsx
// V2 Profile screen with settings access
// Phase 2B will add: stats cards, achievements

import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "@/components/shared";
import { TestIDs } from "@/constants/testIDs";
import {
  Cog6ToothIcon,
  ChartBarIcon,
  TrophyIcon,
  FireIcon,
  ArrowRightOnRectangleIcon,
  BeakerIcon,
} from "react-native-heroicons/outline";
import { Alert } from "react-native";

export default function ProfileScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const { profile, signOut } = useAuth();

  const stats = [
    {
      icon: FireIcon,
      label: "Current Streak",
      value: profile?.current_streak ?? 0,
      suffix: "days",
    },
    { icon: TrophyIcon, label: "Challenges Won", value: 0, suffix: "" },
    {
      icon: ChartBarIcon,
      label: "Total XP",
      value: profile?.xp_total ?? 0,
      suffix: "XP",
    },
  ];

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID={TestIDs.screensV2?.profile || "profile-screen-v2"}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Cog6ToothIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
              marginTop: spacing.lg,
            },
          ]}
        >
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.display_name || profile?.username || "User"}
            size="xl"
          />
          <Text style={[styles.displayName, { color: colors.textPrimary, marginTop: spacing.md }]}>
            {profile?.display_name || profile?.username || "User"}
          </Text>
          <Text style={[styles.username, { color: colors.textSecondary }]}>
            @{profile?.username || "username"}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={[styles.statsGrid, { marginTop: spacing.xl }]}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                },
              ]}
            >
              <stat.icon size={24} color={colors.primary.main} />
              <Text
                style={[styles.statValue, { color: colors.textPrimary, marginTop: spacing.sm }]}
              >
                {stat.value}
                {stat.suffix ? ` ${stat.suffix}` : ""}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.textSecondary, marginTop: spacing.xs }]}
              >
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={{ marginTop: spacing.xl }}>
          <Text
            style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: spacing.md }]}
          >
            QUICK ACTIONS
          </Text>

          {/* Settings Button */}
          <TouchableOpacity
            style={[
              styles.actionRow,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
            onPress={() => router.push("/settings")}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary.subtle }]}>
              <Cog6ToothIcon size={20} color={colors.primary.main} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Settings</Text>
          </TouchableOpacity>

          {/* Developer Settings (dev only) */}
          {__DEV__ && (
            <TouchableOpacity
              style={[
                styles.actionRow,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                },
              ]}
              onPress={() => router.push("/settings/developer")}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.energy.subtle }]}>
                <BeakerIcon size={20} color={colors.energy.main} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
                Developer Settings
              </Text>
            </TouchableOpacity>
          )}

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[
              styles.actionRow,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.md,
              },
            ]}
            onPress={handleSignOut}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#FEE2E2" }]}>
              <ArrowRightOnRectangleIcon size={20} color={colors.error} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  profileCard: {
    alignItems: "center",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "700",
  },
  username: {
    fontSize: 15,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
});
