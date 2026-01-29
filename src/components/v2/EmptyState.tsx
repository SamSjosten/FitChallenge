// src/components/v2/EmptyState.tsx
// V2 Empty state component for lists and sections
// Design System v2.0

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  TrophyIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  MagnifyingGlassIcon,
} from "react-native-heroicons/outline";

export type EmptyStateVariant =
  | "challenges"
  | "friends"
  | "requests"
  | "notifications"
  | "search"
  | "generic";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

const variantConfig: Record<
  EmptyStateVariant,
  {
    icon: React.ComponentType<{ size: number; color: string }>;
    defaultTitle: string;
    defaultMessage: string;
  }
> = {
  challenges: {
    icon: TrophyIcon,
    defaultTitle: "No Active Challenges",
    defaultMessage: "Create a challenge or wait for an invite to get started!",
  },
  friends: {
    icon: UsersIcon,
    defaultTitle: "No Friends Yet",
    defaultMessage: "Search for friends to start competing together.",
  },
  requests: {
    icon: UsersIcon,
    defaultTitle: "No Pending Requests",
    defaultMessage: "Friend requests will appear here.",
  },
  notifications: {
    icon: BellIcon,
    defaultTitle: "All Caught Up",
    defaultMessage: "You have no new notifications.",
  },
  search: {
    icon: MagnifyingGlassIcon,
    defaultTitle: "No Results Found",
    defaultMessage: "Try a different search term.",
  },
  generic: {
    icon: ClipboardDocumentListIcon,
    defaultTitle: "Nothing Here",
    defaultMessage: "Content will appear here when available.",
  },
};

export function EmptyState({
  variant = "generic",
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const { colors, spacing, radius } = useAppTheme();
  const config = variantConfig[variant];
  const IconComponent = config.icon;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: compact ? spacing.lg : spacing.xl,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.backgroundAlt,
            width: compact ? 48 : 64,
            height: compact ? 48 : 64,
            borderRadius: compact ? 24 : 32,
          },
        ]}
      >
        <IconComponent size={compact ? 24 : 32} color={colors.textMuted} />
      </View>

      <Text
        style={[
          styles.title,
          {
            color: colors.textPrimary,
            marginTop: spacing.md,
            fontSize: compact ? 16 : 18,
          },
        ]}
      >
        {title || config.defaultTitle}
      </Text>

      <Text
        style={[
          styles.message,
          {
            color: colors.textMuted,
            marginTop: spacing.xs,
            fontSize: compact ? 13 : 14,
          },
        ]}
      >
        {message || config.defaultMessage}
      </Text>

      {actionLabel && onAction && (
        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.primary.main,
              borderRadius: radius.lg,
              marginTop: spacing.lg,
              paddingVertical: compact ? spacing.sm : spacing.md,
              paddingHorizontal: spacing.xl,
            },
          ]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    textAlign: "center",
  },
  message: {
    fontFamily: "PlusJakartaSans_400Regular",
    textAlign: "center",
    maxWidth: 280,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
  },
});
