// src/components/challenge-detail/PendingInviteBanner.tsx
//
// Shown when viewerRole === "pending".
// Fixes U1: pending invitees previously had no way to accept/decline
// from the detail screen — they had to navigate back to the home screen.

import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { PendingInviteBannerProps } from "./types";

export function PendingInviteBanner({
  challenge,
  onAccept,
  onDecline,
  isResponding,
}: PendingInviteBannerProps) {
  const { colors, spacing, typography, radius } = useAppTheme();

  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        backgroundColor: `${colors.primary.main}10`,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: `${colors.primary.main}25`,
        padding: spacing.lg,
      }}
      accessibilityRole="alert"
      accessibilityLabel={`You've been invited to ${challenge.title}`}
    >
      <Text
        style={{
          fontSize: typography.fontSize.base,
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        }}
      >
        You&apos;re invited!
      </Text>
      {challenge.creator_name && (
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            fontFamily: "PlusJakartaSans_500Medium",
            color: colors.textSecondary,
            marginBottom: spacing.md,
          }}
        >
          {challenge.creator_name} invited you to join this challenge
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            opacity: isResponding ? 0.6 : 1,
          }}
          onPress={onDecline}
          disabled={isResponding}
          accessibilityLabel="Decline challenge invite"
          accessibilityRole="button"
        >
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textSecondary,
            }}
          >
            Decline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.primary.main,
            alignItems: "center",
            justifyContent: "center",
            opacity: isResponding ? 0.6 : 1,
          }}
          onPress={onAccept}
          disabled={isResponding}
          accessibilityLabel="Accept challenge invite"
          accessibilityRole="button"
        >
          {isResponding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: "#FFFFFF",
              }}
            >
              Accept
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
