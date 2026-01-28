// src/components/shared/EmptyState.tsx
// ============================================
// Empty State Component
// ============================================
// Displays contextual empty states with icons, messages,
// and optional action buttons.
//
// Usage:
//   <EmptyState variant="no-challenges" onAction={() => router.push('/create')} />

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import {
  TrophyIcon,
  UserGroupIcon,
  BellIcon,
  MagnifyingGlassIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
} from "react-native-heroicons/outline";
import { useTheme } from "@/constants/theme";

// =============================================================================
// TYPES
// =============================================================================

export type EmptyStateVariant =
  | "no-challenges"
  | "no-active-challenges"
  | "no-friends"
  | "no-friend-requests"
  | "no-activity"
  | "no-notifications"
  | "no-search-results"
  | "offline"
  | "error"
  | "no-health-data";

export interface EmptyStateProps {
  /** The variant determines icon, title, and message */
  variant: EmptyStateVariant;

  /** Optional custom title (overrides variant default) */
  title?: string;

  /** Optional custom message (overrides variant default) */
  message?: string;

  /** Optional action button text */
  actionText?: string;

  /** Action button callback */
  onAction?: () => void;

  /** Secondary action button text */
  secondaryActionText?: string;

  /** Secondary action callback */
  onSecondaryAction?: () => void;

  /** Additional container styles */
  style?: ViewStyle;

  /** Test ID for E2E testing */
  testID?: string;
}

// =============================================================================
// VARIANT CONFIGURATIONS
// =============================================================================

interface VariantConfig {
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  message: string;
  defaultActionText?: string;
}

const VARIANT_CONFIGS: Record<EmptyStateVariant, VariantConfig> = {
  "no-challenges": {
    icon: TrophyIcon,
    title: "No Challenges Yet",
    message: "Create your first challenge and invite friends to compete!",
    defaultActionText: "Create Challenge",
  },
  "no-active-challenges": {
    icon: SparklesIcon,
    title: "No Active Challenges",
    message: "Your challenges will appear here once they start.",
  },
  "no-friends": {
    icon: UserGroupIcon,
    title: "No Friends Yet",
    message: "Add friends to challenge them to fitness competitions!",
    defaultActionText: "Add Friends",
  },
  "no-friend-requests": {
    icon: UserGroupIcon,
    title: "No Friend Requests",
    message: "When someone sends you a friend request, it will appear here.",
  },
  "no-activity": {
    icon: ClipboardDocumentListIcon,
    title: "No Activity",
    message: "Your recent activity will show up here once you start logging.",
    defaultActionText: "Log Activity",
  },
  "no-notifications": {
    icon: BellIcon,
    title: "All Caught Up!",
    message: "You have no new notifications.",
  },
  "no-search-results": {
    icon: MagnifyingGlassIcon,
    title: "No Results Found",
    message: "Try adjusting your search or filters.",
  },
  offline: {
    icon: WifiIcon,
    title: "You're Offline",
    message: "Check your internet connection and try again.",
    defaultActionText: "Retry",
  },
  error: {
    icon: ExclamationTriangleIcon,
    title: "Something Went Wrong",
    message: "We couldn't load this content. Please try again.",
    defaultActionText: "Try Again",
  },
  "no-health-data": {
    icon: HeartIcon,
    title: "No Health Data",
    message: "Connect to Apple Health to sync your fitness data automatically.",
    defaultActionText: "Connect Health",
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function EmptyState({
  variant,
  title,
  message,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  style,
  testID,
}: EmptyStateProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const config = VARIANT_CONFIGS[variant];
  const IconComponent = config.icon;

  const displayTitle = title ?? config.title;
  const displayMessage = message ?? config.message;
  const displayActionText = actionText ?? config.defaultActionText;

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: spacing.xl, paddingVertical: spacing["3xl"] },
        style,
      ]}
      testID={testID ?? `empty-state-${variant}`}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.primary.subtle,
            borderRadius: radius.full,
            padding: spacing.lg,
            marginBottom: spacing.lg,
          },
        ]}
      >
        <IconComponent size={40} color={colors.primary.main} />
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: colors.textPrimary,
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold as any,
            marginBottom: spacing.sm,
          },
        ]}
      >
        {displayTitle}
      </Text>

      {/* Message */}
      <Text
        style={[
          styles.message,
          {
            color: colors.textSecondary,
            fontSize: typography.fontSize.base,
            lineHeight:
              typography.fontSize.base * typography.lineHeight.relaxed,
            marginBottom: spacing.xl,
          },
        ]}
      >
        {displayMessage}
      </Text>

      {/* Actions */}
      <View style={styles.actions}>
        {displayActionText && onAction && (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.primary.main,
                borderRadius: radius.button,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
              },
            ]}
            onPress={onAction}
            activeOpacity={0.8}
            testID={`${testID ?? `empty-state-${variant}`}-action`}
          >
            <Text
              style={[
                styles.primaryButtonText,
                {
                  color: colors.primary.contrast,
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.semibold as any,
                },
              ]}
            >
              {displayActionText}
            </Text>
          </TouchableOpacity>
        )}

        {secondaryActionText && onSecondaryAction && (
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                marginTop: spacing.sm,
              },
            ]}
            onPress={onSecondaryAction}
            activeOpacity={0.7}
            testID={`${testID ?? `empty-state-${variant}`}-secondary-action`}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                {
                  color: colors.primary.main,
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.medium as any,
                },
              ]}
            >
              {secondaryActionText}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
  actions: {
    alignItems: "center",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    textAlign: "center",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    textAlign: "center",
  },
});

export default EmptyState;
