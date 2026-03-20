// src/services/health/hooks/useHealthConnection.ts
// =============================================================================
// useHealthConnection Hook
// =============================================================================

import { useCallback } from "react";
import { Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHealthService } from "../healthService";
import type { ConnectionStatus, HealthConnection, HealthPermission } from "../types";

export const healthQueryKeys = {
  connection: ["health", "connection"] as const,
  summary: ["health", "summary"] as const,
  syncHistory: (limit?: number) => ["health", "syncHistory", limit] as const,
  recentActivities: (limit?: number, offset?: number) =>
    ["health", "activities", limit, offset] as const,
};

export interface UseHealthConnectionResult {
  status: ConnectionStatus;
  connection: HealthConnection | null;
  lastSync: Date | null;
  isLoading: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  error: string | null;
  isAvailable: boolean;
  connect: (permissions?: HealthPermission[]) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => void;
}

export function useHealthConnection(): UseHealthConnectionResult {
  const queryClient = useQueryClient();
  const healthService = getHealthService();

  const {
    data: connectionData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: healthQueryKeys.connection,
    queryFn: async () => {
      return healthService.getConnectionStatus();
    },
    staleTime: 30_000,
    enabled: Platform.OS === "ios",
  });

  // Derive availability from authoritative provider check returned by getConnectionStatus().
  // Falls back to platform check while query is still loading (preserves iOS-first UX).
  const isAvailable = connectionData?.isProviderAvailable ?? (Platform.OS === "ios");

  const connectMutation = useMutation({
    mutationFn: async (permissions?: HealthPermission[]) => {
      return healthService.connect(permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.connection });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return healthService.disconnect();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthQueryKeys.connection });
    },
  });

  const connect = useCallback(
    async (permissions?: HealthPermission[]) => {
      await connectMutation.mutateAsync(permissions);
    },
    [connectMutation],
  );

  const disconnect = useCallback(async () => {
    await disconnectMutation.mutateAsync();
  }, [disconnectMutation]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const error =
    queryError instanceof Error
      ? queryError.message
      : connectMutation.error instanceof Error
        ? connectMutation.error.message
        : disconnectMutation.error instanceof Error
          ? disconnectMutation.error.message
          : null;

  return {
    status: connectionData?.status ?? "disconnected",
    connection: connectionData?.connection ?? null,
    lastSync: connectionData?.lastSync ?? null,
    isLoading,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    error,
    isAvailable,
    connect,
    disconnect,
    refresh,
  };
}
