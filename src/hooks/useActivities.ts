// src/hooks/useActivities.ts
// React Query hooks for activity data
// Used by V2 home screen for recent activity section

import { useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { activityService } from "@/services/activities";
import { useAuth } from "@/providers/AuthProvider";
import type { ActivityLog } from "@/types/database";

// =============================================================================
// QUERY KEYS
// =============================================================================

export const activityKeys = {
  all: ["activities"] as const,
  recent: (userId: string, limit?: number) =>
    [...activityKeys.all, "recent", userId, limit] as const,
  forChallenge: (userId: string, challengeId: string) =>
    [...activityKeys.all, "challenge", userId, challengeId] as const,
  summary: (userId: string, challengeId: string) =>
    [...activityKeys.all, "summary", userId, challengeId] as const,
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch recent activities for current user
 * Used on home screen for "Recent Activity" section
 */
export function useRecentActivities(limit: number = 10): UseQueryResult<ActivityLog[], Error> {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: activityKeys.recent(userId || "", limit),
    queryFn: () => activityService.getRecentActivities({ limit }),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetch activities for a specific challenge
 */
export function useChallengeActivities(
  challengeId: string,
  limit: number = 50,
): UseQueryResult<ActivityLog[], Error> {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: activityKeys.forChallenge(userId || "", challengeId),
    queryFn: () => activityService.getChallengeActivities(challengeId, limit),
    enabled: !!userId && !!challengeId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetch activity summary for a challenge
 */
export function useChallengeActivitySummary(challengeId: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: activityKeys.summary(userId || "", challengeId),
    queryFn: () => activityService.getChallengeActivitySummary(challengeId),
    enabled: !!userId && !!challengeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =============================================================================
// HELPER TYPES & UTILS
// =============================================================================

/**
 * Activity with computed display properties
 */
export interface DisplayActivity extends ActivityLog {
  displayDate: string;
  displayTime: string;
  points: number;
  name: string;
}

/**
 * Transform activity log into display-friendly format
 */
export function toDisplayActivity(activity: ActivityLog): DisplayActivity {
  const recordedAt = new Date(activity.recorded_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - recordedAt.getTime()) / (1000 * 60 * 60 * 24));

  let displayDate: string;
  if (diffDays === 0) {
    displayDate = "Today";
  } else if (diffDays === 1) {
    displayDate = "Yesterday";
  } else if (diffDays < 7) {
    displayDate = recordedAt.toLocaleDateString(undefined, { weekday: "long" });
  } else {
    displayDate = recordedAt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  const displayTime = recordedAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  // Simple points calculation - can be enhanced
  // Based on activity type and value
  const pointsMultiplier: Record<string, number> = {
    steps: 0.01, // 1 point per 100 steps
    active_minutes: 1, // 1 point per minute
    workouts: 10, // 10 points per workout
    distance: 5, // 5 points per unit (mile/km)
    custom: 1,
  };

  const multiplier = pointsMultiplier[activity.activity_type] || 1;
  const points = Math.round(activity.value * multiplier);

  return {
    ...activity,
    displayDate,
    displayTime,
    points,
    name: getActivityTypeName(activity.activity_type),
  };
}

/**
 * Get activity type display name
 */
export function getActivityTypeName(type: string): string {
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
}
