// src/components/shared/InviteCard.tsx
// Challenge invite card with accept/decline actions
// Design System

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  CheckIcon,
  XMarkIcon,
  UserIcon,
  ChevronRightIcon,
} from "react-native-heroicons/outline";
import type { PendingInvite } from "@/services/challenges";

export interface InviteCardProps {
  invite: PendingInvite;
  onAccept: (challengeId: string) => void;
  onDecline: (challengeId: string) => void;
  onPress?: (challengeId: string) => void; // Optional: navigate to detail
  loading?: boolean;
}

export function InviteCard({
  invite,
  onAccept,
  onDecline,
  onPress,
  loading = false,
}: InviteCardProps) {
  const { colors, spacing, radius } = useAppTheme();

  const creatorName =
    invite.creator?.display_name || invite.creator?.username || "Someone";

  const formatChallengeType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleCardPress = () => {
    if (onPress) {
      onPress(invite.challenge.id);
    }
  };

  const cardContent = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {invite.challenge.title}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.creatorBadge,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                },
              ]}
            >
              <UserIcon size={12} color={colors.textSecondary} />
              <Text
                style={[styles.creatorText, { color: colors.textSecondary }]}
              >
                {creatorName}
              </Text>
            </View>
            <Text style={[styles.typeBadge, { color: colors.textMuted }]}>
              {formatChallengeType(invite.challenge.challenge_type)}
            </Text>
          </View>
        </View>

        {/* New badge */}
        <View
          style={[
            styles.newBadge,
            {
              backgroundColor: colors.energy.main,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
            },
          ]}
        >
          <Text style={styles.newBadgeText}>New</Text>
        </View>
      </View>

      {/* Goal info */}
      <View style={[styles.goalRow, { marginTop: spacing.sm }]}>
        <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>
          Goal:
        </Text>
        <Text style={[styles.goalValue, { color: colors.textPrimary }]}>
          {invite.challenge.goal_value.toLocaleString()}{" "}
          {invite.challenge.goal_unit}
        </Text>
        {onPress && (
          <TouchableOpacity
            style={styles.viewDetailsLink}
            onPress={handleCardPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.viewDetailsText, { color: colors.primary.main }]}
            >
              View details
            </Text>
            <ChevronRightIcon size={14} color={colors.primary.main} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.energy.subtle,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.energy.main,
          padding: spacing.md,
        },
      ]}
    >
      {cardContent}

      {/* Actions */}
      <View
        style={[styles.actions, { marginTop: spacing.md, gap: spacing.sm }]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.declineButton,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          onPress={() => onDecline(invite.challenge.id)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <XMarkIcon size={18} color={colors.textSecondary} />
          <Text style={[styles.declineText, { color: colors.textSecondary }]}>
            Decline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.acceptButton,
            {
              backgroundColor: colors.primary.main,
              borderRadius: radius.lg,
            },
          ]}
          onPress={() => onAccept(invite.challenge.id)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <CheckIcon size={18} color="#FFFFFF" />
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Compact version for notification-style display
export interface InviteRowProps {
  invite: PendingInvite;
  onPress: () => void;
}

export function InviteRow({ invite, onPress }: InviteRowProps) {
  const { colors, spacing, radius } = useAppTheme();

  const creatorName =
    invite.creator?.display_name || invite.creator?.username || "Someone";

  return (
    <TouchableOpacity
      style={[
        styles.rowContainer,
        {
          backgroundColor: colors.energy.subtle,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.energy.main,
          padding: spacing.md,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <Text
          style={[styles.rowTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {invite.challenge.title}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.energy.dark }]}>
          From {creatorName} • Tap to view
        </Text>
      </View>
      <View
        style={[
          styles.newBadge,
          {
            backgroundColor: colors.energy.main,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
          },
        ]}
      >
        <Text style={styles.newBadgeText}>New</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  creatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  creatorText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  typeBadge: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  newBadge: {},
  newBadgeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#FFFFFF",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  goalLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  goalValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  viewDetailsLink: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    paddingLeft: 8,
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  actions: {
    flexDirection: "row",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  declineButton: {},
  acceptButton: {},
  declineText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  acceptText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#FFFFFF",
  },
  // Row styles
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
