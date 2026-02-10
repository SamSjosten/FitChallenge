// app/(tabs)/index.tsx
// Home Screen - Dashboard with challenges overview
// Design System v2.0 - Based on mockup home-screen-expandable.jsx
//
// Features:
// - "Welcome, {name}" header with notification bell
// - Streak badge in header when banner is dismissed
// - Animated streak banner with swipe-to-dismiss
// - In Progress section with filter dropdown
// - Starting Soon section (amber themed)
// - Recent Activity section
// - Completed challenges (collapsible card-style section)

import React, { useState, useCallback, useEffect } from "react";
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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useHomeScreenData } from "@/hooks/useHomeScreenData";
import { useChallengeFilters } from "@/hooks/useChallengeFilters";
import {
  LoadingState,
  EmptyState,
  InviteCard,
  ChallengeFilter,
  ActiveFilterBadge,
} from "@/components/shared";
import {
  StreakBanner,
  ActivityRow,
  RecentActivityHeader,
  NoRecentActivity,
  ExpandableChallengeCard,
  SectionHeader,
  StartingSoonCard,
} from "@/components/home";
import { useToast } from "@/providers/ToastProvider";
import { BiometricSetupModal } from "@/components/BiometricSetupModal";
import { TestIDs } from "@/constants/testIDs";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  BellIcon,
} from "react-native-heroicons/outline";
import { FireIcon } from "react-native-heroicons/solid";
import type { ActivityType } from "@/components/icons/ActivityIcons";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STREAK_BANNER_STORAGE_KEY = "fitchallenge_streak_banner_dismissed";

export default function HomeScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const { showToast } = useToast();

  // Consolidated data fetching
  const {
    activeChallenges,
    startingSoonChallenges,
    pendingInvites,
    completedChallenges,
    displayActivities,
    displayName,
    currentStreak,
    unreadCount,
    isLoading,
    isRefreshing,
    handleRefresh,
    handleAcceptInvite,
    handleDeclineInvite,
    isRespondingToInvite,
  } = useHomeScreenData();

  // Challenge filtering
  const {
    activeFilter,
    currentFilterLabel,
    filteredChallenges,
    handleFilterChange,
    handleClearFilter,
  } = useChallengeFilters(activeChallenges);

  // UI-specific state
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Accordion state: only one challenge card expanded at a time
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Track if streak banner is dismissed (show badge in header)
  const [streakBannerDismissed, setStreakBannerDismissed] = useState(false);

  // Biometric setup modal state (shown after sign-in if eligible)
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Check if streak banner was dismissed today on mount
  useEffect(() => {
    const checkStreakBannerDismissed = async () => {
      try {
        const dismissedDate = await AsyncStorage.getItem(
          STREAK_BANNER_STORAGE_KEY,
        );
        const today = new Date().toDateString();
        if (dismissedDate === today) {
          setStreakBannerDismissed(true);
        }
      } catch (error) {
        console.error("Error checking streak banner state:", error);
      }
    };
    checkStreakBannerDismissed();
  }, []);

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

  const handleStreakDismiss = async () => {
    setStreakBannerDismissed(true);

    // Persist dismissal for today
    const today = new Date().toDateString();
    try {
      await AsyncStorage.setItem(STREAK_BANNER_STORAGE_KEY, today);
    } catch (error) {
      console.error("Error saving streak banner state:", error);
    }

    // Show undo toast
    showToast("Streak moved to Profile", {
      actionLabel: "Undo",
      onAction: async () => {
        setStreakBannerDismissed(false);
        try {
          await AsyncStorage.removeItem(STREAK_BANNER_STORAGE_KEY);
        } catch (error) {
          console.error("Error clearing streak banner state:", error);
        }
      },
    });
  };

  // Toggle challenge card expansion (accordion - only one at a time)
  const handleToggleCardExpand = useCallback((challengeId: string) => {
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
    setExpandedCardId((prevId) =>
      prevId === challengeId ? null : challengeId,
    );
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <LoadingState variant="full-screen" />
      </SafeAreaView>
    );
  }

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
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* ================================================================ */}
        {/* HEADER - "Welcome, {name}" + streak badge (when dismissed) + bell */}
        {/* ================================================================ */}
        <View style={styles.header}>
          <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>
            Welcome, {displayName}
          </Text>

          <View style={styles.headerRight}>
            {/* Streak badge - shown when banner is dismissed */}
            {streakBannerDismissed && currentStreak > 0 && (
              <View
                style={[
                  styles.streakBadge,
                  { backgroundColor: "rgba(255, 150, 50, 0.15)" },
                ]}
              >
                <FireIcon size={14} color="#FF9632" />
                <Text style={styles.streakBadgeText}>{currentStreak}</Text>
              </View>
            )}

            {/* Notification bell */}
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push("/notifications")}
            >
              <BellIcon size={20} color={colors.textSecondary} />
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
        </View>

        {/* ================================================================ */}
        {/* STREAK BANNER - Swipe to dismiss */}
        {/* ================================================================ */}
        {!streakBannerDismissed && currentStreak > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <StreakBanner
              streak={currentStreak}
              onDismiss={handleStreakDismiss}
            />
          </View>
        )}

        {/* ================================================================ */}
        {/* PENDING INVITES */}
        {/* ================================================================ */}
        {pendingInvites && pendingInvites.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <View style={styles.sectionHeaderSimple}>
              <Text
                style={[
                  styles.sectionTitleUppercase,
                  { color: colors.textSecondary },
                ]}
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
                  onAccept={() => handleAcceptInvite(invite.challenge.id)}
                  onDecline={() => handleDeclineInvite(invite.challenge.id)}
                  loading={isRespondingToInvite}
                />
              ))}
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* IN PROGRESS - Active challenges with expandable cards */}
        {/* ================================================================ */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <SectionHeader
            title="In Progress"
            count={activeChallenges?.length || 0}
            variant="primary"
          >
            <ChallengeFilter
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />
          </SectionHeader>

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
                : filteredChallenges.slice(0, 5)
              ).map((challenge) => (
                <ExpandableChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  isExpanded={expandedCardId === challenge.id}
                  onToggleExpand={() => handleToggleCardExpand(challenge.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* ================================================================ */}
        {/* STARTING SOON - Amber themed cards */}
        {/* ================================================================ */}
        {startingSoonChallenges && startingSoonChallenges.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <SectionHeader
              title="Starting Soon"
              count={startingSoonChallenges.length}
              variant="warning"
            />
            <View style={{ gap: spacing.sm }}>
              {startingSoonChallenges.map((challenge) => (
                <StartingSoonCard key={challenge.id} challenge={challenge} />
              ))}
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* RECENT ACTIVITY */}
        {/* ================================================================ */}
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
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                },
              ]}
            >
              {displayActivities.map((activity, index) => (
                <ActivityRow
                  key={activity.id}
                  id={activity.id}
                  type={activity.activity_type as ActivityType}
                  name={activity.name}
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

        {/* ================================================================ */}
        {/* COMPLETED - Simple collapsible text header */}
        {/* ================================================================ */}
        {completedChallenges && completedChallenges.length > 0 && (
          <View style={[styles.section, { marginTop: spacing.xl }]}>
            <TouchableOpacity
              style={[styles.completedHeader, { paddingVertical: spacing.sm }]}
              onPress={toggleCompleted}
              activeOpacity={0.7}
            >
              <View style={styles.completedHeaderLeft}>
                <Text
                  style={[
                    styles.completedTitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Completed
                </Text>
                <View
                  style={[
                    styles.completedCountBadge,
                    { backgroundColor: `${colors.textMuted}15` },
                  ]}
                >
                  <Text
                    style={[
                      styles.completedCountText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {completedChallenges.length}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.chevronText,
                  {
                    color: colors.textMuted,
                    transform: [
                      { rotate: completedExpanded ? "180deg" : "0deg" },
                    ],
                  },
                ]}
              >
                ▼
              </Text>
            </TouchableOpacity>

            {completedExpanded && (
              <View
                style={[
                  styles.completedContent,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.sm,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {completedChallenges.slice(0, 5).map((challenge) => (
                  <TouchableOpacity
                    key={challenge.id}
                    style={styles.completedRow}
                    onPress={() => router.push(`/challenge/${challenge.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.completedRowLeft}>
                      <Text style={{ fontSize: 14 }}>
                        {challenge.my_rank === 1 ? "🏆" : "✓"}
                      </Text>
                      <Text
                        style={[
                          styles.completedRowTitle,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {challenge.title}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.completedRowRank,
                        { color: colors.textMuted },
                      ]}
                    >
                      #{challenge.my_rank || "-"}
                    </Text>
                  </TouchableOpacity>
                ))}
                {completedChallenges.length > 5 && (
                  <TouchableOpacity
                    style={[styles.viewAllCompleted, { marginTop: spacing.sm }]}
                    onPress={() => router.push("/(tabs)/challenges")}
                  >
                    <Text
                      style={[
                        styles.viewAllCompletedText,
                        { color: colors.primary.main },
                      ]}
                    >
                      View All Completed →
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
  // Header styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakBadgeText: {
    color: "#FF9632",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  // Section styles
  section: {},
  sectionHeaderSimple: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleUppercase: {
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
  // Completed section styles
  completedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completedHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completedTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  completedCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  completedCountText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  chevronText: {
    fontSize: 14,
  },
  completedContent: {},
  completedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  completedRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  completedRowTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    flex: 1,
  },
  completedRowRank: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  viewAllCompleted: {
    alignItems: "center",
    paddingVertical: 8,
  },
  viewAllCompletedText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
