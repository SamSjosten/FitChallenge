// src/services/health/healthService.ts
// =============================================================================
// Health Service - Main Orchestrator
// =============================================================================

import { Platform } from "react-native";
import { getSupabaseClient, getUserId, requireUserId } from "@/lib/supabase";
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
  RecentHealthActivity,
  LogHealthActivityResult,
} from "./types";
import { HealthKitProvider, MockHealthProvider } from "./providers";
import { transformSamples, assignChallengesToActivities, calculateSyncDateRange } from "./utils";

const DEFAULT_SYNC_OPTIONS: Required<SyncOptions> = {
  syncType: "manual",
  lookbackDays: 7,
  activityTypes: ["steps", "active_minutes", "calories", "distance", "workouts"],
  force: false,
};

const BACKGROUND_LOOKBACK_DAYS = 3;
const MANUAL_LOOKBACK_DAYS = 7;
const INITIAL_LOOKBACK_DAYS = 30;

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

    // maybeSingle(): returns null data (not an error) when no connection exists
    const { data: connection, error } = await getSupabaseClient()
      .rpc("get_health_connection", { p_provider: this.providerType })
      .maybeSingle();

    if (error || !connection) {
      return { status: "disconnected", connection: null, lastSync: null };
    }

    const { data: activeSyncs } = await getSupabaseClient()
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
        lastSync: connection.last_sync_at ? new Date(connection.last_sync_at) : null,
      };
    }

    return {
      status: connection.is_active ? "connected" : "disconnected",
      connection: connection as HealthConnection,
      lastSync: connection.last_sync_at ? new Date(connection.last_sync_at) : null,
    };
  }

  async connect(
    permissions: HealthPermission[] = [
      "steps",
      "activeMinutes",
      "calories",
      "distance",
      "workouts",
    ],
  ): Promise<HealthConnection> {
    await requireUserId(); // Fail fast if session expired

    const isAvailable = await this.provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`${this.providerType} is not available on this device`);
    }

    const permissionResult = await this.provider.requestAuthorization(permissions);

    if (permissionResult.granted.length === 0) {
      throw new Error("No health permissions were granted");
    }

    const { data: connectionId, error } = await getSupabaseClient().rpc("connect_health_provider", {
      p_provider: this.providerType,
      p_permissions: permissionResult.granted,
    });

    if (error) {
      throw new Error(`Failed to save health connection: ${error.message}`);
    }

    // Row guaranteed to exist after connect_health_provider upsert, so .single() is correct
    const { data: connection, error: fetchError } = await getSupabaseClient()
      .rpc("get_health_connection", { p_provider: this.providerType })
      .single();

    if (fetchError || !connection) {
      throw new Error("Failed to fetch health connection after connect");
    }

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
    await requireUserId(); // Fail fast if session expired

    const { error } = await getSupabaseClient().rpc("disconnect_health_provider", {
      p_provider: this.providerType,
    });

    if (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    await requireUserId(); // Fail fast if session expired

    const startTime = Date.now();
    const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };

    if (!options?.lookbackDays) {
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

    const { data: syncLogId, error: logError } = await getSupabaseClient().rpc(
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

      const samples = await this.provider.fetchSamples(startDate, endDate, opts.activityTypes);

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

      const { data: challenges } = await getSupabaseClient().rpc("get_challenges_for_health_sync");

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
        result.errors.length > 0 ? result.errors.map((e) => e.error).join("; ") : undefined,
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

      // RPC expects Json — serialize ProcessedActivity[] to plain JSON-compatible objects
      const { data, error } = await getSupabaseClient().rpc("log_health_activity", {
        p_activities: JSON.parse(JSON.stringify(batch)),
      });

      if (error) {
        allErrors.push({ error: error.message });
        continue;
      }

      const result = data as unknown as LogHealthActivityResult;
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
    errorMessage?: string,
  ): Promise<void> {
    await getSupabaseClient().rpc("complete_health_sync", {
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

    const { data, error } = await getSupabaseClient()
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

  async getRecentActivities(limit = 50, offset = 0): Promise<RecentHealthActivity[]> {
    await requireUserId(); // Fail fast if session expired

    const { data, error } = await getSupabaseClient().rpc("get_recent_health_activities", {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Failed to fetch recent activities:", error);
      return [];
    }

    return data as RecentHealthActivity[];
  }

  /**
   * Get aggregated health summary for today and this week.
   * Fetches recent activities and aggregates by date window.
   */
  async getSummary(): Promise<HealthSummaryData> {
    const activities = await this.getRecentActivities(500, 0);

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const summary: HealthSummaryData = {
      today: { steps: 0, activeMinutes: 0, calories: 0, distance: 0 },
      thisWeek: { steps: 0, activeMinutes: 0, calories: 0, distance: 0 },
    };

    for (const activity of activities) {
      const activityDate = new Date(activity.recorded_at);
      const value = activity.value;

      const field = mapChallengeTypeToSummaryField(activity.activity_type);
      if (!field) continue;

      if (activityDate >= startOfWeek) {
        summary.thisWeek[field] += value;
      }
      if (activityDate >= startOfToday) {
        summary.today[field] += value;
      }
    }

    return summary;
  }
}

export interface HealthSummaryData {
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

function mapChallengeTypeToSummaryField(
  type: string,
): keyof HealthSummaryData["today"] | null {
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

export function createMockHealthService(mockProvider: IHealthProvider): HealthService {
  return new HealthService(mockProvider);
}
