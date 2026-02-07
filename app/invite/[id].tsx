// app/invite/[id].tsx
// Invite Detail Screen - Full challenge invite view
// Design System v2.0

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@/providers/ThemeProvider";
import { usePendingInvites, useRespondToInvite } from "@/hooks/useChallenges";
import { LoadingState } from "@/components/shared";
import {
  ChevronLeftIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  TrophyIcon,
  FlagIcon,
  ShareIcon,
  FireIcon,
} from "react-native-heroicons/outline";
import { pushTokenService } from "@/services/pushTokens";

// Activity type colors for the hero gradient
const challengeTypeColors: Record<
  string,
  { primary: string; secondary: string }
> = {
  steps: { primary: "#3B82F6", secondary: "#DBEAFE" },
  workouts: { primary: "#8B5CF6", secondary: "#EDE9FE" },
  distance: { primary: "#0D9488", secondary: "#CCFBF1" },
  active_minutes: { primary: "#F97316", secondary: "#FFEDD5" },
  custom: { primary: "#6B7280", secondary: "#F3F4F6" },
};

export default function InviteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useAppTheme();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const { data: pendingInvites, isLoading } = usePendingInvites();
  const respondToInvite = useRespondToInvite();

  // Find the invite
  const invite = pendingInvites?.find((i) => i.challenge.id === id);
  const challenge = invite?.challenge;

  // Handlers
  const handleAccept = async () => {
    if (!challenge) return;

    setIsAccepting(true);
    try {
      await respondToInvite.mutateAsync({
        challenge_id: challenge.id,
        response: "accepted",
      });

      // Request push notification permission
      pushTokenService
        .requestAndRegister()
        .catch((err) => console.warn("Push notification setup failed:", err));

      // Navigate to challenge detail
      router.replace(`/challenge/${challenge.id}`);
    } catch (err) {
      console.error("Failed to accept invite:", err);
      Alert.alert("Error", "Failed to accept invite. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!challenge) return;

    Alert.alert(
      "Decline Invite",
      "Are you sure you want to decline this challenge invite?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setIsDeclining(true);
            try {
              await respondToInvite.mutateAsync({
                challenge_id: challenge.id,
                response: "declined",
              });
              router.back();
            } catch (err) {
              console.error("Failed to decline invite:", err);
              Alert.alert(
                "Error",
                "Failed to decline invite. Please try again.",
              );
            } finally {
              setIsDeclining(false);
            }
          },
        },
      ],
    );
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    Alert.alert("Share", "Share functionality coming soon!");
  };

  // Format helpers
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntilStart = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diff = Math.ceil(
      (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff <= 0) return "Starting soon";
    if (diff === 1) return "Starts tomorrow";
    return `Starts in ${diff} days`;
  };

  const getDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days === 1) return "1 day";
    if (days === 7) return "1 week";
    if (days === 14) return "2 weeks";
    if (days === 30 || days === 31) return "1 month";
    return `${days} days`;
  };

  const getWinConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      highest_total: "Highest total wins",
      first_to_goal: "First to reach goal wins",
      longest_streak: "Longest streak wins",
      all_complete: "Everyone who completes wins",
    };
    return labels[condition] || condition;
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState variant="full-screen" />
      </SafeAreaView>
    );
  }

  // Not found
  if (!invite || !challenge) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Invite not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backToHomeButton,
              { backgroundColor: colors.primary.main, borderRadius: radius.lg },
            ]}
          >
            <Text style={styles.backToHomeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const typeColors =
    challengeTypeColors[challenge.challenge_type] || challengeTypeColors.custom;
  const creatorName =
    invite.creator?.display_name || invite.creator?.username || "Someone";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <LinearGradient
          colors={[typeColors.primary, typeColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.heroBackButton}
          >
            <ChevronLeftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            onPress={handleShare}
            style={styles.heroShareButton}
          >
            <ShareIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.heroIconContainer}>
            <FireIcon size={48} color="#FFFFFF" />
          </View>

          {/* Title */}
          <Text style={styles.heroTitle}>{challenge.title}</Text>
          <Text style={styles.heroSubtitle}>from @{creatorName}</Text>

          {/* Start info */}
          <View style={styles.heroStartBadge}>
            <Text style={styles.heroStartText}>
              {getDaysUntilStart(challenge.start_date)}
            </Text>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={[styles.content, { padding: spacing.lg }]}>
          {/* Description */}
          {challenge.description && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.description, { color: colors.textPrimary }]}>
                {challenge.description}
              </Text>
            </View>
          )}

          {/* Details card */}
          <View
            style={[
              styles.detailsCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
              },
            ]}
          >
            {/* Goal */}
            <View style={[styles.detailRow, { padding: spacing.md }]}>
              <View
                style={[
                  styles.detailIcon,
                  {
                    backgroundColor: typeColors.secondary,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <FlagIcon size={18} color={typeColors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  Goal
                </Text>
                <Text
                  style={[styles.detailValue, { color: colors.textPrimary }]}
                >
                  {challenge.goal_value.toLocaleString()} {challenge.goal_unit}
                </Text>
              </View>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* Duration */}
            <View style={[styles.detailRow, { padding: spacing.md }]}>
              <View
                style={[
                  styles.detailIcon,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <CalendarIcon size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.detailContent}>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  Duration
                </Text>
                <Text
                  style={[styles.detailValue, { color: colors.textPrimary }]}
                >
                  {getDuration(challenge.start_date, challenge.end_date)}
                </Text>
                <Text style={[styles.detailMeta, { color: colors.textMuted }]}>
                  {formatDate(challenge.start_date)} -{" "}
                  {formatDate(challenge.end_date)}
                </Text>
              </View>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* Win condition */}
            <View style={[styles.detailRow, { padding: spacing.md }]}>
              <View
                style={[
                  styles.detailIcon,
                  {
                    backgroundColor: colors.energy.subtle,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <TrophyIcon size={18} color={colors.energy.dark} />
              </View>
              <View style={styles.detailContent}>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  Win Condition
                </Text>
                <Text
                  style={[styles.detailValue, { color: colors.textPrimary }]}
                >
                  {getWinConditionLabel(challenge.win_condition)}
                </Text>
              </View>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* Participants */}
            <View style={[styles.detailRow, { padding: spacing.md }]}>
              <View
                style={[
                  styles.detailIcon,
                  {
                    backgroundColor: colors.primary.subtle,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <UserGroupIcon size={18} color={colors.primary.main} />
              </View>
              <View style={styles.detailContent}>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  Participants
                </Text>
                <Text
                  style={[styles.detailValue, { color: colors.textPrimary }]}
                >
                  Waiting for you to join
                </Text>
              </View>
            </View>
          </View>

          {/* XP reward */}
          {challenge.xp_reward && challenge.xp_reward > 0 && (
            <View
              style={[
                styles.xpBadge,
                {
                  backgroundColor: colors.achievement.subtle,
                  borderRadius: radius.lg,
                  marginTop: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <Text style={[styles.xpText, { color: colors.achievement.dark }]}>
                🏆 Complete this challenge to earn {challenge.xp_reward} XP
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action buttons */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            padding: spacing.lg,
            paddingBottom: spacing.xl,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleDecline}
          disabled={isDeclining || isAccepting}
          style={[
            styles.declineButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              opacity: isDeclining || isAccepting ? 0.5 : 1,
            },
          ]}
        >
          {isDeclining ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text
              style={[
                styles.declineButtonText,
                { color: colors.textSecondary },
              ]}
            >
              Decline
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAccept}
          disabled={isAccepting || isDeclining}
          style={[
            styles.acceptButton,
            {
              backgroundColor: colors.primary.main,
              borderRadius: radius.lg,
              opacity: isAccepting || isDeclining ? 0.5 : 1,
            },
          ]}
        >
          {isAccepting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept Challenge</Text>
          )}
        </TouchableOpacity>
      </View>
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
  hero: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  heroBackButton: {
    position: "absolute",
    top: 12,
    left: 16,
    padding: 8,
  },
  heroShareButton: {
    position: "absolute",
    top: 12,
    right: 16,
    padding: 8,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  heroStartBadge: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  heroStartText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  content: {},
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailsCard: {
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  detailMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
  xpBadge: {},
  xpText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  bottomBar: {},
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    marginRight: 8,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    alignItems: "center",
    marginLeft: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  notFoundText: {
    fontSize: 16,
    marginBottom: 16,
  },
  backToHomeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backToHomeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
