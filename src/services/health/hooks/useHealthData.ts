// src/services/health/hooks/useHealthData.ts
// =============================================================================
// useHealthData Hook
// =============================================================================

import { useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { getHealthService } from "../healthService";
import { healthQueryKeys } from "./useHealthConnection";
import type { ProcessedActivity, ChallengeType } from "../types";

export interface UseHealthDataOptions {
  pageSize?: number;
  activityType?: ChallengeType;
  enabled?: boolean;
}

export interface UseHealthDataResult {
  activities: ProcessedActivity[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refresh: () => void;
  error: string | null;
}

export function useHealthData(
  options: UseHealthDataOptions = {},
): UseHealthDataResult {
  const { pageSize = 50, activityType, enabled = true } = options;
  const healthService = getHealthService();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage: fetchNext,
    refetch,
    error: queryError,
  } = useInfiniteQuery({
    queryKey: [...healthQueryKeys.recentActivities(pageSize), activityType],
    queryFn: async ({ pageParam = 0 }) => {
      const activities = await healthService.getRecentActivities(
        pageSize,
        pageParam,
      );

      if (activityType) {
        return activities.filter((a) => a.activity_type === activityType);
      }

      return activities;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) {
        return undefined;
      }
      return allPages.flat().length;
    },
    enabled,
    staleTime: 60_000,
  });

  const activities = data?.pages.flat() ?? [];

  const fetchNextPage = useCallback(() => {
    fetchNext();
  }, [fetchNext]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const error = queryError instanceof Error ? queryError.message : null;

  return {
    activities,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    refresh,
    error,
  };
}

export interface HealthSummary {
  today: {
    steps: number;
    activeMinutes: number;
    calories: number;
    distance: number;
  };
  thisWeek: {
    steps: number;
    activeMinutes: number;
    calories: number;
    distance: number;
  };
}

export function useHealthSummary(): {
  summary: HealthSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const healthService = getHealthService();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["health", "summary"],
    queryFn: async () => {
      const activities = await healthService.getRecentActivities(500, 0);

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const summary: HealthSummary = {
        today: { steps: 0, activeMinutes: 0, calories: 0, distance: 0 },
        thisWeek: { steps: 0, activeMinutes: 0, calories: 0, distance: 0 },
      };

      for (const activity of activities) {
        const activityDate = new Date(activity.recorded_at);
        const value = activity.value;

        const field = mapTypeToField(activity.activity_type);
        if (!field) continue;

        if (activityDate >= startOfWeek) {
          summary.thisWeek[field] += value;
        }

        if (activityDate >= startOfToday) {
          summary.today[field] += value;
        }
      }

      return summary;
    },
    staleTime: 60_000,
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const error = queryError instanceof Error ? queryError.message : null;

  return {
    summary: data ?? null,
    isLoading,
    error,
    refresh,
  };
}

function mapTypeToField(
  type: ChallengeType,
): keyof HealthSummary["today"] | null {
  switch (type) {
    case "steps":
      return "steps";
    case "active_minutes":
      return "activeMinutes";
    case "calories":
      return "calories";
    case "distance":
      return "distance";
    default:
      return null;
  }
}
