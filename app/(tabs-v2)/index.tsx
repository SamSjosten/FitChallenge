// app/(tabs-v2)/index.tsx
// V2 Home Screen - Dashboard with challenges overview
// Design System v2.0 - Based on prototype
//
// Features:
// - Greeting header with user name
// - Animated streak banner with swipe-to-dismiss
// - Challenge filter dropdown
// - Pending invites section
// - Active challenges (collapsible cards)
// - Recent activity section
// - Completed challenges (collapsible section)

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import {
  useActiveChallenges,
  useCompletedChallenges,
  usePendingInvites,
  useRespondToInvite,
} from "@/hooks/useChallenges";
import {
  useRecentActivities,
  toDisplayActivity,
  getActivityTypeName,
} from "@/hooks/useActivities";
import {
  LoadingState,
  EmptyState,
  ChallengeCard,
  CompletedChallengeRow,
  InviteCard,
  ChallengeFilter,
  ActiveFilterBadge,
  CHALLENGE_FILTERS,
  type ChallengeFilterType,
  StreakBanner,
  ActivityRow,
  RecentActivityHeader,
  NoRecentActivity,
} from "@/components/v2";
import { Toast, useToast } from "@/components/v2/Toast";
import { BiometricSetupModal } from "@/components/BiometricSetupModal";
import { pushTokenService } from "@/services/pushTokens";
import { TestIDs } from "@/constants/testIDs";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  BellIcon,
} from "react-native-heroicons/outline";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import type { ActivityType } from "@/components/icons/ActivityIcons";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HomeScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const { profile } = useAuth();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { toast, showToast, hideToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChallengeFilterType>("all");

  // Biometric setup modal state (shown after sign-in if eligible)
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Check for pending biometric setup on mount
  useEffect(() => {
    const checkPendingBiometricSetup = async () => {
      try {
        const stored = await AsyncStorage.getItem(
          "fitchallenge_pending_biometric_setup",
        );
        if (stored) {
          const credentials = JSON.parse(stored);
          setPendingCredentials(credentials);
          setShowBiometricSetup(true);
          // Clear the flag immediately so it doesn't show again
          await AsyncStorage.removeItem("fitchallenge_pending_biometric_setup");
        }
      } catch (error) {
        console.error("Error checking pending biometric setup:", error);
        // Clear any corrupted data
        await AsyncStorage.removeItem("fitchallenge_pending_biometric_setup");
      }
    };
    checkPendingBiometricSetup();
  }, []);

  // Handle biometric setup completion
  const handleBiometricSetupComplete = (enabled: boolean) => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
  };

  // Handle biometric setup dismissal
  const handleBiometricSetupDismiss = () => {
    setShowBiometricSetup(false);
    setPendingCredentials(null);
  };

  const {
    data: activeChallenges,
    isLoading: loadingActive,
    refetch: refetchActive,
  } = useActiveChallenges();

  const {
    data: pendingInvites,
    isLoading: loadingPending,
    refetch: refetchPending,
  } = usePendingInvites();

  const { data: completedChallenges, refetch: refetchCompleted } =
    useCompletedChallenges();

  const { data: recentActivities, refetch: refetchActivities } =
    useRecentActivities(5);

  const respondToInvite = useRespondToInvite();

  // Filter challenges based on selected filter
  const filteredChallenges = useMemo(() => {
    if (!activeChallenges) return [];

    let filtered = [...activeChallenges];

    switch (activeFilter) {
      case "ending":
        // Sort by days left, filter to those ending within 5 days
        filtered = filtered
          .filter((c) => {
            const endDate = new Date(c.end_date);
            const now = new Date();
            const daysLeft = Math.ceil(
              (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );
            return daysLeft <= 5 && daysLeft >= 0;
          })
          .sort(
            (a, b) =>
              new Date(a.end_date).getTime() - new Date(b.end_date).getTime(),
          );
        break;
      case "steps":
        filtered = filtered.filter((c) => c.challenge_type === "steps");
        break;
      case "workouts":
      case "workout_points":
        filtered = filtered.filter((c) => c.challenge_type === "workouts");
        break;
      case "distance":
        filtered = filtered.filter((c) => c.challenge_type === "distance");
        break;
      case "active_minutes":
        filtered = filtered.filter(
          (c) => c.challenge_type === "active_minutes",
        );
        break;
      default:
        // "all" - no filter
        break;
    }

    return filtered;
  }, [activeChallenges, activeFilter]);

  // Transform activities for display
  const displayActivities = useMemo(() => {
    if (!recentActivities) return [];
    return recentActivities.slice(0, 2).map(toDisplayActivity);
  }, [recentActivities]);

  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetchActive();
      refetchPending();
      refetchCompleted();
      refetchActivities();
    }, [refetchActive, refetchPending, refetchCompleted, refetchActivities]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchActive(),
      refetchPending(),
      refetchCompleted(),
      refetchActivities(),
    ]);
    setRefreshing(false);
  };

  const handleAcceptInvite = async (challengeId: string) => {
    try {
      await respondToInvite.mutateAsync({
        challenge_id: challengeId,
        response: "accepted",
      });
      pushTokenService
        .requestAndRegister()
        .catch((err) => console.warn("Push notification setup failed:", err));
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

  const toggleCompleted = () => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setCompletedExpanded(!completedExpanded);
  };

  const handleStreakDismiss = () => {
    // Banner handles its own dismiss logic
  };

  const handleShowUndoToast = (onUndo: () => void) => {
    showToast("Streak moved to Profile", {
      actionLabel: "Undo",
      onAction: onUndo,
    });
  };

  const handleFilterChange = (filter: ChallengeFilterType) => {
    LayoutAnimation.configureNext({
      duration: 200,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setActiveFilter(filter);
  };

  const handleClearFilter = () => {
    handleFilterChange("all");
  };

  // Loading state
  if (loadingActive && loadingPending) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <LoadingState variant="full-screen" />
      </SafeAreaView>
    );
  }

  const currentStreak = profile?.current_streak || 0;
  const displayName = profile?.display_name || profile?.username || "Athlete";
  const currentFilterLabel =
    CHALLENGE_FILTERS.find((f) => f.id === activeFilter)?.label || "All";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
      testID={TestIDs.screensV2?.home || "home-screen-v2"}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Hello,
            </Text>
            <Text style={[styles.displayName, { color: colors.textPrimary }]}>
              {displayName}! 👋
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push("/notifications")}
          >
            <BellIcon size={24} color={colors.textSecondary} />
            {unreadCount !== undefined && unreadCount > 0 && (
              <View
                style={[
                  styles.notificationBadge,
                  { backgroundColor: colors.error },
                ]}
              >
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Animated Streak Banner with Swipe-to-Dismiss */}
        <View style={{ marginTop: spacing.lg }}>
          <StreakBanner
            streak={currentStreak}
            onDismiss={handleStreakDismiss}
            showUndoToast={handleShowUndoToast}
          />
        </View>

        {/* Pending Invites */}
        {pendingInvites && pendingInvites.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                PENDING INVITES
              </Text>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.energy.subtle },
                ]}
              >
                <Text style={[styles.countText, { color: colors.energy.dark }]}>
                  {pendingInvites.length}
                </Text>
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              {pendingInvites.map((invite) => (
                <InviteCard
                  key={invite.challenge.id}
                  invite={invite}
                  onAccept={handleAcceptInvite}
                  onDecline={handleDeclineInvite}
                  onPress={(challengeId) =>
                    router.push(`/invite/${challengeId}`)
                  }
                  loading={respondToInvite.isPending}
                />
              ))}
            </View>
          </View>
        )}

        {/* Active Challenges with Filter */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                ACTIVE CHALLENGES
              </Text>
              <ChallengeFilter
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
              />
            </View>
            {activeChallenges && activeChallenges.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push("/(tabs-v2)/challenges")}
              >
                <Text
                  style={[styles.seeAllText, { color: colors.primary.main }]}
                >
                  See All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Active Filter Badge */}
          <ActiveFilterBadge
            filter={activeFilter}
            label={currentFilterLabel}
            onClear={handleClearFilter}
          />

          {!activeChallenges || activeChallenges.length === 0 ? (
            <EmptyState
              variant="challenges"
              actionLabel="Create Challenge"
              onAction={() => router.push("/challenge/create")}
            />
          ) : filteredChallenges.length === 0 ? (
            <View
              style={[
                styles.noMatchCard,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                },
              ]}
            >
              <Text
                style={[styles.noMatchText, { color: colors.textSecondary }]}
              >
                No challenges match this filter
              </Text>
              <TouchableOpacity onPress={handleClearFilter}>
                <Text
                  style={[styles.showAllText, { color: colors.primary.main }]}
                >
                  Show all challenges
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(activeFilter !== "all"
                ? filteredChallenges
                : filteredChallenges.slice(0, 3)
              ).map((challenge, index) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  defaultExpanded={index === 0}
                />
              ))}
            </View>
          )}
        </View>

        {/* Recent Activity Section */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <RecentActivityHeader onSeeAll={() => router.push("/activity")} />

          {!displayActivities || displayActivities.length === 0 ? (
            <NoRecentActivity />
          ) : (
            <View
              style={[
                styles.activityCard,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  overflow: "hidden",
                },
              ]}
            >
              {displayActivities.map((activity, index) => (
                <ActivityRow
                  key={activity.id}
                  id={activity.id}
                  type={activity.activity_type as ActivityType}
                  name={getActivityTypeName(activity.activity_type)}
                  duration={Math.round(activity.value / 60) || activity.value}
                  date={activity.displayDate}
                  time={activity.displayTime}
                  points={activity.points}
                  onPress={() => router.push(`/activity/${activity.id}`)}
                  showBorder={index < displayActivities.length - 1}
                />
              ))}
            </View>
          )}
        </View>

        {/* Completed Challenges */}
        {completedChallenges && completedChallenges.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={toggleCompleted}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  COMPLETED
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: colors.achievement.subtle },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: colors.achievement.dark },
                    ]}
                  >
                    {completedChallenges.length}
                  </Text>
                </View>
              </View>
              {completedExpanded ? (
                <ChevronUpIcon size={20} color={colors.textMuted} />
              ) : (
                <ChevronDownIcon size={20} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {completedExpanded && (
              <View style={{ gap: spacing.sm }}>
                {completedChallenges.slice(0, 5).map((challenge) => (
                  <CompletedChallengeRow
                    key={challenge.id}
                    challenge={challenge}
                  />
                ))}
                {completedChallenges.length > 5 && (
                  <TouchableOpacity
                    style={[
                      styles.viewMoreButton,
                      {
                        backgroundColor: colors.surface,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => router.push("/(tabs-v2)/challenges")}
                  >
                    <Text
                      style={[
                        styles.viewMoreText,
                        { color: colors.primary.main },
                      ]}
                    >
                      View All Completed
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Bottom spacing for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Toast for undo */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        actionLabel={toast.actionLabel}
        onAction={toast.onAction}
        onDismiss={hideToast}
      />

      {/* Biometric setup modal (shown after sign-in if eligible) */}
      {pendingCredentials && (
        <BiometricSetupModal
          visible={showBiometricSetup}
          email={pendingCredentials.email}
          password={pendingCredentials.password}
          onComplete={handleBiometricSetupComplete}
          onDismiss={handleBiometricSetupDismiss}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {},
  greeting: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  displayName: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
    marginTop: 2,
  },
  notificationButton: {
    position: "relative",
    padding: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  section: {},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.5,
  },
  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  viewMoreButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  viewMoreText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  noMatchCard: {
    alignItems: "center",
  },
  noMatchText: {
    fontSize: 14,
    marginBottom: 8,
  },
  showAllText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  activityCard: {},
});
