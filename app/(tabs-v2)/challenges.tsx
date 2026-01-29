// app/(tabs-v2)/challenges.tsx
// V2 Challenges Screen - Full challenges list with tabs
// Design System v2.0 - Based on prototype
//
// Features:
// - Tab navigation (Active, Completed)
// - Pending invites section
// - Collapsible challenge cards
// - Empty states

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  useActiveChallenges,
  useCompletedChallenges,
  usePendingInvites,
  useRespondToInvite,
} from "@/hooks/useChallenges";
import { syncServerTime } from "@/lib/serverTime";
import {
  LoadingState,
  EmptyState,
  ChallengeCard,
  CompletedChallengeRow,
  InviteRow,
} from "@/components/v2";
import { TestIDs } from "@/constants/testIDs";
import { TrophyIcon } from "react-native-heroicons/outline";

type TabType = "active" | "completed";

export default function ChallengesScreenV2() {
  const { colors, spacing, radius } = useAppTheme();
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [refreshing, setRefreshing] = useState(false);

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

  const respondToInvite = useRespondToInvite();

  // Auto-refresh on focus
  useFocusEffect(
    useCallback(() => {
      // Sync server time for accurate challenge status
      syncServerTime().catch(() => {});
      refetchActive();
      refetchCompleted();
      refetchPending();
    }, [refetchActive, refetchCompleted, refetchPending]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchActive(), refetchCompleted(), refetchPending()]);
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

  // Loading state
  if (loadingActive && loadingCompleted) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View
          style={[styles.headerContainer, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Challenges
          </Text>
        </View>
        <LoadingState variant="content" message="Loading challenges..." />
      </SafeAreaView>
    );
  }

  const activeCount = activeChallenges?.length || 0;
  const completedCount = completedChallenges?.length || 0;
  const pendingCount = pendingInvites?.length || 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
      testID={TestIDs.screensV2?.challenges || "challenges-screen-v2"}
    >
      {/* Header */}
      <View
        style={[styles.headerContainer, { backgroundColor: colors.surface }]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Challenges
        </Text>
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "active" && {
              borderBottomWidth: 2,
              borderBottomColor: colors.primary.main,
            },
          ]}
          onPress={() => setActiveTab("active")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "active"
                    ? colors.primary.main
                    : colors.textMuted,
              },
            ]}
          >
            Active ({activeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "completed" && {
              borderBottomWidth: 2,
              borderBottomColor: colors.primary.main,
            },
          ]}
          onPress={() => setActiveTab("completed")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "completed"
                    ? colors.primary.main
                    : colors.textMuted,
              },
            ]}
          >
            Completed ({completedCount})
          </Text>
        </TouchableOpacity>
      </View>

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
        {/* Pending Invites (only on Active tab) */}
        {activeTab === "active" && pendingCount > 0 && (
          <View style={[styles.section, { marginBottom: spacing.xl }]}>
            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                PENDING INVITES ({pendingCount})
              </Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              {pendingInvites?.map((invite) => (
                <InviteRow
                  key={invite.challenge.id}
                  invite={invite}
                  onPress={() =>
                    router.push(`/challenge/${invite.challenge.id}`)
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Active Challenges Tab */}
        {activeTab === "active" && (
          <>
            {activeCount === 0 ? (
              <EmptyState
                variant="challenges"
                actionLabel="Create Challenge"
                onAction={() => router.push("/challenge/create")}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {activeChallenges?.map((challenge, index) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    defaultExpanded={index === 0}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Completed Challenges Tab */}
        {activeTab === "completed" && (
          <>
            {completedCount === 0 ? (
              <EmptyState
                variant="generic"
                title="No Completed Challenges"
                message="Completed challenges will appear here after they end."
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {completedChallenges?.map((challenge) => (
                  <CompletedChallengeRow
                    key={challenge.id}
                    challenge={challenge}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Bottom spacing for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
  },
  tabText: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {},
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    letterSpacing: 0.5,
  },
});
