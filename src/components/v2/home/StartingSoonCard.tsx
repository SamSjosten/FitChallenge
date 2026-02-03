// src/components/v2/home/StartingSoonCard.tsx
// Amber-themed card for challenges starting soon
// Design System v2.0 - Based on home screen mockup
//
// Features:
// - Left amber accent border
// - Clock icon
// - Creator view: "Starts in X days • Y joined" + Invite button
// - Non-creator view: "Starts in X days • Invited by {name}" + participant badge
// - Non-expandable (taps navigate to challenge)

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  ClockIcon,
  UsersIcon,
  UserPlusIcon,
} from "react-native-heroicons/outline";
import type { ChallengeWithParticipation } from "@/services/challenges";

// ============================================================================
// TYPES
// ============================================================================
export interface StartingSoonCardProps {
  challenge: ChallengeWithParticipation;
  onInvite?: (challengeId: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================
function getDaysUntilStart(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatStartsIn(days: number): string {
  if (days === 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

// ============================================================================
// COMPONENT
// ============================================================================
export function StartingSoonCard({
  challenge,
  onInvite,
}: StartingSoonCardProps) {
  const { colors, spacing, radius } = useAppTheme();

  const daysUntilStart = getDaysUntilStart(challenge.start_date);
  const participantCount = challenge.participant_count || 1;

  // Determine view mode
  const isCreator = challenge.is_creator === true;
  const inviterName = challenge.creator_name;

  const handlePress = () => {
    router.push(`/challenge/${challenge.id}`);
  };

  const handleInvite = (e: any) => {
    // Prevent card navigation
    e?.stopPropagation?.();

    if (onInvite) {
      onInvite(challenge.id);
    } else {
      router.push(`/challenge/${challenge.id}/invite`);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: `${colors.warning}08`,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: `${colors.warning}20`,
          borderLeftWidth: 3,
          borderLeftColor: colors.warning,
          padding: spacing.md,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Icon + Text */}
        <View style={styles.leftSection}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${colors.warning}20`,
                borderRadius: radius.md,
              },
            ]}
          >
            <ClockIcon size={18} color={colors.warning} />
          </View>

          <View style={styles.textContainer}>
            <Text
              style={[styles.title, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {challenge.title}
            </Text>
            <Text style={[styles.meta, { color: colors.warning }]}>
              {formatStartsIn(daysUntilStart)}
              {isCreator
                ? ` • ${participantCount} joined`
                : inviterName
                  ? ` • Invited by ${inviterName}`
                  : ` • Invited`}
            </Text>
          </View>
        </View>

        {/* Right side: Invite button (creator) or participant badge (non-creator) */}
        {isCreator ? (
          <TouchableOpacity
            style={[
              styles.inviteButton,
              {
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: colors.warning,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
              },
            ]}
            onPress={handleInvite}
            activeOpacity={0.7}
          >
            <Text style={[styles.inviteButtonText, { color: colors.warning }]}>
              Invite
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.participantBadge,
              {
                backgroundColor: `${colors.warning}15`,
                borderRadius: radius.md,
                paddingHorizontal: 10,
                paddingVertical: 6,
              },
            ]}
          >
            <UsersIcon size={12} color={colors.warning} />
            <Text
              style={[styles.participantBadgeText, { color: colors.warning }]}
            >
              {participantCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {},
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  inviteButtonText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  participantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantBadgeText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
