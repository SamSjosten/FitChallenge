// app/(tabs)/index.tsx
// Home/Dashboard screen - Design System v1.0

import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
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
  Card,
  LoadingScreen,
  ErrorMessage,
  Badge,
  ProgressBar,
  Avatar,
} from "@/components/ui";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  TrophyIcon,
  ChevronRightIcon,
  BellIcon,
  PlusIcon,
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

  const [refreshing, setRefreshing] = React.useState(false);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refetchActive();
      refetchPending();
      refetchCompleted();
    }, [refetchActive, refetchPending, refetchCompleted])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchActive(), refetchPending(), refetchCompleted()]);
    setRefreshing(false);
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

  if (loadingActive && loadingPending && !refreshing) {
    return <LoadingScreen />;
  }

  const currentStreak = profile?.current_streak || 0;
  const xpTotal = profile?.xp_total || 0;
  const displayName = profile?.display_name || profile?.username || "Athlete";

  // Get the first active challenge for featured display
  const featuredChallenge = activeChallenges?.[0];
  const totalChallenges =
    (activeChallenges?.length || 0) + (completedChallenges?.length || 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary.main}
        />
      }
    >
      {/* ===== HEADER ===== */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: typography.textStyles.display.fontSize,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            FitChallenge
          </Text>
          <Text
            style={{
              fontSize: typography.textStyles.body.fontSize,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textSecondary,
            }}
          >
            Hello, {displayName}!
          </Text>
        </View>
        <TouchableOpacity style={{ padding: spacing.sm }}>
          <BellIcon size={iconSize.md} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ===== STREAK BANNER ===== */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
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
      </View>

      {/* ===== PENDING INVITES ===== */}
      {pendingInvites && pendingInvites.length > 0 && (
        <View
          style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}
        >
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Avatar
                      name={
                        invite.creator.display_name || invite.creator.username
                      }
                      size="xs"
                    />
                    <Text
                      style={{
                        fontSize: typography.textStyles.caption.fontSize,
                        fontFamily: "PlusJakartaSans_500Medium",
                        color: colors.textSecondary,
                      }}
                    >
                      from{" "}
                      {invite.creator.display_name || invite.creator.username}
                    </Text>
                  </View>
                </View>
                <Badge variant="energy">Invite</Badge>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary.main,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.button,
                    alignItems: "center",
                  }}
                  onPress={() => handleAcceptInvite(invite.challenge.id)}
                >
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
                    backgroundColor: colors.background,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.button,
                    alignItems: "center",
                  }}
                  onPress={() => handleDeclineInvite(invite.challenge.id)}
                >
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
        </View>
      )}

      {/* ===== ACTIVE CHALLENGE (Featured) ===== */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
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
            Active Challenge
          </Text>
          {activeChallenges && activeChallenges.length > 1 && (
            <TouchableOpacity onPress={() => router.push("/challenges")}>
              <Text
                style={{
                  fontSize: typography.textStyles.caption.fontSize,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.primary.main,
                }}
              >
                See all →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {activeError && (
          <ErrorMessage
            message="Failed to load challenges"
            onRetry={refetchActive}
          />
        )}

        {(!activeChallenges || activeChallenges.length === 0) &&
          !activeError && (
            <Card>
              <View
                style={{ alignItems: "center", paddingVertical: spacing.lg }}
              >
                <TrophyIcon size={48} color={colors.textMuted} />
                <Text
                  style={{
                    fontSize: typography.textStyles.body.fontSize,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                    marginTop: spacing.md,
                    textAlign: "center",
                  }}
                >
                  No active challenges
                </Text>
                <Text
                  style={{
                    fontSize: typography.textStyles.caption.fontSize,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                    marginTop: spacing.xs,
                    textAlign: "center",
                  }}
                >
                  Create one or accept an invite to get started
                </Text>
              </View>
            </Card>
          )}

        {featuredChallenge && (
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
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: typography.textStyles.title.fontSize,
                    fontFamily: "PlusJakartaSans_600SemiBold",
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
      </View>

      {/* ===== QUICK STATS ===== */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
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
      </View>

      {/* ===== COMPLETED CHALLENGES LINK ===== */}
      {completedChallenges && completedChallenges.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg }}>
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
        </View>
      )}
    </ScrollView>
  );
}
