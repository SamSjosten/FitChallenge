// app/(tabs)/profile.tsx
// Profile screen - Design System v1.0
// REFACTORED: Using ScreenContainer for unified layout
// Matches mockup: avatar, stats grid, achievements

import React, { useState } from "react";
import {
  View,
  Text,
  Alert,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/auth";
import {
  ScreenContainer,
  ScreenHeader,
  ScreenSection,
  LoadingScreen,
} from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import { Cog6ToothIcon, XMarkIcon } from "react-native-heroicons/outline";

export default function ProfileScreen() {
  const { colors, spacing, radius, typography, shadows, iconSize } =
    useAppTheme();
  const { profile, user, loading, signOut, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ display_name: displayName });
      await refreshProfile();
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (loading || !profile) {
    return <LoadingScreen />;
  }

  const stats = [
    { label: "Total XP", value: (profile.xp_total || 0).toLocaleString() },
    { label: "Challenges", value: "24" }, // TODO: Get from actual data
    {
      label: "Longest Streak",
      value: profile.longest_streak?.toString() || "0",
    },
    { label: "Friends", value: "18" }, // TODO: Get from actual data
  ];

  const achievements = [
    { icon: "🏆", label: "First Win", unlocked: true },
    {
      icon: "🔥",
      label: "7 Day Streak",
      unlocked: (profile.longest_streak || 0) >= 7,
    },
    { icon: "⭐", label: "Top 3", unlocked: true },
    { icon: "🎯", label: "10 Challenges", unlocked: false },
  ];

  return (
    <>
      <ScreenContainer
        edges={["top"]}
        header={
          <ScreenHeader
            title="Profile"
            rightAction={
              <TouchableOpacity
                style={{ padding: spacing.sm }}
                onPress={() => router.push("/settings" as any)}
              >
                <Cog6ToothIcon size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            }
          />
        }
      >
        {/* Profile Card */}
        <ScreenSection>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.lg,
              alignItems: "center",
              ...shadows.card,
            }}
          >
            {/* Avatar */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.primary.main,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.md,
              }}
            >
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              ) : (
                <Text
                  style={{
                    fontSize: 36,
                    fontFamily: "PlusJakartaSans_700Bold",
                    color: "#FFFFFF",
                  }}
                >
                  {(profile.display_name ||
                    profile.username)?.[0]?.toUpperCase() || "?"}
                </Text>
              )}
            </View>

            {/* Name */}
            <Text
              style={{
                fontSize: typography.fontSize.lg,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
              }}
            >
              {profile.display_name || profile.username}
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
              }}
            >
              @{profile.username}
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
                marginTop: spacing.xs,
              }}
            >
              Member since{" "}
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </Text>
          </View>
        </ScreenSection>

        {/* Stats Grid */}
        <ScreenSection>
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
            }}
          >
            Your Stats
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: "48%",
                  backgroundColor: colors.surface,
                  borderRadius: radius.card,
                  padding: spacing.md,
                  alignItems: "center",
                  ...shadows.card,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.lg,
                    fontFamily: "PlusJakartaSans_700Bold",
                    color: colors.textPrimary,
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </ScreenSection>

        {/* Achievements */}
        <ScreenSection>
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
            }}
          >
            Achievements
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.sm,
            }}
          >
            {achievements.map((achievement) => (
              <View
                key={achievement.label}
                style={{
                  flex: 1,
                  backgroundColor: achievement.unlocked
                    ? colors.achievement.subtle
                    : colors.surface,
                  borderRadius: radius.card,
                  padding: spacing.md,
                  alignItems: "center",
                  opacity: achievement.unlocked ? 1 : 0.5,
                  ...shadows.card,
                }}
              >
                <Text style={{ fontSize: 24 }}>{achievement.icon}</Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textSecondary,
                    marginTop: spacing.xs,
                    textAlign: "center",
                  }}
                >
                  {achievement.label}
                </Text>
              </View>
            ))}
          </View>
        </ScreenSection>

        {/* Actions */}
        <ScreenSection spaced={false} style={{ gap: spacing.md }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.lg,
              ...shadows.card,
            }}
            onPress={() => setIsEditing(true)}
          >
            <Text
              style={{
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                textAlign: "center",
              }}
            >
              Edit Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.lg,
              ...shadows.card,
            }}
            onPress={() => router.push("/friends")}
          >
            <Text
              style={{
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.primary.main,
                textAlign: "center",
              }}
            >
              View Friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.error,
              borderRadius: radius.card,
              padding: spacing.lg,
            }}
            onPress={handleSignOut}
          >
            <Text
              style={{
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: "#FFFFFF",
                textAlign: "center",
              }}
            >
              Sign Out
            </Text>
          </TouchableOpacity>
        </ScreenSection>
      </ScreenContainer>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditing(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: "center",
            padding: spacing.xl,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.modal,
              padding: spacing.xl,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.lg,
              }}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: colors.textPrimary,
                }}
              >
                Edit Profile
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsEditing(false);
                  setDisplayName(profile.display_name || "");
                }}
              >
                <XMarkIcon size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Display Name Input */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textSecondary,
                  marginBottom: spacing.xs,
                }}
              >
                Display Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: radius.input,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  fontSize: typography.fontSize.base,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: colors.textPrimary,
                }}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.button,
                  paddingVertical: spacing.md,
                }}
                onPress={() => {
                  setIsEditing(false);
                  setDisplayName(profile.display_name || "");
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.textSecondary,
                    textAlign: "center",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.primary.main,
                  borderRadius: radius.button,
                  paddingVertical: spacing.md,
                  opacity: saving ? 0.7 : 1,
                }}
                onPress={handleSave}
                disabled={saving}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: "#FFFFFF",
                    textAlign: "center",
                  }}
                >
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
