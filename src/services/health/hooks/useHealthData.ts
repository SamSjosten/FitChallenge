// src/services/health/hooks/useHealthData.ts
// =============================================================================
// useHealthData Hook
// =============================================================================

import { useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { getHealthService } from "../healthService";
import { healthQueryKeys } from "./useHealthConnection";
import type { RecentHealthActivity, ChallengeType } from "../types";

interface HealthActivityPage {
  items: RecentHealthActivity[];
  serverCount: number;
}

export interface UseHealthDataOptions {
  pageSize?: number;
  activityType?: ChallengeType;
  enabled?: boolean;
}

export interface UseHealthDataResult {
  activities: RecentHealthActivity[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refresh: () => void;
  error: string | null;
}

export function useHealthData(options: UseHealthDataOptions = {}): UseHealthDataResult {
  const { pageSize = 50, activityType, enabled = true } = options;
  const { user } = useAuth();
  const healthService = getHealthService();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage: fetchNext,
    refetch,
    error: queryError,
  } = useInfiniteQuery<HealthActivityPage>({
    queryKey: [...healthQueryKeys.recentActivities(pageSize), activityType],
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const rawActivities = await healthService.getRecentActivities(pageSize, offset);
      return {
        items: activityType
          ? rawActivities.filter((activity) => activity.activity_type === activityType)
          : rawActivities,
        serverCount: rawActivities.length,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.serverCount < pageSize) {
        return undefined;
      }
      return allPages.length * pageSize;
    },
    enabled: !!user?.id && enabled,
    staleTime: 60_000,
  });

  const activities = data?.pages.flatMap((page) => page.items) ?? [];

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

// Re-export HealthSummaryData as HealthSummary for backward compatibility
export type { HealthSummaryData as HealthSummary } from "../healthService";

export function useHealthSummary(): {
  summary: import("../healthService").HealthSummaryData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const { user } = useAuth();
  const healthService = getHealthService();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: healthQueryKeys.summary,
    queryFn: () => healthService.getSummary(),
    enabled: !!user?.id,
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
