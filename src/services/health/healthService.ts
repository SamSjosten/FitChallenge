// src/services/health/healthService.ts
// =============================================================================
// Health Service - Main Orchestrator
// =============================================================================

import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import type {
  IHealthService,
  IHealthProvider,
  HealthProvider as HealthProviderType,
  HealthConnection,
  HealthSyncLog,
  SyncOptions,
  SyncResult,
  ProcessedActivity,
  ChallengeForSync,
  ConnectionStatus,
  HealthPermission,
  ChallengeType,
  LogHealthActivityResult,
} from "./types";
import { HealthKitProvider, MockHealthProvider } from "./providers";
import {
  transformSamples,
  assignChallengesToActivities,
  calculateSyncDateRange,
} from "./utils";

const DEFAULT_SYNC_OPTIONS: Required<SyncOptions> = {
  syncType: "manual",
  lookbackDays: 7,
  activityTypes: [
    "steps",
    "active_minutes",
    "calories",
    "distance",
    "workouts",
  ],
  force: false,
};

const BACKGROUND_LOOKBACK_DAYS = 3;
const MANUAL_LOOKBACK_DAYS = 7;
const INITIAL_LOOKBACK_DAYS = 30;

async function getUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export class HealthService implements IHealthService {
  private provider: IHealthProvider;
  private providerType: HealthProviderType;

  constructor(mockProvider?: IHealthProvider) {
    if (mockProvider) {
      this.provider = mockProvider;
      this.providerType = mockProvider.provider;
    } else if (Platform.OS === "ios") {
      this.provider = new HealthKitProvider();
      this.providerType = "healthkit";
    } else {
      this.provider = new MockHealthProvider({ isAvailable: false });
      this.providerType = "googlefit";
    }
  }

  async getConnectionStatus(): Promise<{
    status: ConnectionStatus;
    connection: HealthConnection | null;
    lastSync: Date | null;
  }> {
    const userId = await getUserId();
    if (!userId) {
      return { status: "disconnected", connection: null, lastSync: null };
    }

    const isAvailable = await this.provider.isAvailable();
    if (!isAvailable) {
      return { status: "disconnected", connection: null, lastSync: null };
    }

    const { data: connection, error } = await supabase
      .rpc("get_health_connection", { p_provider: this.providerType })
      .single();

    if (error || !connection) {
      return { status: "disconnected", connection: null, lastSync: null };
    }

    const { data: activeSyncs } = await supabase
      .from("health_sync_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", this.providerType)
      .eq("status", "in_progress")
      .limit(1);

    if (activeSyncs && activeSyncs.length > 0) {
      return {
        status: "syncing",
        connection: connection as HealthConnection,
        lastSync: connection.last_sync_at
          ? new Date(connection.last_sync_at)
          : null,
      };
    }

    return {
      status: connection.is_active ? "connected" : "disconnected",
      connection: connection as HealthConnection,
      lastSync: connection.last_sync_at
        ? new Date(connection.last_sync_at)
        : null,
    };
  }

  async connect(
    permissions: HealthPermission[] = ["steps", "activeMinutes", "calories"],
  ): Promise<HealthConnection> {
    const isAvailable = await this.provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`${this.providerType} is not available on this device`);
    }

    const permissionResult =
      await this.provider.requestAuthorization(permissions);

    if (permissionResult.granted.length === 0) {
      throw new Error("No health permissions were granted");
    }

    const { data: connectionId, error } = await supabase.rpc(
      "connect_health_provider",
      {
        p_provider: this.providerType,
        p_permissions: permissionResult.granted,
      },
    );

    if (error) {
      throw new Error(`Failed to save health connection: ${error.message}`);
    }

    const { data: connection } = await supabase
      .rpc("get_health_connection", { p_provider: this.providerType })
      .single();

    try {
      await this.sync({
        syncType: "initial",
        lookbackDays: INITIAL_LOOKBACK_DAYS,
      });
    } catch (syncError) {
      console.warn("Initial sync failed:", syncError);
    }

    return connection as HealthConnection;
  }

  async disconnect(): Promise<void> {
    const { error } = await supabase.rpc("disconnect_health_provider", {
      p_provider: this.providerType,
    });

    if (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };

    if (!options.lookbackDays) {
      switch (opts.syncType) {
        case "background":
          opts.lookbackDays = BACKGROUND_LOOKBACK_DAYS;
          break;
        case "initial":
          opts.lookbackDays = INITIAL_LOOKBACK_DAYS;
          break;
        default:
          opts.lookbackDays = MANUAL_LOOKBACK_DAYS;
      }
    }

    const { data: syncLogId, error: logError } = await supabase.rpc(
      "start_health_sync",
      {
        p_provider: this.providerType,
        p_sync_type: opts.syncType,
      },
    );

    if (logError || !syncLogId) {
      throw new Error(`Failed to start sync log: ${logError?.message}`);
    }

    try {
      const { startDate, endDate } = calculateSyncDateRange(opts.lookbackDays);

      const samples = await this.provider.fetchSamples(
        startDate,
        endDate,
        opts.activityTypes,
      );

      if (samples.length === 0) {
        await this.completeSyncLog(syncLogId, "completed", 0, 0, 0);
        return {
          success: true,
          syncLogId,
          recordsProcessed: 0,
          recordsInserted: 0,
          recordsDeduplicated: 0,
          errors: [],
          duration: Date.now() - startTime,
        };
      }

      const activities = await transformSamples(samples, this.providerType);

      const { data: challenges } = await supabase.rpc(
        "get_challenges_for_health_sync",
      );

      const assignedActivities = assignChallengesToActivities(
        activities,
        (challenges as ChallengeForSync[]) || [],
      );

      const result = await this.batchInsertActivities(assignedActivities);

      await this.completeSyncLog(
        syncLogId,
        result.errors.length > 0 ? "partial" : "completed",
        result.total_processed,
        result.inserted,
        result.deduplicated,
        result.errors.length > 0
          ? result.errors.map((e) => e.error).join("; ")
          : null,
      );

      return {
        success: result.errors.length === 0,
        syncLogId,
        recordsProcessed: result.total_processed,
        recordsInserted: result.inserted,
        recordsDeduplicated: result.deduplicated,
        errors: result.errors.map((e) => e.error),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.completeSyncLog(
        syncLogId,
        "failed",
        0,
        0,
        0,
        error instanceof Error ? error.message : "Unknown error",
      );

      throw error;
    }
  }

  private async batchInsertActivities(
    activities: ProcessedActivity[],
  ): Promise<LogHealthActivityResult> {
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalDeduplicated = 0;
    const allErrors: LogHealthActivityResult["errors"] = [];

    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      const batch = activities.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase.rpc("log_health_activity", {
        p_activities: batch,
      });

      if (error) {
        allErrors.push({ error: error.message });
        continue;
      }

      const result = data as LogHealthActivityResult;
      totalInserted += result.inserted;
      totalDeduplicated += result.deduplicated;
      allErrors.push(...result.errors);
    }

    return {
      inserted: totalInserted,
      deduplicated: totalDeduplicated,
      total_processed: activities.length,
      errors: allErrors,
    };
  }

  private async completeSyncLog(
    syncLogId: string,
    status: "completed" | "failed" | "partial",
    recordsProcessed: number,
    recordsInserted: number,
    recordsDeduplicated: number,
    errorMessage?: string | null,
  ): Promise<void> {
    await supabase.rpc("complete_health_sync", {
      p_log_id: syncLogId,
      p_status: status,
      p_records_processed: recordsProcessed,
      p_records_inserted: recordsInserted,
      p_records_deduplicated: recordsDeduplicated,
      p_error_message: errorMessage,
    });
  }

  async getSyncHistory(limit = 10): Promise<HealthSyncLog[]> {
    const userId = await getUserId();
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from("health_sync_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", this.providerType)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch sync history:", error);
      return [];
    }

    return data as HealthSyncLog[];
  }

  async getRecentActivities(
    limit = 50,
    offset = 0,
  ): Promise<ProcessedActivity[]> {
    const { data, error } = await supabase.rpc("get_recent_health_activities", {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Failed to fetch recent activities:", error);
      return [];
    }

    return data as ProcessedActivity[];
  }
}

let healthServiceInstance: HealthService | null = null;

export function getHealthService(): HealthService {
  if (!healthServiceInstance) {
    healthServiceInstance = new HealthService();
  }
  return healthServiceInstance;
}

export function resetHealthService(): void {
  healthServiceInstance = null;
}

export function createMockHealthService(
  mockProvider: IHealthProvider,
): HealthService {
  return new HealthService(mockProvider);
}
