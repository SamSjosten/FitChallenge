// src/components/challenge-detail/CompletedBanner.tsx
//
// Shown when a challenge is completed. Displays the winner and offers
// a "Rematch" CTA for the creator.
//
// CONTRACT: Winner is derived from leaderboard data (rank 1).
// CONTRACT: Rematch uses existing create + invite RPCs — no new schema.

import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { TrophyIcon, ArrowPathIcon } from "react-native-heroicons/outline";
import type { LeaderboardEntry } from "@/services/challenges";

export interface CompletedBannerProps {
  /** The #1 entry from the leaderboard (null if no participants) */
  winner: LeaderboardEntry | null;
  /** Whether the current user won (or tied for 1st) */
  isCurrentUserWinner: boolean;
  /** Whether multiple participants tied for 1st place */
  isTied: boolean;
  /** Whether the current user is the creator (only creators can rematch) */
  isCreator: boolean;
  /** Number of participants in the challenge */
  participantCount: number;
  onRematch: () => void;
  isRematchPending: boolean;
}

export function CompletedBanner({
  winner,
  isCurrentUserWinner,
  isTied,
  isCreator,
  participantCount,
  onRematch,
  isRematchPending,
}: CompletedBannerProps) {
  const { colors, spacing, typography } = useAppTheme();

  const winnerName = winner
    ? winner.profile.display_name || winner.profile.username
    : "No participants";

  const isSoloChallenge = participantCount <= 1;

  // Determine headline text
  const getHeadline = (): string => {
    if (isSoloChallenge) return "Challenge Complete";
    if (isCurrentUserWinner && isTied) return "You tied for 1st! 🤝";
    if (isCurrentUserWinner) return "You won! 🎉";
    if (isTied) return `${winnerName} tied for 1st!`;
    return `${winnerName} won!`;
  };

  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isCurrentUserWinner ? "#00D26A40" : colors.border,
      }}
    >
      {/* Winner Section */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
          backgroundColor: isCurrentUserWinner ? "#00D26A10" : colors.surface,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isCurrentUserWinner ? "#00D26A20" : "#FFD70020",
            justifyContent: "center",
            alignItems: "center",
            marginRight: spacing.sm,
          }}
        >
          <TrophyIcon size={22} color={isCurrentUserWinner ? "#00D26A" : "#FFD700"} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            {getHeadline()}
          </Text>
          {winner && !isSoloChallenge && (
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.textMuted,
                marginTop: 2,
              }}
            >
              {winner.current_progress.toLocaleString()} total • {participantCount} participant
              {participantCount === 1 ? "" : "s"}
            </Text>
          )}
          {winner && isSoloChallenge && (
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.textMuted,
                marginTop: 2,
              }}
            >
              Final: {winner.current_progress.toLocaleString()} total
            </Text>
          )}
        </View>
      </View>

      {/* Rematch CTA — creator only */}
      {isCreator && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.sm + 2,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            opacity: isRematchPending ? 0.6 : 1,
          }}
          onPress={onRematch}
          disabled={isRematchPending}
          accessibilityLabel="Create rematch challenge"
          accessibilityRole="button"
        >
          {isRematchPending ? (
            <ActivityIndicator size="small" color="#00D26A" />
          ) : (
            <>
              <ArrowPathIcon size={16} color="#00D26A" />
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "#00D26A",
                  marginLeft: spacing.xs,
                }}
              >
                Rematch
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
