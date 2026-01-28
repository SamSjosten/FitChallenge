// src/services/health/hooks/useHealthSync.ts
// =============================================================================
// useHealthSync Hook
// =============================================================================

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHealthService } from "../healthService";
import { healthQueryKeys } from "./useHealthConnection";
import type { SyncOptions, SyncResult, HealthSyncLog } from "../types";

export interface UseHealthSyncResult {
  sync: (options?: SyncOptions) => Promise<SyncResult>;
  isSyncing: boolean;
  lastResult: SyncResult | null;
  error: string | null;
  syncHistory: HealthSyncLog[];
  isLoadingHistory: boolean;
  refreshHistory: () => void;
}

export function useHealthSync(): UseHealthSyncResult {
  const queryClient = useQueryClient();
  const healthService = getHealthService();

  const syncMutation = useMutation({
    mutationFn: async (options?: SyncOptions) => {
      return healthService.sync(options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.connection });
      queryClient.invalidateQueries({
        queryKey: healthQueryKeys.syncHistory(),
      });
      queryClient.invalidateQueries({
        queryKey: healthQueryKeys.recentActivities(),
      });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
    },
  });

  const {
    data: syncHistory,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: healthQueryKeys.syncHistory(10),
    queryFn: async () => {
      return healthService.getSyncHistory(10);
    },
    staleTime: 60_000,
  });

  const sync = useCallback(
    async (options?: SyncOptions) => {
      return syncMutation.mutateAsync(options);
    },
    [syncMutation],
  );

  const refreshHistory = useCallback(() => {
    refetchHistory();
  }, [refetchHistory]);

  const error =
    syncMutation.error instanceof Error ? syncMutation.error.message : null;

  return {
    sync,
    isSyncing: syncMutation.isPending,
    lastResult: syncMutation.data ?? null,
    error,
    syncHistory: syncHistory ?? [],
    isLoadingHistory,
    refreshHistory,
  };
}

export function useBackgroundHealthSync(): void {
  // Placeholder for background sync setup
  // Full implementation requires expo-background-fetch
}
