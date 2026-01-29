// app/activity/index.tsx
// Activity History Screen - Lists all user activities
// Design System v2.0

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/providers/ThemeProvider";
import {
  useRecentActivities,
  toDisplayActivity,
  getActivityTypeName,
} from "@/hooks/useActivities";
import { LoadingState, EmptyState } from "@/components/v2";
import { ActivityListItem } from "@/components/v2/ActivityCard";
import { ChevronLeftIcon } from "react-native-heroicons/outline";
import type { ActivityType } from "@/components/icons/ActivityIcons";

// Group activities by date
function groupActivitiesByDate<T extends { recorded_at: string }>(
  activities: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  for (const activity of activities) {
    const date = new Date(activity.recorded_at);
    const activityDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    let group: string;
    if (activityDate.getTime() === today.getTime()) {
      group = "Today";
    } else if (activityDate.getTime() === yesterday.getTime()) {
      group = "Yesterday";
    } else {
      // Use full date for older entries
      group = activityDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(activity);
  }

  return groups;
}

export default function ActivityHistoryScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data: activities, isLoading, refetch } = useRecentActivities(50); // Get more activities for history

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Transform and group activities
  const displayActivities = useMemo(() => {
    if (!activities) return [];
    return activities.map(toDisplayActivity);
  }, [activities]);

  const groupedActivities = useMemo(() => {
    return groupActivitiesByDate(activities || []);
  }, [activities]);

  // Get ordered group keys (most recent first)
  const groupOrder = useMemo(() => {
    const keys = Object.keys(groupedActivities);
    // Sort by date - Today and Yesterday first, then by actual date
    return keys.sort((a, b) => {
      if (a === "Today") return -1;
      if (b === "Today") return 1;
      if (a === "Yesterday") return -1;
      if (b === "Yesterday") return 1;
      // For other dates, parse and compare
      const dateA = new Date(groupedActivities[a][0].recorded_at);
      const dateB = new Date(groupedActivities[b][0].recorded_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupedActivities]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleActivityPress = (activityId: string) => {
    router.push(`/activity/${activityId}`);
  };

  // Loading state
  if (isLoading && !activities) {
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
        <LoadingState variant="content" message="Loading activity history..." />
      </SafeAreaView>
    );
  }

  // Calculate points per activity
  const getPoints = (activity: (typeof activities)[0]) => {
    const display = displayActivities.find((d) => d.id === activity.id);
    return display?.points || 0;
  };

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
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Activity History
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Activity list */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {!activities || activities.length === 0 ? (
          <View style={{ padding: spacing.lg }}>
            <EmptyState
              variant="generic"
              title="No Activity Yet"
              description="Your workout history will appear here after you log some activity"
            />
          </View>
        ) : (
          <>
            {groupOrder.map((group) => {
              const groupActivities = groupedActivities[group];
              if (!groupActivities || groupActivities.length === 0) return null;

              return (
                <View key={group} style={{ marginTop: spacing.md }}>
                  {/* Group header */}
                  <Text
                    style={[
                      styles.groupHeader,
                      {
                        color: colors.textSecondary,
                        paddingHorizontal: spacing.lg,
                        marginBottom: spacing.sm,
                      },
                    ]}
                  >
                    {group.toUpperCase()}
                  </Text>

                  {/* Activity items */}
                  <View
                    style={[
                      styles.activityGroup,
                      {
                        backgroundColor: colors.surface,
                        marginHorizontal: spacing.lg,
                        borderRadius: radius.xl,
                        overflow: "hidden",
                      },
                    ]}
                  >
                    {groupActivities.map((activity, index) => (
                      <ActivityListItem
                        key={activity.id}
                        type={activity.activity_type as ActivityType}
                        name={getActivityTypeName(activity.activity_type)}
                        value={activity.value}
                        unit={activity.unit}
                        points={getPoints(activity)}
                        recordedAt={new Date(activity.recorded_at)}
                        onPress={() => handleActivityPress(activity.id)}
                        showBorder={index < groupActivities.length - 1}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}

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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 32, // Balance the back button
  },
  scrollContent: {
    flexGrow: 1,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  activityGroup: {},
});
