// src/components/challenge-detail/ChallengeDetailScreen.tsx
//
// ORCHESTRATOR — computes first-class concerns, wires sub-components.
//
// ViewerRole, EffectiveStatus, and serverNow are computed ONCE here,
// then threaded to sub-components as required typed props.
// No sub-component re-derives these concerns.
//
// Bugs fixed structurally (not patched):
//   B1: effectiveStatus is required prop → HeaderCard must display it
//   B2: serverNow threaded to YourActivitySection → can't use device clock
//   B3: formatTimeRemaining in HeaderCard → correct text for every lifecycle state
//   B4: topInset threaded to MoreMenu → can't hardcode positioning
//   B5: Leaderboard clamps percent in both bar and text
//   B6: No redundant .slice(0, 5) — hook already limits
//   U1: PendingInviteBanner rendered when viewerRole === "pending"
//   U2: InviteModal receives existingParticipantIds → filters results
//   U3: HeaderCard shows contextual message when logging unavailable
//   Q3: InviteModal owns its own search state
//   Q4: LogActivitySheet uses parseInt with radix
//   Q6: computedValues null guard → early return, no non-null assertion

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import {
  useChallenge,
  useLeaderboard,
  useLogActivity,
  useLogWorkout,
  useInviteUser,
  useLeaveChallenge,
  useCancelChallenge,
  useRespondToInvite,
  useRematchChallenge,
} from "@/hooks/useChallenges";
import { useChallengeActivities } from "@/hooks/useActivities";
import { generateClientEventId } from "@/services/activities";
import { useLeaderboardSubscription } from "@/hooks/useRealtimeSubscription";
import { LoadingState, ErrorState } from "@/components/shared";
import { useAppTheme } from "@/providers/ThemeProvider";
import { getEffectiveStatus, canLogActivity } from "@/lib/challengeStatus";
import {
  getServerNow,
  syncServerTime,
  getDaysRemaining,
} from "@/lib/serverTime";
import { TestIDs } from "@/constants/testIDs";
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from "react-native-heroicons/outline";

// Sub-components
import { HeaderCard } from "./HeaderCard";
import { PendingInviteBanner } from "./PendingInviteBanner";
import { CompletedBanner } from "./CompletedBanner";
import { LeaderboardSection } from "./LeaderboardSection";
import { ChallengeInfoSection } from "./ChallengeInfoSection";
import { YourActivitySection } from "./YourActivitySection";
import { LogActivitySheet } from "./LogActivitySheet";
import { MoreMenu } from "./MoreMenu";
import { InviteModal } from "./InviteModal";
import { getDaysElapsed, TREND_THRESHOLD_DAYS } from "./helpers";
import type { ViewerRole, ChallengeComputedValues } from "./types";

// =============================================================================
// PROPS
// =============================================================================

export interface ChallengeDetailScreenProps {
  challengeId: string;
}

// =============================================================================
// MAIN COMPONENT (ORCHESTRATOR)
// =============================================================================

export function ChallengeDetailScreen({
  challengeId,
}: ChallengeDetailScreenProps) {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  // Data fetching
  const {
    data: challenge,
    isLoading,
    error,
    refetch,
  } = useChallenge(challengeId);
  const { data: leaderboard, refetch: refetchLeaderboard } =
    useLeaderboard(challengeId);
  const { data: recentActivities } = useChallengeActivities(challengeId, 5);

  // Realtime subscription
  useLeaderboardSubscription(challengeId);

  // Ensure server time is synced
  useEffect(() => {
    syncServerTime().catch(() => {});
  }, [challengeId]);

  // Mutations
  const logActivity = useLogActivity();
  const logWorkout = useLogWorkout();
  const inviteUser = useInviteUser();
  const leaveChallenge = useLeaveChallenge();
  const cancelChallenge = useCancelChallenge();
  const respondToInvite = useRespondToInvite();
  const rematchChallenge = useRematchChallenge();

  // UI State — only what the orchestrator needs
  const [refreshing, setRefreshing] = useState(false);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);

  // Navigation
  const homeFallback = "/(tabs)";
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(homeFallback);
  };

  // Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchLeaderboard()]);
    setRefreshing(false);
  };

  // =========================================================================
  // FIRST-CLASS CONCERNS — computed once, threaded everywhere
  // =========================================================================

  const serverNow = getServerNow();

  // Viewer role
  const viewerRole: ViewerRole | null = useMemo(() => {
    if (!challenge || !profile?.id) return null;
    if (challenge.creator_id === profile.id) return "creator";
    const inviteStatus = challenge.my_participation?.invite_status;
    if (inviteStatus === "accepted") return "accepted";
    if (inviteStatus === "pending") return "pending";
    return null;
  }, [challenge, profile?.id]);

  // Effective status
  const effectiveStatus = useMemo(
    () => (challenge ? getEffectiveStatus(challenge, serverNow) : null),
    [challenge, serverNow],
  );

  // Computed values
  const computedValues: ChallengeComputedValues | null = useMemo(() => {
    if (!challenge) return null;

    const myProgress = challenge.my_participation?.current_progress || 0;
    const goalValue = challenge.goal_value;
    const progressPercent = Math.min((myProgress / goalValue) * 100, 100);
    const daysLeft = getDaysRemaining(challenge.end_date);
    const daysElapsed = getDaysElapsed(challenge.start_date, serverNow);

    const myLeaderboardEntry = leaderboard?.find(
      (e) => e.user_id === profile?.id,
    );
    const myRank = myLeaderboardEntry?.rank || 0;
    const todayProgress = myLeaderboardEntry?.today_change || 0;
    const participantCount = leaderboard?.length || 1;

    const avgPerDay =
      daysElapsed > 0 ? Math.round(myProgress / daysElapsed) : myProgress;

    const totalDays = daysElapsed + daysLeft;
    const showTrend = daysElapsed >= TREND_THRESHOLD_DAYS && totalDays > 0;
    let trend = 0;
    if (showTrend) {
      const expectedByNow = (daysElapsed / totalDays) * goalValue;
      trend =
        expectedByNow > 0
          ? Math.round((myProgress / expectedByNow - 1) * 100)
          : 0;
    }

    return {
      myProgress,
      myRank,
      goalValue,
      progressPercent,
      daysLeft,
      daysElapsed,
      participantCount,
      todayProgress,
      avgPerDay,
      showTrend,
      trend,
    };
  }, [challenge, leaderboard, profile?.id, serverNow]);

  // Can log?
  const canLog =
    viewerRole === "accepted" &&
    challenge != null &&
    canLogActivity(challenge, serverNow);

  // Existing participant IDs (for invite filtering)
  const existingParticipantIds = useMemo(
    () => leaderboard?.map((e) => e.user_id) || [],
    [leaderboard],
  );

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleLogActivity = async (value: number) => {
    if (!challenge) return;
    const client_event_id = generateClientEventId();
    try {
      await logActivity.mutateAsync({
        challenge_id: challenge.id,
        activity_type: challenge.challenge_type,
        value,
        client_event_id,
      });
      setShowLogSheet(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log activity");
    }
  };

  const handleLogWorkout = async (
    workoutType: string,
    durationMinutes: number,
  ) => {
    if (!challenge) return;
    const client_event_id = generateClientEventId();
    try {
      const result = await logWorkout.mutateAsync({
        challenge_id: challenge.id,
        workout_type: workoutType,
        duration_minutes: durationMinutes,
        client_event_id,
      });
      setShowLogSheet(false);
      if (result.points && result.points > 0) {
        Alert.alert(
          "Workout Logged!",
          `You earned ${result.points} point${result.points !== 1 ? "s" : ""}!`,
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log workout");
    }
  };

  const handleInviteUser = async (userId: string) => {
    if (!challenge) return;
    await inviteUser.mutateAsync({
      challenge_id: challenge.id,
      user_id: userId,
    });
    Alert.alert("Invited!", "User has been invited to the challenge");
    setShowInviteModal(false);
  };

  const handleAcceptInvite = async () => {
    if (!challenge) return;
    try {
      await respondToInvite.mutateAsync({
        challenge_id: challenge.id,
        response: "accepted",
      });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept invite");
    }
  };

  const handleDeclineInvite = async () => {
    if (!challenge) return;
    Alert.alert("Decline Invite", "Are you sure you want to decline?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            await respondToInvite.mutateAsync({
              challenge_id: challenge.id,
              response: "declined",
            });
            handleBack();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to decline invite");
          }
        },
      },
    ]);
  };

  const handleLeaveChallenge = () => {
    if (!challenge) return;
    Alert.alert("Leave Challenge", "Your progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveChallenge.mutateAsync(challenge.id);
            handleBack();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to leave challenge");
          }
        },
      },
    ]);
  };

  const handleCancelChallenge = () => {
    if (!challenge) return;
    Alert.alert(
      "Cancel Challenge",
      "This will end the challenge for all participants.",
      [
        { text: "Keep Challenge", style: "cancel" },
        {
          text: "Cancel Challenge",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelChallenge.mutateAsync(challenge.id);
              handleBack();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to cancel challenge");
            }
          },
        },
      ],
    );
  };

  const handleRematch = () => {
    if (!challenge || !leaderboard) return;
    const participantCount = leaderboard.length;
    const othersCount = participantCount - 1;
    const message =
      othersCount > 0
        ? `This will create a new challenge with the same settings and invite ${othersCount} participant${othersCount === 1 ? "" : "s"}.`
        : "This will create a new solo challenge with the same settings.";

    Alert.alert("Start Rematch?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Rematch",
        onPress: async () => {
          try {
            const participantIds = leaderboard.map((e) => e.user_id);
            const newChallengeId = await rematchChallenge.mutateAsync({
              original: challenge,
              previousParticipantIds: participantIds,
            });
            router.push(`/challenge/${newChallengeId}`);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to create rematch");
          }
        },
      },
    ]);
  };

  // Derive winner(s) from leaderboard — handle ties
  const topEntries = leaderboard?.filter((e) => e.rank === 1) ?? [];
  const winner = topEntries[0] ?? null;
  const isTied = topEntries.length > 1;
  const isCurrentUserWinner = topEntries.some((e) => e.user_id === profile?.id);

  // =========================================================================
  // LOADING / ERROR STATES
  // =========================================================================

  if (isLoading) {
    return <LoadingState message="Loading challenge..." />;
  }

  if (
    error ||
    !challenge ||
    !effectiveStatus ||
    !computedValues ||
    !viewerRole
  ) {
    return (
      <ErrorState
        title="Couldn't load challenge"
        message="There was a problem loading the challenge details."
        onRetry={() => refetch()}
        onBack={handleBack}
      />
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      testID={TestIDs.screens.challengeDetail}
    >
      {/* Top Zone */}
      <View style={{ backgroundColor: colors.surface }}>
        {/* Top Bar */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: spacing.sm,
          }}
        >
          <TouchableOpacity
            style={{ padding: spacing.xs }}
            onPress={handleBack}
            testID={TestIDs.nav.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: spacing.xs }}
            onPress={() => setShowMoreMenu(true)}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <EllipsisVerticalIcon size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Header Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            marginHorizontal: spacing.md,
            marginBottom: spacing.md,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <HeaderCard
            challenge={challenge}
            computedValues={computedValues}
            status={effectiveStatus}
            canLog={canLog}
            onLogActivity={() => setShowLogSheet(true)}
          />
        </View>
      </View>

      {/* Pending Invite Banner */}
      {viewerRole === "pending" && (
        <PendingInviteBanner
          challenge={challenge}
          onAccept={handleAcceptInvite}
          onDecline={handleDeclineInvite}
          isResponding={respondToInvite.isPending}
        />
      )}

      {/* Completed Banner — winner display + rematch CTA */}
      {effectiveStatus === "completed" && viewerRole !== "pending" && (
        <CompletedBanner
          winner={winner}
          isCurrentUserWinner={isCurrentUserWinner}
          isTied={isTied}
          isCreator={viewerRole === "creator"}
          participantCount={computedValues.participantCount}
          onRematch={handleRematch}
          isRematchPending={rematchChallenge.isPending}
        />
      )}

      {/* Content */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        <View style={{ padding: spacing.md, paddingTop: spacing.xs }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Leaderboard Section */}
            <SectionBand title="Leaderboard" />
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <LeaderboardSection
                leaderboard={leaderboard || []}
                goalValue={challenge.goal_value}
                currentUserId={profile?.id || ""}
                viewerRole={viewerRole}
                showAll={showAllLeaderboard}
                onToggleShowAll={() =>
                  setShowAllLeaderboard(!showAllLeaderboard)
                }
              />
            </View>

            {/* Challenge Info Section */}
            <SectionBand title="Challenge Info" />
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <ChallengeInfoSection
                challenge={challenge}
                status={effectiveStatus}
              />
            </View>

            {/* Your Activity Section */}
            <SectionBand title="Your Activity" />
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <YourActivitySection
                activities={recentActivities || []}
                goalUnit={challenge.goal_unit}
                serverNow={serverNow}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Overlays */}
      <LogActivitySheet
        visible={showLogSheet}
        onClose={() => setShowLogSheet(false)}
        onSubmit={handleLogActivity}
        onSubmitWorkout={handleLogWorkout}
        isLoading={logActivity.isPending || logWorkout.isPending}
        goalUnit={challenge.goal_unit}
        challengeType={challenge.challenge_type}
        allowedWorkoutTypes={challenge.allowed_workout_types}
      />

      <MoreMenu
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        viewerRole={viewerRole}
        topInset={insets.top}
        onInvite={() => {
          setShowMoreMenu(false);
          setShowInviteModal(true);
        }}
        onLeave={() => {
          setShowMoreMenu(false);
          handleLeaveChallenge();
        }}
        onCancel={() => {
          setShowMoreMenu(false);
          handleCancelChallenge();
        }}
      />

      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        challengeId={challengeId}
        existingParticipantIds={existingParticipantIds}
        onInvite={handleInviteUser}
      />
    </View>
  );
}

// =============================================================================
// SECTION BAND (small shared sub-component, kept local)
// =============================================================================

function SectionBand({ title }: { title: string }) {
  const { colors, spacing } = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

export default ChallengeDetailScreen;
