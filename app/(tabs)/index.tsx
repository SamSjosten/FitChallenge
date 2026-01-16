// app/(tabs)/index.tsx
// Home/Dashboard screen - Redesigned with competition focus
// Shows: Streak Banner, Pending Invites, Active Challenges (expanded + collapsed), Completed

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
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
  CheckIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import { FireIcon as FireIconSolid } from "react-native-heroicons/solid";
import type { ChallengeWithParticipation } from "@/services/challenges";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate days remaining until end_date
 */
function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Get rank display text (e.g., "1st", "2nd", "3rd", "4th")
 */
function getRankText(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

/**
 * Get medal emoji for rank (only for 1st, 2nd, 3rd)
 */
function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

/**
 * Format end date for completed challenges (e.g., "Jan 10")
 */
function formatEndDate(endDate: string): string {
  const date = new Date(endDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function HomeScreen() {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { profile } = useAuth();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(
    null
  );

  // Enable LayoutAnimation on Android (one-time setup)
  React.useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Toggle accordion expansion - only one can be expanded at a time
  const toggleAccordion = (challengeId: string) => {
    // Animate the layout change
    LayoutAnimation.configureNext({
      duration: 250,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setExpandedChallengeId((prev) =>
      prev === challengeId ? null : challengeId
    );
  };

  // Toggle completed section with animation
  const toggleCompleted = () => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setCompletedExpanded(!completedExpanded);
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

  const respondToInvite = useRespondToInvite();

  // Auto-expand first challenge when data loads
  React.useEffect(() => {
    if (activeChallenges?.length && expandedChallengeId === null) {
      setExpandedChallengeId(activeChallenges[0].id);
    }
  }, [activeChallenges]);

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
  const displayName = profile?.display_name || profile?.username || "Athlete";

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

      {/* ===== ACTIVE CHALLENGES ===== */}
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
            Active Challenges
          </Text>
          {activeChallenges && activeChallenges.length > 0 && (
            <Badge variant="primary" size="small">
              {activeChallenges.length}
            </Badge>
          )}
        </View>

        {!activeChallenges || activeChallenges.length === 0 ? (
          // Empty state
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
          <>
            {/* All Challenges as Accordions (only one expanded at a time) */}
            {activeChallenges.map((challenge) => (
              <AccordionChallengeCard
                key={challenge.id}
                challenge={challenge}
                isExpanded={expandedChallengeId === challenge.id}
                onToggle={() => toggleAccordion(challenge.id)}
                colors={colors}
                spacing={spacing}
                radius={radius}
                typography={typography}
              />
            ))}
          </>
        )}

        {/* ===== COMPLETED SECTION (Collapsible) ===== */}
        {completedChallenges && completedChallenges.length > 0 && (
          <View
            style={{
              marginTop: spacing.lg,
              paddingTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {/* Toggle Header */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: spacing.xs,
              }}
              onPress={toggleCompleted}
              activeOpacity={0.7}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.textStyles.label.fontSize,
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    color: colors.achievement.main,
                  }}
                >
                  View Completed
                </Text>
                <Badge variant="achievement" size="small">
                  {completedChallenges.length}
                </Badge>
              </View>
              <Text
                style={{
                  fontSize: 16,
                  color: colors.achievement.main,
                  transform: [{ rotate: completedExpanded ? "90deg" : "0deg" }],
                }}
              >
                ›
              </Text>
            </TouchableOpacity>

            {/* Expanded Content */}
            {completedExpanded && (
              <View style={{ marginTop: spacing.md }}>
                {completedChallenges.map((challenge) => (
                  <CompletedChallengeRow
                    key={challenge.id}
                    challenge={challenge}
                    colors={colors}
                    spacing={spacing}
                    radius={radius}
                    typography={typography}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScreenSection>
    </ScreenContainer>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ChallengeCardProps {
  challenge: ChallengeWithParticipation;
  colors: ReturnType<typeof useAppTheme>["colors"];
  spacing: ReturnType<typeof useAppTheme>["spacing"];
  radius: ReturnType<typeof useAppTheme>["radius"];
  typography: ReturnType<typeof useAppTheme>["typography"];
}

/**
 * Accordion challenge card (all active challenges)
 * Collapsed: title, meta, text rank, chevron
 * Expanded: rank badge, progress bar, View Challenge button
 * Only one can be expanded at a time
 */
interface AccordionChallengeCardProps extends ChallengeCardProps {
  isExpanded: boolean;
  onToggle: () => void;
}

function AccordionChallengeCard({
  challenge,
  isExpanded,
  onToggle,
  colors,
  spacing,
  radius,
  typography,
}: AccordionChallengeCardProps) {
  const daysLeft = getDaysRemaining(challenge.end_date);
  const friendCount = Math.max(0, (challenge.participant_count || 1) - 1);
  const rank = challenge.my_rank || 1;
  const progress = challenge.my_participation?.current_progress || 0;
  const progressPercent = (progress / challenge.goal_value) * 100;

  // Rank colors for text display
  const rankTextColor =
    rank === 1
      ? "#fbbf24" // gold text
      : rank === 2
      ? "#9ca3af" // silver text
      : rank === 3
      ? "#cd7c2f" // bronze text
      : colors.primary.main;

  // Rank colors for badge background
  const rankBadgeColor =
    rank === 1
      ? "#d97706"
      : rank === 2
      ? "#6b7280"
      : rank === 3
      ? "#a85d1e"
      : colors.primary.main;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderWidth: isExpanded ? 1.5 : 1,
        borderColor: isExpanded ? colors.primary.main : colors.border,
        marginBottom: spacing.sm,
        overflow: "hidden",
      }}
    >
      {/* Accordion Header (always visible) */}
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
        }}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text
            style={{
              fontSize: typography.textStyles.body.fontSize,
              fontFamily: "PlusJakartaSans_600SemiBold",
              color: colors.textPrimary,
              marginBottom: 2,
            }}
          >
            {challenge.title}
          </Text>
          <Text
            style={{
              fontSize: typography.textStyles.caption.fontSize - 1,
              fontFamily: "PlusJakartaSans_500Medium",
              color: colors.textMuted,
            }}
          >
            {friendCount > 0
              ? `vs ${friendCount} friend${friendCount > 1 ? "s" : ""}`
              : "Solo"}{" "}
            • {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
          </Text>
        </View>

        {/* Text Rank */}
        <Text
          style={{
            fontSize: typography.textStyles.caption.fontSize,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: rankTextColor,
            marginRight: spacing.sm,
          }}
        >
          {getRankText(rank)}
        </Text>

        {/* Chevron (rotates when expanded) */}
        <Text
          style={{
            fontSize: 16,
            color: colors.textMuted,
            transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
          }}
        >
          ›
        </Text>
      </TouchableOpacity>

      {/* Accordion Content (visible when expanded) */}
      {isExpanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: spacing.md,
          }}
        >
          {/* Rank Badge with Medal */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: rankBadgeColor,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.badge,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              {rank <= 3 && (
                <Text style={{ fontSize: 12 }}>{getRankMedal(rank)}</Text>
              )}
              <Text
                style={{
                  fontSize: typography.textStyles.caption.fontSize,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: "white",
                }}
              >
                {getRankText(rank)}
              </Text>
            </View>
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
                {progress.toLocaleString()} /{" "}
                {challenge.goal_value.toLocaleString()}
              </Text>
            </View>
            <ProgressBar
              progress={progressPercent}
              variant="primary"
              size="large"
            />
          </View>

          {/* View Challenge Button */}
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
            onPress={() => router.push(`/challenge/${challenge.id}`)}
          >
            <Text style={{ fontSize: 14, color: "white" }}>›</Text>
            <Text
              style={{
                fontSize: typography.textStyles.label.fontSize,
                fontFamily: "PlusJakartaSans_600SemiBold",
                color: "white",
              }}
            >
              View Challenge
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Completed challenge row (for expanded completed section)
 * Shows: medal, title, end date + friend count, final rank
 */
function CompletedChallengeRow({
  challenge,
  colors,
  spacing,
  radius,
  typography,
}: ChallengeCardProps) {
  const friendCount = Math.max(0, (challenge.participant_count || 1) - 1);
  const rank = challenge.my_rank || 1;
  const endDateStr = formatEndDate(challenge.end_date);

  // Rank color
  const rankColor =
    rank === 1
      ? "#fbbf24"
      : rank === 2
      ? "#9ca3af"
      : rank === 3
      ? "#cd7c2f"
      : colors.achievement.main;

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
      }}
      onPress={() => router.push(`/challenge/${challenge.id}`)}
      activeOpacity={0.7}
    >
      {/* Medal or rank number */}
      <Text
        style={{
          fontSize: 16,
          marginRight: spacing.md,
          width: 24,
          textAlign: "center",
        }}
      >
        {rank <= 3 ? getRankMedal(rank) : rank}
      </Text>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typography.textStyles.label.fontSize,
            fontFamily: "PlusJakartaSans_600SemiBold",
            color: colors.textPrimary,
            marginBottom: 2,
          }}
        >
          {challenge.title}
        </Text>
        <Text
          style={{
            fontSize: typography.textStyles.caption.fontSize - 1,
            fontFamily: "PlusJakartaSans_500Medium",
            color: colors.textMuted,
          }}
        >
          Ended {endDateStr} •{" "}
          {friendCount > 0
            ? `${friendCount} friend${friendCount > 1 ? "s" : ""}`
            : "Solo"}
        </Text>
      </View>

      {/* Final rank */}
      <Text
        style={{
          fontSize: typography.textStyles.caption.fontSize,
          fontFamily: "PlusJakartaSans_600SemiBold",
          color: rankColor,
          marginRight: spacing.sm,
        }}
      >
        {getRankText(rank)}
      </Text>

      <Text style={{ fontSize: 14, color: colors.textMuted }}>›</Text>
    </TouchableOpacity>
  );
}
