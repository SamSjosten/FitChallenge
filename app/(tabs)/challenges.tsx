// app/(tabs)/challenges.tsx
// Challenges list screen - Design System v1.0
// REFACTORED: Using ScreenContainer for unified layout
// Shows all active and completed challenges with progress

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { router, useFocusEffect } from "expo-router";
import {
  useActiveChallenges,
  useCompletedChallenges,
  usePendingInvites,
} from "@/hooks/useChallenges";
import {
  ScreenContainer,
  ScreenHeader,
  ScreenSection,
  LoadingScreen,
  ProgressBar,
  Badge,
} from "@/components/ui";
import { ChevronRightIcon } from "react-native-heroicons/outline";
import { TrophyIcon as TrophyIconSolid } from "react-native-heroicons/solid";

export default function ChallengesScreen() {
  const { colors, spacing, radius, typography, shadows } = useAppTheme();
  const {
    data: activeChallenges,
    isLoading: loadingActive,
    refetch: refetchActive,
  } = useActiveChallenges();
  const {
    data: completedChallenges,
    isLoading: loadingCompleted,
    refetch: refetchCompleted,
  } = useCompletedChallenges();
  const { data: pendingInvites, refetch: refetchPending } = usePendingInvites();

  useFocusEffect(
    React.useCallback(() => {
      refetchActive();
      refetchCompleted();
      refetchPending();
    }, [refetchActive, refetchCompleted, refetchPending])
  );

  const handleRefresh = async () => {
    await Promise.all([refetchActive(), refetchCompleted(), refetchPending()]);
  };

  if (loadingActive && loadingCompleted) {
    return <LoadingScreen />;
  }

  return (
    <ScreenContainer
      onRefresh={handleRefresh}
      edges={["top"]}
      header={<ScreenHeader title="Challenges" />}
    >
      {/* Pending Invites */}
      {pendingInvites && pendingInvites.length > 0 && (
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
            Pending Invites ({pendingInvites.length})
          </Text>
          {pendingInvites.map((invite) => (
            <TouchableOpacity
              key={invite.challenge.id}
              style={{
                backgroundColor: colors.energy.subtle,
                borderRadius: radius.card,
                padding: spacing.lg,
                marginBottom: spacing.sm,
                borderWidth: 1,
                borderColor: colors.energy.main,
              }}
              onPress={() => router.push(`/challenge/${invite.challenge.id}`)}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: typography.fontSize.md,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: colors.textPrimary,
                    }}
                  >
                    {invite.challenge.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.energy.dark,
                      marginTop: spacing.xs,
                    }}
                  >
                    Tap to view & accept
                  </Text>
                </View>
                <Badge variant="energy">New</Badge>
              </View>
            </TouchableOpacity>
          ))}
        </ScreenSection>
      )}

      {/* Active Challenges */}
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
          Active ({activeChallenges?.length || 0})
        </Text>

        {activeChallenges && activeChallenges.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              padding: spacing.xl,
              alignItems: "center",
              ...shadows.card,
            }}
          >
            <TrophyIconSolid size={40} color={colors.textMuted} />
            <Text
              style={{
                fontSize: typography.fontSize.md,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                marginTop: spacing.md,
              }}
            >
              No active challenges
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
                textAlign: "center",
                marginTop: spacing.xs,
              }}
            >
              Create one to get started!
            </Text>
          </View>
        ) : (
          activeChallenges?.map((challenge) => {
            const progress = challenge.my_participation?.current_progress || 0;
            const progressPercent = Math.min(
              (progress / challenge.goal_value) * 100,
              100
            );

            return (
              <TouchableOpacity
                key={challenge.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.card,
                  padding: spacing.lg,
                  marginBottom: spacing.sm,
                  ...shadows.card,
                }}
                onPress={() => router.push(`/challenge/${challenge.id}`)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: spacing.sm,
                  }}
                >
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.md,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: colors.textPrimary,
                      }}
                    >
                      {challenge.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textSecondary,
                        marginTop: spacing.xs,
                      }}
                    >
                      {challenge.challenge_type.replace("_", " ")}
                    </Text>
                  </View>
                  <Badge variant="primary">Active</Badge>
                </View>

                {/* Progress */}
                <View style={{ marginBottom: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: spacing.xs,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textMuted,
                      }}
                    >
                      Progress
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        color: colors.primary.main,
                      }}
                    >
                      {progress.toLocaleString()} /{" "}
                      {challenge.goal_value.toLocaleString()}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={progressPercent}
                    variant="primary"
                    size="small"
                  />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.primary.main,
                    }}
                  >
                    View details
                  </Text>
                  <ChevronRightIcon size={16} color={colors.primary.main} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScreenSection>

      {/* Completed Challenges */}
      {completedChallenges && completedChallenges.length > 0 && (
        <ScreenSection spaced={false}>
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
            Completed ({completedChallenges.length})
          </Text>

          {completedChallenges.map((challenge) => (
            <TouchableOpacity
              key={challenge.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.card,
                padding: spacing.lg,
                marginBottom: spacing.sm,
                opacity: 0.8,
                ...shadows.card,
              }}
              onPress={() => router.push(`/challenge/${challenge.id}`)}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: typography.fontSize.md,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: colors.textPrimary,
                    }}
                  >
                    {challenge.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.textSecondary,
                      marginTop: spacing.xs,
                    }}
                  >
                    {challenge.challenge_type.replace("_", " ")}
                  </Text>
                </View>
                <Badge variant="achievement">✓ Done</Badge>
              </View>
            </TouchableOpacity>
          ))}
        </ScreenSection>
      )}
    </ScreenContainer>
  );
}
