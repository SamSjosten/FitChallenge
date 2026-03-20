// src/components/home/HeroStatCard.tsx
// Featured challenge hero card with animated progress ring, counting stat, and inline leaderboard
//
// Promoted from activeChallenges[0] (ending soonest). Shows:
// - Large SVG progress ring with animated fill
// - Counting stat animation (0 → current_progress over 2s)
// - Challenge meta (days left, participant count, remaining goal)
// - Inline top-3 leaderboard with today_change deltas
// - Trophy icon wiggle animation
//
// Data: Uses useLeaderboard() hook internally (same pattern as ExpandableChallengeCard)
// Animations: react-native-reanimated (ring, counter, trophy wiggle)
// SVG: react-native-svg (progress ring)

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { router } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useChallenges";
import { getDaysRemaining } from "@/lib/serverTime";
import { TrophyIcon } from "react-native-heroicons/solid";
import type { ChallengeWithParticipation, LeaderboardEntry } from "@/services/challenges";

// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ============================================================================
// CONFIGURATION
// ============================================================================

const RING_SIZE = 112;
const RING_VIEWBOX = 120;
const RING_RADIUS = 54;
const RING_STROKE_WIDTH = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const LEADERBOARD_PREVIEW_LIMIT = 3;

const COUNTER_DURATION_MS = 2000;
const RING_FILL_DURATION_MS = 1500;
const RING_FILL_DELAY_MS = 300;

// ============================================================================
// TYPES
// ============================================================================

export interface HeroStatCardProps {
  challenge: ChallengeWithParticipation;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Animated number counter using reanimated shared values (UI thread, zero JS overhead).
 *
 * Mount behavior: animates from 0 → end over COUNTER_DURATION_MS with ease-out.
 * Update behavior: snaps to new value instantly (no re-animation from 0).
 *
 * Uses useAnimatedReaction to bridge UI thread → JS thread for text updates.
 * Only fires when Math.floor changes (~end distinct values vs 120 rAF calls).
 */
function AnimatedCounter({
  end,
  duration = COUNTER_DURATION_MS,
  color,
}: {
  end: number;
  duration?: number;
  color: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const isFirstMount = React.useRef(true);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    if (isFirstMount.current) {
      // First mount: animate from 0 → end, synced with ring fill delay
      isFirstMount.current = false;
      animatedValue.value = 0;
      animatedValue.value = withDelay(
        RING_FILL_DELAY_MS,
        withTiming(end, {
          duration,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      // Subsequent updates (e.g. refetch after logging activity): snap immediately
      animatedValue.value = end;
      setDisplayValue(end);
    }
  }, [end, duration]);

  // Bridge UI thread → JS thread: update display when integer value changes
  useAnimatedReaction(
    () => Math.floor(animatedValue.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current);
      }
    },
  );

  return <Text style={[styles.counterValue, { color }]}>{displayValue.toLocaleString()}</Text>;
}

/**
 * Trophy icon with periodic wiggle animation.
 * Rotate [0, -10, 10, -10, 0] over 2s, then pause 3s, repeat.
 */
function AnimatedTrophy({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(10, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(-10, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withDelay(3000, withTiming(0, { duration: 0 })),
      ),
      -1, // infinite
      false,
    );

    return () => {
      rotation.value = 0;
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TrophyIcon size={14} color={color} />
    </Animated.View>
  );
}

/**
 * Leaderboard row for the inline preview.
 */
function LeaderboardRow({
  entry,
  index,
  isCurrentUser,
  colors,
}: {
  entry: LeaderboardEntry;
  index: number;
  isCurrentUser: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const positionColors = ["#F59E0B", "#9CA3AF", "#CD7F32"]; // gold, silver, bronze
  const displayName = isCurrentUser ? "You" : entry.profile.display_name || entry.profile.username;

  // Generate initials from display_name or username
  const fullName = entry.profile.display_name || entry.profile.username;
  const initials = fullName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={[
        styles.leaderboardRow,
        {
          backgroundColor: isCurrentUser ? `${colors.primary.main}08` : "transparent",
          borderRadius: 10,
        },
      ]}
    >
      {/* Position number */}
      <Text style={[styles.positionText, { color: positionColors[index] || colors.textMuted }]}>
        {entry.rank}
      </Text>

      {/* Avatar initials */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: isCurrentUser ? colors.primary.subtle : `${colors.textMuted}20`,
          },
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            {
              color: isCurrentUser ? colors.primary.dark : colors.textSecondary,
            },
          ]}
        >
          {initials}
        </Text>
      </View>

      {/* Name */}
      <Text
        style={[
          styles.leaderboardName,
          {
            color: colors.textPrimary,
            fontFamily: isCurrentUser ? "PlusJakartaSans_700Bold" : "PlusJakartaSans_500Medium",
          },
        ]}
        numberOfLines={1}
      >
        {displayName}
      </Text>

      {/* Score + delta */}
      <View style={styles.scoreContainer}>
        <Text style={[styles.scoreText, { color: colors.textPrimary }]}>
          {entry.current_progress.toLocaleString()}
        </Text>
        {entry.today_change > 0 && (
          <Text style={[styles.deltaText, { color: colors.primary.main }]}>
            +{entry.today_change.toLocaleString()}
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HeroStatCard({ challenge }: HeroStatCardProps) {
  const { colors, spacing, radius } = useAppTheme();
  const { user } = useAuth();
  const currentUserId = user?.id;

  // Fetch leaderboard eagerly (not gated by expand like ExpandableChallengeCard)
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(challenge.id, {
    limit: LEADERBOARD_PREVIEW_LIMIT,
  });

  // Derived values
  const progress = challenge.my_participation?.current_progress || 0;
  const goal = challenge.goal_value;
  const progressPercent = Math.min((progress / goal) * 100, 100);
  const daysLeft = getDaysRemaining(challenge.end_date);
  const remaining = Math.max(goal - progress, 0);
  const participantCount = challenge.participant_count || 1;
  const isSolo = challenge.is_solo || participantCount <= 1;

  // Show leaderboard only for non-solo challenges with data
  const showLeaderboard = !isSolo && leaderboard && leaderboard.length > 1;

  // Progress ring animation
  const targetOffset = RING_CIRCUMFERENCE - (progressPercent / 100) * RING_CIRCUMFERENCE;
  const animatedOffset = useSharedValue(RING_CIRCUMFERENCE);

  useEffect(() => {
    animatedOffset.value = withDelay(
      RING_FILL_DELAY_MS,
      withTiming(targetOffset, {
        duration: RING_FILL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [targetOffset]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedOffset.value,
  }));

  // Navigation
  const handlePress = useCallback(() => {
    router.push(`/challenge/${challenge.id}`);
  }, [challenge.id]);

  const handleViewAll = useCallback(() => {
    router.push(`/challenge/${challenge.id}?tab=leaderboard`);
  }, [challenge.id]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`View ${challenge.title} details`}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius["2xl"],
          borderWidth: 2,
          borderColor: colors.primary.main,
        },
      ]}
    >
      {/* Main content: ring + info */}
      <View style={[styles.mainRow, { padding: spacing.lg + 4 }]}>
        {/* Progress ring */}
        <View style={styles.ringContainer}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            <Defs>
              <LinearGradient id="heroProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={colors.primary.main} />
                <Stop offset="100%" stopColor={colors.primary.dark} />
              </LinearGradient>
            </Defs>

            {/* Background track */}
            <Circle
              cx={RING_VIEWBOX / 2}
              cy={RING_VIEWBOX / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={colors.border}
              strokeWidth={RING_STROKE_WIDTH}
            />

            {/* Animated progress arc */}
            <AnimatedCircle
              cx={RING_VIEWBOX / 2}
              cy={RING_VIEWBOX / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="url(#heroProgressGrad)"
              strokeWidth={RING_STROKE_WIDTH}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeLinecap="round"
              animatedProps={animatedCircleProps}
            />
          </Svg>

          {/* Center text overlay */}
          <View style={styles.ringCenter}>
            <AnimatedCounter end={progress} color={colors.textPrimary} />
            <Text style={[styles.counterSubtext, { color: colors.textMuted }]}>
              of {goal.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Challenge info */}
        <View style={styles.infoContainer}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.primary.subtle,
                borderRadius: radius.full,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.primary.dark }]}>Active Challenge</Text>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {challenge.title}
          </Text>

          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left · {participantCount} participant
            {participantCount !== 1 ? "s" : ""}
          </Text>

          <View
            style={[
              styles.remainingBanner,
              {
                backgroundColor: colors.primary.subtle,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Text style={[styles.remainingText, { color: colors.primary.dark }]}>
              {remaining.toLocaleString()} {challenge.goal_unit} to go
            </Text>
          </View>
        </View>
      </View>

      {/* ================================================================== */}
      {/* INLINE LEADERBOARD — only for non-solo with 2+ participants       */}
      {/* ================================================================== */}
      {showLeaderboard && (
        <View
          style={[
            styles.leaderboardSection,
            {
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: spacing.lg + 4,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
            },
          ]}
        >
          {/* Leaderboard header */}
          <View style={styles.leaderboardHeader}>
            <View style={styles.leaderboardHeaderLeft}>
              <AnimatedTrophy color="#F59E0B" />
              <Text style={[styles.leaderboardTitle, { color: colors.textPrimary }]}>
                Leaderboard
              </Text>
            </View>
            <TouchableOpacity onPress={handleViewAll} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="View full leaderboard">
              <Text style={[styles.viewAllText, { color: colors.primary.main }]}>View All →</Text>
            </TouchableOpacity>
          </View>

          {/* Leaderboard rows */}
          {leaderboard.map((entry, i) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              index={i}
              isCurrentUser={entry.user_id === currentUserId}
              colors={colors}
            />
          ))}
        </View>
      )}

      {/* Loading state for leaderboard */}
      {!isSolo && isLeaderboardLoading && (
        <View
          style={[
            styles.leaderboardSection,
            {
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: spacing.lg + 4,
              paddingVertical: spacing.md,
            },
          ]}
        >
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.skeletonRow,
                {
                  backgroundColor: `${colors.textMuted}15`,
                  borderRadius: radius.sm,
                },
              ]}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },

  // Main row: ring + info
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  ringContainer: {
    position: "relative",
    width: RING_SIZE,
    height: RING_SIZE,
    flexShrink: 0,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    fontSize: 22,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  counterSubtext: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
  },

  // Challenge info
  infoContainer: {
    flex: 1,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
    marginTop: 8,
  },
  meta: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 4,
  },
  remainingBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  remainingText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // Leaderboard section
  leaderboardSection: {},
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  leaderboardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leaderboardTitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  viewAllText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // Leaderboard rows
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  positionText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    width: 18,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  leaderboardName: {
    flex: 1,
    fontSize: 13,
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  deltaText: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // Loading skeleton
  skeletonRow: {
    height: 32,
    marginBottom: 4,
    opacity: 0.5,
  },
});
