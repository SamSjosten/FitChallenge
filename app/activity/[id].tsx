// app/activity/[id].tsx
// Activity Detail Screen - View single activity/workout details
// Design System v2.0

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useChallengeActivities } from "@/hooks/useActivities";
import { LoadingState } from "@/components/v2";
import {
  ChevronLeftIcon,
  ClockIcon,
  CalendarIcon,
  TrophyIcon,
  FireIcon,
  MapPinIcon,
} from "react-native-heroicons/outline";
import { activityService } from "@/services/activities";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";

// Activity type colors
const activityColors: Record<string, { text: string; bg: string }> = {
  steps: { text: "#3B82F6", bg: "#DBEAFE" },
  walking: { text: "#10B981", bg: "#D1FAE5" },
  workouts: { text: "#8B5CF6", bg: "#EDE9FE" },
  workout_points: { text: "#8B5CF6", bg: "#EDE9FE" },
  strength: { text: "#8B5CF6", bg: "#EDE9FE" },
  distance: { text: "#0D9488", bg: "#CCFBF1" },
  running: { text: "#3B82F6", bg: "#DBEAFE" },
  active_minutes: { text: "#F97316", bg: "#FFEDD5" },
  yoga: { text: "#22C55E", bg: "#DCFCE7" },
  hiit: { text: "#F97316", bg: "#FFEDD5" },
  cycling: { text: "#06B6D4", bg: "#CFFAFE" },
  swimming: { text: "#0EA5E9", bg: "#E0F2FE" },
  custom: { text: "#6B7280", bg: "#F3F4F6" },
};

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useAppTheme();
  const { session } = useAuth();

  // Fetch activity by loading recent activities and finding the one we need
  // In a real app, you'd have a dedicated getActivityById endpoint
  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities", "detail", id],
    queryFn: () => activityService.getRecentActivities({ limit: 100 }),
    enabled: !!session?.user?.id && !!id,
  });

  const activity = useMemo(() => {
    if (!activities || !id) return null;
    return activities.find((a) => a.id === id);
  }, [activities, id]);

  // Format helpers
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "healthkit":
        return "Apple Health";
      case "googlefit":
        return "Google Fit";
      default:
        return "Manual Entry";
    }
  };

  const getActivityTypeName = (type: string) => {
    const names: Record<string, string> = {
      steps: "Steps",
      active_minutes: "Active Minutes",
      workouts: "Workout",
      workout_points: "Workout",
      distance: "Distance",
      strength: "Strength Training",
      running: "Running",
      yoga: "Yoga",
      hiit: "HIIT",
      cycling: "Cycling",
      walking: "Walking",
      swimming: "Swimming",
      custom: "Activity",
    };
    return names[type] || "Activity";
  };

  // Calculate points (simplified)
  const calculatePoints = (value: number, type: string) => {
    const multiplier: Record<string, number> = {
      steps: 0.01,
      active_minutes: 1,
      workouts: 10,
      workout_points: 1,
      distance: 5,
    };
    return Math.round(value * (multiplier[type] || 1));
  };

  // Loading state
  if (isLoading || !activity) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        {isLoading ? (
          <LoadingState variant="full-screen" />
        ) : (
          <View style={[styles.notFound, { padding: spacing.xl }]}>
            <Text
              style={[styles.notFoundText, { color: colors.textSecondary }]}
            >
              Activity not found
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: colors.primary.main,
                  borderRadius: radius.lg,
                  marginTop: spacing.lg,
                },
              ]}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const typeColors =
    activityColors[activity.activity_type] || activityColors.custom;
  const points = calculatePoints(activity.value, activity.activity_type);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackButton}
        >
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Activity Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main card */}
        <View
          style={[
            styles.mainCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.lg,
            },
          ]}
        >
          {/* Activity icon and type */}
          <View style={styles.typeRow}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: typeColors.bg,
                  borderRadius: radius.lg,
                },
              ]}
            >
              <FireIcon size={32} color={typeColors.text} />
            </View>
            <View style={styles.typeText}>
              <Text
                style={[styles.activityType, { color: colors.textPrimary }]}
              >
                {getActivityTypeName(activity.activity_type)}
              </Text>
              <Text
                style={[styles.sourceText, { color: colors.textSecondary }]}
              >
                via {getSourceLabel(activity.source)}
              </Text>
            </View>
          </View>

          {/* Main value */}
          <View style={[styles.valueContainer, { marginTop: spacing.xl }]}>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>
              {activity.value.toLocaleString()}
            </Text>
            <Text style={[styles.unitText, { color: colors.textSecondary }]}>
              {activity.unit}
            </Text>
          </View>

          {/* Points earned */}
          <View
            style={[
              styles.pointsBadge,
              {
                backgroundColor: colors.primary.subtle,
                borderRadius: radius.full,
                marginTop: spacing.md,
              },
            ]}
          >
            <Text style={[styles.pointsText, { color: colors.primary.main }]}>
              +{points} points earned
            </Text>
          </View>
        </View>

        {/* Details card */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              marginTop: spacing.md,
            },
          ]}
        >
          {/* Date */}
          <View style={[styles.detailRow, { padding: spacing.md }]}>
            <View style={styles.detailIcon}>
              <CalendarIcon size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text
                style={[styles.detailLabel, { color: colors.textSecondary }]}
              >
                Date
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {formatDate(activity.recorded_at)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Time */}
          <View style={[styles.detailRow, { padding: spacing.md }]}>
            <View style={styles.detailIcon}>
              <ClockIcon size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text
                style={[styles.detailLabel, { color: colors.textSecondary }]}
              >
                Time
              </Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                {formatTime(activity.recorded_at)}
              </Text>
            </View>
          </View>

          {/* Challenge (if linked) */}
          {activity.challenge_id && (
            <>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
              <TouchableOpacity
                style={[styles.detailRow, { padding: spacing.md }]}
                onPress={() =>
                  router.push(`/challenge/${activity.challenge_id}`)
                }
              >
                <View style={styles.detailIcon}>
                  <TrophyIcon size={20} color={colors.textMuted} />
                </View>
                <View style={styles.detailContent}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Challenge
                  </Text>
                  <Text
                    style={[styles.detailValue, { color: colors.primary.main }]}
                  >
                    View Challenge →
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 32,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainCard: {},
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  typeText: {
    marginLeft: 12,
  },
  activityType: {
    fontSize: 20,
    fontWeight: "700",
  },
  sourceText: {
    fontSize: 14,
    marginTop: 2,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
  },
  valueText: {
    fontSize: 48,
    fontWeight: "800",
  },
  unitText: {
    fontSize: 20,
    fontWeight: "500",
  },
  pointsBadge: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: "600",
  },
  detailsCard: {
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    width: 40,
    alignItems: "center",
  },
  detailContent: {
    flex: 1,
    marginLeft: 8,
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
  divider: {
    height: 1,
    marginLeft: 56,
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notFoundText: {
    fontSize: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
