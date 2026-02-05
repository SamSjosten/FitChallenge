// src/components/challenge-detail-v2/ChallengeDetailScreenV2.tsx
// Challenge Detail Screen - V2 Design System
// Implements: Header Card (Variation D), Gray Band Section Headers (A4),
// Leaderboard with fill bars, Graceful Trend/Avg swap

import React, { useState, useEffect, useMemo } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/lib/featureFlags";
import {
  useChallenge,
  useLeaderboard,
  useLogActivity,
  useInviteUser,
  useLeaveChallenge,
  useCancelChallenge,
} from "@/hooks/useChallenges";
import { useChallengeActivities } from "@/hooks/useActivities";
import { generateClientEventId } from "@/services/activities";
import { useLeaderboardSubscription } from "@/hooks/useRealtimeSubscription";
import { authService } from "@/services/auth";
import { Avatar } from "@/components/ui";
import { LoadingState, ErrorState } from "@/components/v2";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  getEffectiveStatus,
  canLogActivity,
  getStatusLabel,
} from "@/lib/challengeStatus";
import {
  getServerNow,
  syncServerTime,
  getDaysRemaining,
} from "@/lib/serverTime";
import { TestIDs } from "@/constants/testIDs";
import {
  ChevronLeftIcon,
  PlusIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  HeartIcon,
} from "react-native-heroicons/outline";
import type { ProfilePublic } from "@/types/database";
import type {
  ChallengeWithParticipation,
  LeaderboardEntry,
} from "@/services/challenges";

// =============================================================================
// CONSTANTS
// =============================================================================

const ACTIVITY_ICONS: Record<string, string> = {
  steps: "👟",
  active_minutes: "⏱️",
  workouts: "💪",
  distance: "🏃",
  custom: "🎯",
};

const RANK_EMOJI: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

const LEADERBOARD_DISPLAY_LIMIT = 5;
const TREND_THRESHOLD_DAYS = 4; // Show trend after 4 days

// =============================================================================
// PROPS
// =============================================================================

export interface ChallengeDetailScreenV2Props {
  challengeId: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ChallengeDetailScreenV2({
  challengeId,
}: ChallengeDetailScreenV2Props) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { uiVersion } = useFeatureFlags();

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
  const inviteUser = useInviteUser();
  const leaveChallenge = useLeaveChallenge();
  const cancelChallenge = useCancelChallenge();

  // UI State
  const [refreshing, setRefreshing] = useState(false);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [activityValue, setActivityValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePublic[]>([]);
  const [searching, setSearching] = useState(false);

  // Navigation
  const homeFallback = uiVersion === "v2" ? "/(tabs-v2)" : "/(tabs)";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(homeFallback);
    }
  };

  // Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchLeaderboard()]);
    setRefreshing(false);
  };

  // Computed values
  const computedValues = useMemo(() => {
    if (!challenge) return null;

    const myProgress = challenge.my_participation?.current_progress || 0;
    const goalValue = challenge.goal_value;
    const progressPercent = Math.min((myProgress / goalValue) * 100, 100);
    const daysLeft = getDaysRemaining(challenge.end_date);
    const daysElapsed = getDaysElapsed(challenge.start_date);

    // Derive rank, today, and participant count from leaderboard (server-authoritative)
    const myLeaderboardEntry = leaderboard?.find(
      (e) => e.user_id === profile?.id,
    );
    const myRank = myLeaderboardEntry?.rank || 0;
    const todayProgress = myLeaderboardEntry?.today_change || 0;
    const participantCount = leaderboard?.length || 1;

    // Calculate average per day
    const avgPerDay =
      daysElapsed > 0 ? Math.round(myProgress / daysElapsed) : myProgress;

    // Calculate trend: how far ahead/behind goal pace
    // Positive = ahead of pace needed to complete goal
    // Negative = behind pace
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
  }, [challenge, leaderboard, profile?.id]);

  // Handlers
  const handleLogActivity = async () => {
    if (!activityValue || parseInt(activityValue) <= 0) {
      Alert.alert("Invalid Value", "Please enter a positive number");
      return;
    }
    if (!challenge) return;

    const client_event_id = generateClientEventId();

    try {
      await logActivity.mutateAsync({
        challenge_id: challenge.id,
        activity_type: challenge.challenge_type,
        value: parseInt(activityValue),
        client_event_id,
      });
      setShowLogSheet(false);
      setActivityValue("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to log activity");
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const results = await authService.searchUsers(searchQuery);
      setSearchResults(results.filter((r) => r.id !== profile?.id));
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (userId: string) => {
    if (!challenge) return;
    try {
      await inviteUser.mutateAsync({
        challenge_id: challenge.id,
        user_id: userId,
      });
      Alert.alert("Invited!", "User has been invited to the challenge");
      setShowInviteModal(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to invite user");
    }
  };

  const handleLeaveChallenge = () => {
    if (!challenge) return;
    Alert.alert(
      "Leave Challenge",
      "Are you sure you want to leave? Your progress will be lost.",
      [
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
      ],
    );
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

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading challenge..." />;
  }

  // Error state
  if (error || !challenge) {
    return (
      <ErrorState
        title="Couldn't load challenge"
        message="There was a problem loading the challenge details."
        onRetry={() => refetch()}
        onBack={handleBack}
      />
    );
  }

  const isCreator = challenge.creator_id === profile?.id;
  const myInviteStatus = challenge.my_participation?.invite_status;
  const effectiveStatus = getEffectiveStatus(challenge, getServerNow());
  const challengeAllowsLogging = canLogActivity(challenge, getServerNow());
  const canLog = myInviteStatus === "accepted" && challengeAllowsLogging;

  // Styles with theme
  const themedStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topZone: {
      backgroundColor: colors.surface,
    },
    topBar: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: spacing.md,
      paddingTop: insets.top + spacing.sm,
      paddingBottom: spacing.sm,
    },
    iconButton: {
      padding: spacing.xs,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      overflow: "hidden" as const,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    sectionBand: {
      backgroundColor: colors.background,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "PlusJakartaSans_600SemiBold",
      color: colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
  };

  return (
    <View
      style={themedStyles.container}
      testID={TestIDs.screens.challengeDetail}
    >
      {/* Top Zone */}
      <View style={themedStyles.topZone}>
        {/* Top Bar */}
        <View style={themedStyles.topBar}>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={handleBack}
            testID={TestIDs.nav.backButton}
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => setShowMoreMenu(true)}
          >
            <EllipsisVerticalIcon size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Header Card */}
        <View style={themedStyles.headerCard}>
          <HeaderCard
            challenge={challenge}
            computedValues={computedValues!}
            canLog={canLog}
            onLogActivity={() => setShowLogSheet(true)}
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        {/* Content Card */}
        <View style={{ padding: spacing.md, paddingTop: spacing.xs }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Leaderboard Section */}
            <View style={themedStyles.sectionBand}>
              <Text style={themedStyles.sectionTitle}>Leaderboard</Text>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              {myInviteStatus === "pending" ? (
                <View
                  testID={TestIDs.challengeDetail.leaderboardLocked}
                  style={{ padding: spacing.lg, alignItems: "center" }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.base,
                      fontFamily: "PlusJakartaSans_500Medium",
                      color: colors.textMuted,
                    }}
                  >
                    🔒 Accept the challenge to view leaderboard
                  </Text>
                </View>
              ) : (
                <LeaderboardContent
                  leaderboard={leaderboard || []}
                  goalValue={challenge.goal_value}
                  currentUserId={profile?.id || ""}
                  showAll={showAllLeaderboard}
                  onToggleShowAll={() =>
                    setShowAllLeaderboard(!showAllLeaderboard)
                  }
                />
              )}
            </View>

            {/* Challenge Info Section */}
            <View style={themedStyles.sectionBand}>
              <Text style={themedStyles.sectionTitle}>Challenge Info</Text>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <ChallengeInfoContent challenge={challenge} />
            </View>

            {/* Your Activity Section */}
            <View style={themedStyles.sectionBand}>
              <Text style={themedStyles.sectionTitle}>Your Activity</Text>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <YourActivityContent
                activities={recentActivities || []}
                goalUnit={challenge.goal_unit}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Log Activity Sheet */}
      <LogActivitySheet
        visible={showLogSheet}
        onClose={() => {
          setShowLogSheet(false);
          setActivityValue("");
        }}
        value={activityValue}
        onChangeValue={setActivityValue}
        onSubmit={handleLogActivity}
        isLoading={logActivity.isPending}
        goalUnit={challenge.goal_unit}
        challengeType={challenge.challenge_type}
      />

      {/* More Menu */}
      <MoreMenu
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        isCreator={isCreator}
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

      {/* Invite Modal */}
      <InviteModal
        visible={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={handleSearch}
        searchResults={searchResults}
        searching={searching}
        onInvite={handleInvite}
      />
    </View>
  );
}

// =============================================================================
// HEADER CARD COMPONENT
// =============================================================================

interface HeaderCardProps {
  challenge: ChallengeWithParticipation;
  computedValues: {
    myProgress: number;
    myRank: number;
    goalValue: number;
    progressPercent: number;
    daysLeft: number;
    daysElapsed: number;
    participantCount: number;
    todayProgress: number;
    avgPerDay: number;
    showTrend: boolean;
    trend: number;
  };
  canLog: boolean;
  onLogActivity: () => void;
}

function HeaderCard({
  challenge,
  computedValues,
  canLog,
  onLogActivity,
}: HeaderCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const {
    myProgress,
    myRank,
    goalValue,
    progressPercent,
    daysLeft,
    participantCount,
    todayProgress,
    avgPerDay,
    showTrend,
    trend,
  } = computedValues;

  const activityIcon = ACTIVITY_ICONS[challenge.challenge_type] || "🎯";

  return (
    <View>
      {/* Title Section */}
      <View
        style={{
          padding: spacing.md,
          backgroundColor: `${colors.primary.main}08`,
          borderBottomWidth: 1,
          borderBottomColor: `${colors.primary.main}15`,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: `${colors.primary.main}20`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22 }}>{activityIcon}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: "PlusJakartaSans_700Bold",
                color: colors.textPrimary,
              }}
              numberOfLines={1}
              testID={TestIDs.challengeDetail.challengeTitle}
            >
              {challenge.title}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.primary.subtle,
                  paddingVertical: 2,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.primary.dark,
                  }}
                  testID={TestIDs.challengeDetail.daysRemaining}
                >
                  {daysLeft} days left
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                • {participantCount} participants
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* Rank */}
        <View
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Rank
          </Text>
          <Text style={{ fontSize: 22 }}>
            {RANK_EMOJI[myRank] || myRank || "-"}
          </Text>
        </View>

        {/* Today */}
        <View
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 0.3,
            }}
          >
            Today
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            {todayProgress.toLocaleString()}
          </Text>
        </View>

        {/* Trend or Avg/Day */}
        <View style={{ flex: 1, paddingVertical: 14, alignItems: "center" }}>
          {showTrend ? (
            <>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                Trend
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: trend >= 0 ? colors.primary.main : colors.error,
                }}
              >
                {trend >= 0 ? "↑" : "↓"}
                {Math.abs(trend)}%
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                Avg/Day
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: colors.textPrimary,
                }}
              >
                {formatNumber(avgPerDay)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Progress Section */}
      <View
        style={{ padding: spacing.md }}
        testID={TestIDs.challengeDetail.progressCard}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.primary.main,
            }}
            testID={TestIDs.challengeDetail.progressText}
          >
            {myProgress.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            / {goalValue.toLocaleString()} {challenge.goal_unit}
          </Text>
        </View>

        <View
          style={{
            height: 8,
            backgroundColor: colors.primary.subtle,
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: spacing.md,
          }}
          testID={TestIDs.challengeDetail.progressBar}
        >
          <View
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              backgroundColor: colors.primary.main,
              borderRadius: 4,
            }}
          />
        </View>

        {canLog && (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              backgroundColor: colors.primary.main,
              borderRadius: 12,
            }}
            onPress={onLogActivity}
            testID={TestIDs.challengeDetail.logActivityButton}
          >
            <PlusIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text
              style={{
                fontSize: 15,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: "#FFFFFF",
              }}
            >
              Log Activity
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// LEADERBOARD CONTENT
// =============================================================================

// =============================================================================
// ANIMATED BAR (leaderboard fill)
// =============================================================================

function AnimatedBar({ percent, color }: { percent: number; color: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(percent, 100), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute" as const,
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: `${color}15`,
          borderRightWidth: 2,
          borderRightColor: `${color}40`,
        },
        animatedStyle,
      ]}
    />
  );
}

// =============================================================================
// LEADERBOARD SECTION
// =============================================================================

interface LeaderboardContentProps {
  leaderboard: LeaderboardEntry[];
  goalValue: number;
  currentUserId: string;
  showAll: boolean;
  onToggleShowAll: () => void;
}

function LeaderboardContent({
  leaderboard,
  goalValue,
  currentUserId,
  showAll,
  onToggleShowAll,
}: LeaderboardContentProps) {
  const { colors, spacing } = useAppTheme();

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: "center" }}>
        <Text style={{ color: colors.textMuted }}>No participants yet</Text>
      </View>
    );
  }

  const displayList = showAll
    ? leaderboard
    : leaderboard.slice(0, LEADERBOARD_DISPLAY_LIMIT);
  const remaining = leaderboard.length - LEADERBOARD_DISPLAY_LIMIT;

  return (
    <View
      style={{ borderRadius: 10, overflow: "hidden" }}
      testID={TestIDs.challengeDetail.leaderboardSection}
    >
      {displayList.map((entry, index) => {
        const percent = (entry.current_progress / goalValue) * 100;
        const isYou = entry.user_id === currentUserId;
        const barColor = isYou ? colors.primary.main : colors.textMuted;
        const isLast = index === displayList.length - 1 && remaining <= 0;

        return (
          <View
            key={entry.user_id}
            testID={
              isYou
                ? TestIDs.challengeDetail.leaderboardEntryHighlighted(
                    entry.profile.username,
                  )
                : TestIDs.challengeDetail.leaderboardEntry(index)
            }
            style={{
              position: "relative",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: colors.border,
              overflow: "hidden",
            }}
          >
            {/* Background fill bar (animated) */}
            <AnimatedBar percent={percent} color={barColor} />

            {/* Content */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
                zIndex: 1,
              }}
            >
              {/* Rank */}
              <View style={{ width: 22, alignItems: "center" }}>
                {entry.rank <= 3 ? (
                  <Text style={{ fontSize: 14 }}>{RANK_EMOJI[entry.rank]}</Text>
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "PlusJakartaSans_700Bold",
                      color: colors.textMuted,
                    }}
                  >
                    {entry.rank}
                  </Text>
                )}
              </View>

              {/* Avatar */}
              <Avatar
                name={entry.profile.display_name || entry.profile.username}
                size="sm"
                style={
                  isYou ? { backgroundColor: colors.primary.main } : undefined
                }
              />

              {/* Name */}
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: isYou
                    ? "PlusJakartaSans_600SemiBold"
                    : "PlusJakartaSans_500Medium",
                  color: colors.textPrimary,
                }}
                numberOfLines={1}
              >
                {isYou
                  ? "You"
                  : entry.profile.display_name || entry.profile.username}
              </Text>

              {/* Today's Change */}
              {entry.today_change > 0 && (
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.primary.dark,
                  }}
                >
                  +{formatNumber(entry.today_change)}
                </Text>
              )}

              {/* Percentage */}
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "PlusJakartaSans_700Bold",
                  color: isYou ? colors.primary.dark : colors.textSecondary,
                  width: 32,
                  textAlign: "right",
                }}
              >
                {Math.round(percent)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* +X more button */}
      {remaining > 0 && !showAll && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 12,
          }}
          onPress={onToggleShowAll}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
            }}
          >
            +{remaining} more
          </Text>
        </TouchableOpacity>
      )}

      {/* Show less button */}
      {showAll && leaderboard.length > LEADERBOARD_DISPLAY_LIMIT && (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 12,
          }}
          onPress={onToggleShowAll}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
            }}
          >
            Show less
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// CHALLENGE INFO CONTENT
// =============================================================================

interface ChallengeInfoContentProps {
  challenge: ChallengeWithParticipation;
}

function ChallengeInfoContent({ challenge }: ChallengeInfoContentProps) {
  const { colors, spacing } = useAppTheme();

  const formatDateRange = () => {
    const start = new Date(challenge.start_date);
    const end = new Date(challenge.end_date);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    return `${start.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}`;
  };

  const infoItems = [
    {
      label: "Goal",
      value: `${challenge.goal_value.toLocaleString()} ${challenge.goal_unit}`,
    },
    { label: "Duration", value: formatDateRange() },
    {
      label: "Win Condition",
      value: formatWinCondition(challenge.win_condition),
    },
    { label: "Created by", value: challenge.creator_name || "Unknown" },
  ];

  return (
    <View>
      {infoItems.map((item, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: 8,
            borderBottomWidth: index < infoItems.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {item.label}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textPrimary,
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// YOUR ACTIVITY CONTENT
// =============================================================================

interface YourActivityContentProps {
  activities: Array<{
    id: string;
    value: number;
    recorded_at: string;
    source: string;
  }>;
  goalUnit: string;
}

function YourActivityContent({
  activities,
  goalUnit,
}: YourActivityContentProps) {
  const { colors, spacing } = useAppTheme();

  if (!activities || activities.length === 0) {
    return (
      <View style={{ padding: spacing.md, alignItems: "center" }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          No activity logged yet
        </Text>
      </View>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) {
      return `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else if (date >= yesterday) {
      return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  };

  return (
    <View>
      {activities.slice(0, 5).map((activity, index) => (
        <View
          key={activity.id}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: 8,
            borderBottomWidth:
              index < Math.min(activities.length, 5) - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {activity.source === "healthkit" ||
            activity.source === "googlefit" ? (
              <HeartIcon size={11} color={colors.error} />
            ) : null}
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {formatDate(activity.recorded_at)}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textPrimary,
            }}
          >
            +{activity.value.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// LOG ACTIVITY SHEET
// =============================================================================

interface LogActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChangeValue: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  goalUnit: string;
  challengeType: string;
}

function LogActivitySheet({
  visible,
  onClose,
  value,
  onChangeValue,
  onSubmit,
  isLoading,
  goalUnit,
  challengeType,
}: LogActivitySheetProps) {
  const { colors, spacing, radius } = useAppTheme();

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <View
          testID={TestIDs.logActivity.modal}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.md,
            paddingBottom: spacing.xl + 16,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: spacing.md,
            }}
          />

          <Text
            style={{
              fontSize: 18,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
              marginBottom: spacing.md,
            }}
          >
            Log Activity
          </Text>

          <View style={{ marginBottom: spacing.md }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textSecondary,
                marginBottom: 8,
              }}
            >
              {goalUnit.charAt(0).toUpperCase() + goalUnit.slice(1)}
            </Text>
            <TextInput
              testID={TestIDs.logActivity.valueInput}
              style={{
                padding: 14,
                fontSize: 18,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
              value={value}
              onChangeText={onChangeValue}
              placeholder={challengeType === "steps" ? "5000" : "30"}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              testID={TestIDs.logActivity.cancelButton}
              style={{
                flex: 1,
                padding: 14,
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                alignItems: "center",
              }}
              onPress={onClose}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: colors.textSecondary,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={TestIDs.logActivity.submitButton}
              style={{
                flex: 1,
                padding: 14,
                backgroundColor: colors.primary.main,
                borderRadius: 12,
                alignItems: "center",
                opacity: isLoading ? 0.7 : 1,
              }}
              onPress={onSubmit}
              disabled={isLoading}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "#FFFFFF",
                }}
              >
                {isLoading ? "Logging..." : "Log Activity"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// =============================================================================
// MORE MENU
// =============================================================================

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
  isCreator: boolean;
  onInvite: () => void;
  onLeave: () => void;
  onCancel: () => void;
}

function MoreMenu({
  visible,
  onClose,
  isCreator,
  onInvite,
  onLeave,
  onCancel,
}: MoreMenuProps) {
  const { colors, spacing, radius } = useAppTheme();

  if (!visible) return null;

  const menuItems = [
    { label: "Invite Friends", action: onInvite, show: isCreator },
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
      />

      <View
        style={{
          position: "absolute",
          top: 100,
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
            key={index}
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

// =============================================================================
// INVITE MODAL
// =============================================================================

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  searchResults: ProfilePublic[];
  searching: boolean;
  onInvite: (userId: string) => void;
}

function InviteModal({
  visible,
  onClose,
  searchQuery,
  onSearchChange,
  onSearch,
  searchResults,
  searching,
  onInvite,
}: InviteModalProps) {
  const { colors, spacing, radius, typography } = useAppTheme();

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
        activeOpacity={1}
        onPress={onClose}
      />

      <View
        style={{
          position: "absolute",
          top: "15%",
          left: spacing.xl,
          right: spacing.xl,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          maxHeight: "70%",
        }}
        testID={TestIDs.invite.modal}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.lg,
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize.lg,
              fontFamily: "PlusJakartaSans_700Bold",
              color: colors.textPrimary,
            }}
          >
            Invite Friends
          </Text>
          <TouchableOpacity
            onPress={onClose}
            testID={TestIDs.invite.closeButton}
          >
            <XMarkIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.background,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MagnifyingGlassIcon size={18} color={colors.textMuted} />
            <TextInput
              testID={TestIDs.invite.searchInput}
              style={{
                flex: 1,
                fontSize: typography.fontSize.base,
                fontFamily: "PlusJakartaSans_500Medium",
                color: colors.textPrimary,
              }}
              placeholder="Search by username"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={onSearchChange}
              onSubmitEditing={onSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            testID={TestIDs.invite.searchButton}
            style={{
              backgroundColor: colors.primary.main,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              justifyContent: "center",
            }}
            onPress={onSearch}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: "#FFFFFF",
              }}
            >
              Search
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 300 }}>
          {searchResults.map((user) => (
            <View
              key={user.id}
              testID={TestIDs.invite.userResult(user.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: spacing.md,
                backgroundColor: colors.background,
                borderRadius: radius.md,
                marginBottom: spacing.sm,
              }}
            >
              <Avatar name={user.display_name || user.username} size="sm" />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textPrimary,
                  }}
                >
                  {user.display_name || user.username}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_500Medium",
                    color: colors.textMuted,
                  }}
                >
                  @{user.username}
                </Text>
              </View>
              <TouchableOpacity
                testID={TestIDs.invite.sendInviteButton(user.id)}
                style={{
                  backgroundColor: colors.primary.main,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                }}
                onPress={() => onInvite(user.id)}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: "#FFFFFF",
                  }}
                >
                  Invite
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatWinCondition(condition: string): string {
  const labels: Record<string, string> = {
    highest_total: "Highest Total",
    first_to_goal: "First to Goal",
    longest_streak: "Longest Streak",
    all_complete: "All Complete",
  };
  return labels[condition] || condition;
}

function getDaysElapsed(startDate: string | Date): number {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const now = getServerNow();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default ChallengeDetailScreenV2;
