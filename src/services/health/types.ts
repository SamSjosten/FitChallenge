// src/services/health/types.ts
// =============================================================================
// Health Service Type Definitions
// =============================================================================
// Shared types for health provider abstraction layer.
// These types are provider-agnostic and used across all implementations.
// =============================================================================

import type { Database } from "@/types/database";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type HealthProvider = "healthkit" | "googlefit";

export type SyncType = "background" | "manual" | "initial";

export type SyncStatus = "in_progress" | "completed" | "failed" | "partial";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "syncing"
  | "error"
  | "partial";

export type ChallengeType = Database["public"]["Enums"]["challenge_type"];

// =============================================================================
// DATA TYPES
// =============================================================================

/**
 * Raw health data sample from a provider (HealthKit, Google Fit, etc.)
 * This is the format data comes in from the native SDK.
 */
export interface HealthSample {
  /** Unique identifier from the health provider */
  id: string;
  /** Type of activity (maps to challenge_type) */
  type: ChallengeType;
  /** Numeric value (steps, minutes, calories, etc.) */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** When the activity was recorded */
  startDate: Date;
  /** End date for duration-based activities */
  endDate: Date;
  /** Source device/app name */
  sourceName: string;
  /** Source bundle identifier */
  sourceId: string;
  /** Raw metadata from provider */
  metadata?: Record<string, unknown>;
}

/**
 * Processed activity ready for database insertion.
 * Includes deduplication hash and optional challenge assignment.
 */
export interface ProcessedActivity {
  /** Activity type (challenge_type enum) */
  activity_type: ChallengeType;
  /** Numeric value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Source provider */
  source: HealthProvider;
  /** SHA-256 hash for deduplication */
  source_external_id: string;
  /** When the activity occurred */
  recorded_at: string; // ISO timestamp
  /** Optional challenge to attribute to */
  challenge_id?: string;
}

/**
 * Result of a batch log operation from the database RPC.
 */
export interface LogHealthActivityResult {
  inserted: number;
  deduplicated: number;
  total_processed: number;
  errors: Array<{
    source_external_id?: string;
    error: string;
    details?: string;
  }>;
}

// =============================================================================
// SYNC TYPES
// =============================================================================

/**
 * Health sync log entry from the database.
 */
export interface HealthSyncLog {
  id: string;
  user_id: string;
  provider: HealthProvider;
  sync_type: SyncType;
  started_at: string;
  completed_at: string | null;
  status: SyncStatus;
  records_processed: number;
  records_inserted: number;
  records_deduplicated: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Health provider connection from the database.
 */
export interface HealthConnection {
  id: string;
  user_id: string;
  provider: HealthProvider;
  connected_at: string;
  last_sync_at: string | null;
  permissions_granted: string[];
  is_active: boolean;
  disconnected_at: string | null;
}

/**
 * Challenge info for health sync attribution.
 */
export interface ChallengeForSync {
  challenge_id: string;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  goal_value: number;
  current_progress: number;
}

// =============================================================================
// SYNC OPTIONS & RESULTS
// =============================================================================

/**
 * Options for initiating a health sync.
 */
export interface SyncOptions {
  /** Type of sync (affects logging and behavior) */
  syncType: SyncType;
  /** How far back to fetch data (default: 7 days for background, 30 for manual) */
  lookbackDays?: number;
  /** Activity types to sync (default: all) */
  activityTypes?: ChallengeType[];
  /** Whether to force re-sync even if recently synced */
  force?: boolean;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  success: boolean;
  syncLogId: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsDeduplicated: number;
  errors: string[];
  duration: number; // milliseconds
}

// =============================================================================
// PERMISSIONS
// =============================================================================

/**
 * Health data permission types.
 * Maps to HealthKit HKObjectType or Google Fit DataType.
 */
export type HealthPermission =
  | "steps"
  | "activeMinutes"
  | "workouts"
  | "distance"
  | "calories"
  | "heartRate"
  | "sleep";

/**
 * Permission request result.
 */
export interface PermissionResult {
  granted: HealthPermission[];
  denied: HealthPermission[];
  notDetermined: HealthPermission[];
}

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

/**
 * Abstract interface that all health providers must implement.
 * Used by HealthKitProvider, GoogleFitProvider, MockHealthProvider.
 */
export interface IHealthProvider {
  /** Provider identifier */
  readonly provider: HealthProvider;

  /** Check if health data is available on this device */
  isAvailable(): Promise<boolean>;

  /** Check current authorization status */
  getAuthorizationStatus(): Promise<PermissionResult>;

  /** Request authorization for health data access */
  requestAuthorization(
    permissions: HealthPermission[],
  ): Promise<PermissionResult>;

  /** Fetch health samples for a date range */
  fetchSamples(
    startDate: Date,
    endDate: Date,
    types: ChallengeType[],
  ): Promise<HealthSample[]>;

  /** Subscribe to real-time updates (if supported) */
  subscribeToUpdates?(
    types: ChallengeType[],
    callback: (samples: HealthSample[]) => void,
  ): () => void;

  /** Enable background delivery (if supported) */
  enableBackgroundDelivery?(types: ChallengeType[]): Promise<boolean>;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Main health service interface.
 * Orchestrates providers, sync, and database operations.
 */
export interface IHealthService {
  /** Get current connection status */
  getConnectionStatus(): Promise<{
    status: ConnectionStatus;
    connection: HealthConnection | null;
    lastSync: Date | null;
  }>;

  /** Connect to health provider */
  connect(permissions?: HealthPermission[]): Promise<HealthConnection>;

  /** Disconnect from health provider */
  disconnect(): Promise<void>;

  /** Perform a sync operation */
  sync(options?: SyncOptions): Promise<SyncResult>;

  /** Get recent sync logs */
  getSyncHistory(limit?: number): Promise<HealthSyncLog[]>;

  /** Get recent health activities */
  getRecentActivities(
    limit?: number,
    offset?: number,
  ): Promise<ProcessedActivity[]>;
}
