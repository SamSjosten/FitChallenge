// src/components/challenge-detail-v2/MoreMenu.tsx
//
// CONTRACTS ENFORCED:
// - `topInset` required → positioning respects device safe area (fixes B4)
// - `viewerRole` required → menu items derived from role, not ad-hoc boolean

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TestIDs } from "@/constants/testIDs";
import type { MoreMenuProps } from "./types";

export function MoreMenu({
  visible,
  onClose,
  viewerRole,
  topInset,
  onInvite,
  onLeave,
  onCancel,
}: MoreMenuProps) {
  const { colors, spacing, radius } = useAppTheme();

  if (!visible) return null;

  const isCreator = viewerRole === "creator";

  const menuItems = [
    {
      label: "Invite Friends",
      action: onInvite,
      show: isCreator,
      destructive: false,
    },
    {
      label: "Leave Challenge",
      action: onLeave,
      show: !isCreator,
      destructive: true,
    },
    {
      label: "Cancel Challenge",
      action: onCancel,
      show: isCreator,
      destructive: true,
    },
  ].filter((item) => item.show);

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close menu"
      />

      <View
        style={{
          position: "absolute",
          top: topInset + spacing.sm + 44, // safe area + top bar padding + button height
          right: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          minWidth: 200,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            testID={
              item.label === "Invite Friends"
                ? TestIDs.challengeDetail.inviteButton
                : item.label === "Leave Challenge"
                  ? TestIDs.challengeDetail.leaveButton
                  : TestIDs.challengeDetail.cancelChallengeButton
            }
            style={{
              padding: spacing.md,
              borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
            onPress={item.action}
            accessibilityLabel={item.label}
            accessibilityRole="menuitem"
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: "PlusJakartaSans_500Medium",
                color: item.destructive ? colors.error : colors.textPrimary,
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
