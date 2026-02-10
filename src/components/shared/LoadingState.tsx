// src/components/shared/LoadingState.tsx
// Skeleton loading states
//
// Variants:
// - full-screen: Centered spinner with optional message
// - inline: Small spinner for inline loading
// - card: Skeleton card placeholder
// - list: Multiple skeleton rows
// - challenge-card: Challenge card skeleton
// - leaderboard: Leaderboard skeleton

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, ActivityIndicator, ViewStyle } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";

// =============================================================================
// TYPES
// =============================================================================

export type LoadingVariant =
  | "full-screen"
  | "inline"
  | "card"
  | "list"
  | "challenge-card"
  | "leaderboard"
  | "content";

export interface LoadingStateProps {
  variant?: LoadingVariant;
  count?: number;
  style?: ViewStyle;
  testID?: string;
  message?: string;
}

// =============================================================================
// SHIMMER ANIMATION HOOK
// =============================================================================

function useShimmer() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  return shimmerAnim;
}

// =============================================================================
// SKELETON BOX COMPONENT
// =============================================================================

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({
  width = "100%" as `${number}%`,
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonBoxProps) {
  const { colors } = useAppTheme();
  const shimmerAnim = useShimmer();

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// =============================================================================
// SKELETON VARIANTS
// =============================================================================

function FullScreenLoading({ testID }: { testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.fullScreen} testID={testID}>
      <ActivityIndicator size="large" color={colors.primary.main} />
    </View>
  );
}

function InlineLoading({ testID }: { testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.inline} testID={testID}>
      <ActivityIndicator size="small" color={colors.primary.main} />
    </View>
  );
}

function ContentLoading({ testID, message }: { testID?: string; message?: string }) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={styles.content} testID={testID}>
      <ActivityIndicator size="large" color={colors.primary.main} />
      {message && (
        <Text
          style={{
            marginTop: spacing.md,
            color: colors.textSecondary,
            fontSize: 14,
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

function CardSkeleton({ testID }: { testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]} testID={testID}>
      <View style={styles.cardHeader}>
        <SkeletonBox width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <SkeletonBox width={"60%" as `${number}%`} height={16} />
          <SkeletonBox width={"40%" as `${number}%`} height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <SkeletonBox height={8} style={{ marginTop: 16 }} />
      <SkeletonBox width={"30%" as `${number}%`} height={12} style={{ marginTop: 8 }} />
    </View>
  );
}

function ListSkeleton({ count = 3, testID }: { count?: number; testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View testID={testID}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.listItem, { borderBottomColor: colors.border }]}>
          <SkeletonBox width={48} height={48} borderRadius={24} />
          <View style={styles.listItemContent}>
            <SkeletonBox width={"70%" as `${number}%`} height={16} />
            <SkeletonBox width={"50%" as `${number}%`} height={12} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ChallengeCardSkeleton({ testID }: { testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.challengeCard, { backgroundColor: colors.surface }]} testID={testID}>
      {/* Header */}
      <View style={styles.challengeHeader}>
        <SkeletonBox width={32} height={32} borderRadius={8} />
        <View style={styles.challengeHeaderText}>
          <SkeletonBox width={"60%" as `${number}%`} height={18} />
          <SkeletonBox width={"40%" as `${number}%`} height={14} style={{ marginTop: 6 }} />
        </View>
        <SkeletonBox width={48} height={24} borderRadius={12} />
      </View>

      {/* Progress */}
      <SkeletonBox height={8} borderRadius={4} style={{ marginTop: 16 }} />

      {/* Footer */}
      <View style={styles.challengeFooter}>
        <SkeletonBox width={"30%" as `${number}%`} height={12} />
        <SkeletonBox width={"25%" as `${number}%`} height={12} />
      </View>
    </View>
  );
}

function LeaderboardSkeleton({ count = 5, testID }: { count?: number; testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.leaderboard, { backgroundColor: colors.surface }]} testID={testID}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.leaderboardRow,
            index < count - 1 && {
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            },
          ]}
        >
          <SkeletonBox width={24} height={24} borderRadius={12} />
          <SkeletonBox width={40} height={40} borderRadius={20} style={{ marginLeft: 12 }} />
          <View style={styles.leaderboardContent}>
            <SkeletonBox width={"50%" as `${number}%`} height={14} />
            <SkeletonBox width={"30%" as `${number}%`} height={12} style={{ marginTop: 4 }} />
          </View>
          <SkeletonBox width={60} height={20} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LoadingState({
  variant = "full-screen",
  count = 3,
  style,
  testID = "loading-state",
  message,
}: LoadingStateProps) {
  const content = (() => {
    switch (variant) {
      case "full-screen":
        return <FullScreenLoading testID={testID} />;
      case "inline":
        return <InlineLoading testID={testID} />;
      case "content":
        return <ContentLoading testID={testID} message={message} />;
      case "card":
        return <CardSkeleton testID={testID} />;
      case "list":
        return <ListSkeleton count={count} testID={testID} />;
      case "challenge-card":
        return <ChallengeCardSkeleton testID={testID} />;
      case "leaderboard":
        return <LeaderboardSkeleton count={count} testID={testID} />;
      default:
        return <FullScreenLoading testID={testID} />;
    }
  })();

  if (variant === "full-screen" || variant === "content") {
    return content;
  }

  return <View style={style}>{content}</View>;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  inline: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  challengeCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  challengeHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  challengeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  leaderboard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  leaderboardContent: {
    flex: 1,
    marginLeft: 12,
  },
});

export default LoadingState;
