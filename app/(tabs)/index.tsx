// app/(tabs)/index.tsx
// Home/Dashboard screen - Design System v1.0
// REFACTORED: Using ScreenContainer for unified layout

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth";
import {
  useActiveChallenges,
  useCompletedChallenges,
  usePendingInvites,
  useRespondToInvite,
} from "@/hooks/useChallenges";
import {
  ScreenContainer,
  ScreenHeader,
  ScreenSection,
  Card,
  LoadingScreen,
  Badge,
  ProgressBar,
} from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  TrophyIcon,
  ChevronRightIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import {
  FireIcon as FireIconSolid,
  TrophyIcon as TrophyIconSolid,
  StarIcon,
} from "react-native-heroicons/solid";

export default function HomeScreen() {
  const { colors, spacing, radius, typography, iconSize } = useAppTheme();
  const { profile } = useAuth();
  const {
    data: activeChallenges,
    isLoading: loadingActive,
    error: activeError,
    refetch: refetchActive,
  } = useActiveChallenges();
  const {
    data: pendingInvites,
    isLoading: loadingPending,
    refetch: refetchPending,
  } = usePendingInvites();
  const respondToInvite = useRespondToInvite();
  const { data: completedChallenges, refetch: refetchCompleted } =
    useCompletedChallenges();

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refetchActive();
      refetchPending();
      refetchCompleted();
    }, [refetchActive, refetchPending, refetchCompleted])
  );

  const handleRefresh = async () => {
    await Promise.all([refetchActive(), refetchPending(), refetchCompleted()]);
  };

  const handleAcceptInvite = async (challengeId: string) => {
    try {
      await respondToInvite.mutateAsync({
        challenge_id: challengeId,
        response: "accepted",
      });
    } catch (err) {
      console.error("Failed to accept invite:", err);
    }
  };

  const handleDeclineInvite = async (challengeId: string) => {
    try {
      await respondToInvite.mutateAsync({
        challenge_id: challengeId,
        response: "declined",
      });
    } catch (err) {
      console.error("Failed to decline invite:", err);
    }
  };

  if (loadingActive && loadingPending) {
    return <LoadingScreen />;
  }

  const currentStreak = profile?.current_streak || 0;
  const xpTotal = profile?.xp_total || 0;
  const displayName = profile?.display_name || profile?.username || "Athlete";
  const featuredChallenge = activeChallenges?.[0];
  const totalChallenges =
    (activeChallenges?.length || 0) + (completedChallenges?.length || 0);

  return (
    <ScreenContainer
      onRefresh={handleRefresh}
      edges={["top"]}
      header={
        <ScreenHeader
          title="FitChallenge"
          subtitle={`Hello, ${displayName}!`}
          showNotifications
        />
      }
    >
      {/* ===== STREAK BANNER ===== */}
      <ScreenSection>
        <TouchableOpacity activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.energy.main, colors.energy.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: spacing.lg,
              borderRadius: radius.card,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{ marginRight: spacing.md }}>
              <FireIconSolid size={28} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: typography.textStyles.title.fontSize,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "white",
                }}
              >
                {currentStreak > 0
                  ? `${currentStreak} Day Streak!`
                  : "Start Your Streak!"}
              </Text>
              <Text
                style={{
                  fontSize: typography.textStyles.caption.fontSize,
                  fontFamily: "PlusJakartaSans_500Medium",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {currentStreak > 0
                  ? "Keep it going tomorrow"
                  : "Log activity to begin"}
              </Text>
            </View>
            <ChevronRightIcon size={20} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>
      </ScreenSection>

      {/* ===== PENDING INVITES ===== */}
      {pendingInvites && pendingInvites.length > 0 && (
        <ScreenSection>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: typography.textStyles.label.fontSize,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
              }}
            >
              Pending Invites
            </Text>
            <Badge variant="energy" size="small">
              {pendingInvites.length}
            </Badge>
          </View>

          {pendingInvites.slice(0, 2).map((invite) => (
            <Card
              key={invite.challenge.id}
              style={{ marginBottom: spacing.sm }}
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
                      fontSize: typography.textStyles.title.fontSize,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: colors.textPrimary,
                      marginBottom: spacing.xs,
                    }}
                  >
                    {invite.challenge.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: typography.textStyles.caption.fontSize,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textSecondary,
                      }}
                    >
                      From @
                      {invite.creator?.username ||
                        invite.challenge.creator_id?.slice(0, 8)}
                    </Text>
                  </View>
                </View>
                <Badge variant="energy">New</Badge>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary.main,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.button,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                  }}
                  onPress={() => handleAcceptInvite(invite.challenge.id)}
                >
                  <CheckIcon size={16} color="white" />
                  <Text
                    style={{
                      fontSize: typography.textStyles.label.fontSize,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: "white",
                    }}
                  >
                    Accept
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfacePressed,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.button,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                  }}
                  onPress={() => handleDeclineInvite(invite.challenge.id)}
                >
                  <XMarkIcon size={16} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontSize: typography.textStyles.label.fontSize,
                      fontFamily: "PlusJakartaSans_600SemiBold",
                      color: colors.textSecondary,
                    }}
                  >
                    Decline
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </ScreenSection>
      )}

      {/* ===== FEATURED CHALLENGE ===== */}
      <ScreenSection>
        <Text
          style={{
            fontSize: typography.textStyles.label.fontSize,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textPrimary,
            marginBottom: spacing.sm,
          }}
        >
          Active Challenge
        </Text>

        {!featuredChallenge ? (
          <Card
            style={{ alignItems: "center", paddingVertical: spacing.xl }}
            onPress={() => router.push("/challenge/create")}
          >
            <TrophyIcon size={40} color={colors.textMuted} />
            <Text
              style={{
                fontSize: typography.textStyles.title.fontSize,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                marginTop: spacing.md,
              }}
            >
              No Active Challenges
            </Text>
            <Text
              style={{
                fontSize: typography.textStyles.caption.fontSize,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
                marginTop: spacing.xs,
              }}
            >
              Create one to get started
            </Text>
          </Card>
        ) : (
          <Card
            onPress={() => router.push(`/challenge/${featuredChallenge.id}`)}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: spacing.md,
              }}
            >
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text
                  style={{
                    fontSize: typography.textStyles.headline.fontSize,
                    fontFamily: "PlusJakartaSans_700Bold",
                    color: colors.textPrimary,
                    marginBottom: spacing.xs,
                  }}
                >
                  {featuredChallenge.title}
                </Text>
                <Text
                  style={{
                    fontSize: typography.textStyles.caption.fontSize,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textSecondary,
                    textTransform: "capitalize",
                  }}
                >
                  {featuredChallenge.challenge_type.replace("_", " ")} challenge
                </Text>
              </View>
              <Badge variant="primary">Active</Badge>
            </View>

            {/* Progress */}
            <View style={{ marginBottom: spacing.lg }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.textStyles.caption.fontSize,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textSecondary,
                  }}
                >
                  Progress
                </Text>
                <Text
                  style={{
                    fontSize: typography.textStyles.caption.fontSize,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.primary.main,
                  }}
                >
                  {(
                    featuredChallenge.my_participation?.current_progress || 0
                  ).toLocaleString()}{" "}
                  / {featuredChallenge.goal_value.toLocaleString()}
                </Text>
              </View>
              <ProgressBar
                progress={
                  ((featuredChallenge.my_participation?.current_progress || 0) /
                    featuredChallenge.goal_value) *
                  100
                }
                variant="primary"
                size="medium"
              />
            </View>

            {/* Log Activity Button */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary.main,
                paddingVertical: spacing.md,
                borderRadius: radius.button,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
              onPress={() => router.push(`/challenge/${featuredChallenge.id}`)}
            >
              <PlusIcon size={18} color="white" />
              <Text
                style={{
                  fontSize: typography.textStyles.label.fontSize,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "white",
                }}
              >
                Log Activity
              </Text>
            </TouchableOpacity>
          </Card>
        )}
      </ScreenSection>

      {/* ===== QUICK STATS ===== */}
      <ScreenSection>
        <Text
          style={{
            fontSize: typography.textStyles.label.fontSize,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textPrimary,
            marginBottom: spacing.sm,
          }}
        >
          This Week
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {/* XP Stat */}
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radius.card,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <StarIcon
              size={20}
              color={colors.achievement.main}
              style={{ marginBottom: spacing.xs }}
            />
            <Text
              style={{
                fontSize: typography.textStyles.title.fontSize,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
              }}
            >
              {xpTotal.toLocaleString()}
            </Text>
            <Text
              style={{
                fontSize: typography.textStyles.caption.fontSize,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
              }}
            >
              XP
            </Text>
          </View>

          {/* Challenges Stat */}
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radius.card,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <TrophyIconSolid
              size={20}
              color={colors.achievement.main}
              style={{ marginBottom: spacing.xs }}
            />
            <Text
              style={{
                fontSize: typography.textStyles.title.fontSize,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
              }}
            >
              {totalChallenges}
            </Text>
            <Text
              style={{
                fontSize: typography.textStyles.caption.fontSize,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
              }}
            >
              Challenges
            </Text>
          </View>

          {/* Streak Stat */}
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radius.card,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <FireIconSolid
              size={20}
              color={colors.energy.main}
              style={{ marginBottom: spacing.xs }}
            />
            <Text
              style={{
                fontSize: typography.textStyles.title.fontSize,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
              }}
            >
              {currentStreak}
            </Text>
            <Text
              style={{
                fontSize: typography.textStyles.caption.fontSize,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textMuted,
              }}
            >
              Day Streak
            </Text>
          </View>
        </View>
      </ScreenSection>

      {/* ===== COMPLETED CHALLENGES LINK ===== */}
      {completedChallenges && completedChallenges.length > 0 && (
        <ScreenSection spaced={false}>
          <TouchableOpacity
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: colors.surface,
              padding: spacing.md,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => router.push("/challenges")}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <TrophyIconSolid
                size={iconSize.md}
                color={colors.achievement.main}
              />
              <Text
                style={{
                  fontSize: typography.textStyles.label.fontSize,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.textPrimary,
                }}
              >
                Completed
              </Text>
              <Badge variant="achievement" size="small">
                {completedChallenges.length}
              </Badge>
            </View>
            <ChevronRightIcon size={iconSize.sm} color={colors.textMuted} />
          </TouchableOpacity>
        </ScreenSection>
      )}
    </ScreenContainer>
  );
}
