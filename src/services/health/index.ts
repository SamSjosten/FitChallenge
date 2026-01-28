// src/services/health/index.ts
// =============================================================================
// Health Service - Public API
// =============================================================================
// This module provides health data integration for iOS (HealthKit) and
// Android (Google Fit). Export all public types, hooks, and utilities.
// =============================================================================

// Main service
export {
  HealthService,
  getHealthService,
  resetHealthService,
  createMockHealthService,
} from "./healthService";

// Types
export type {
  HealthProvider,
  SyncType,
  SyncStatus,
  ConnectionStatus,
  ChallengeType,
  HealthSample,
  ProcessedActivity,
  LogHealthActivityResult,
  HealthSyncLog,
  HealthConnection,
  ChallengeForSync,
  SyncOptions,
  SyncResult,
  HealthPermission,
  PermissionResult,
  IHealthProvider,
  IHealthService,
} from "./types";

// Providers
export {
  HealthProvider as HealthProviderBase,
  HealthKitProvider,
  MockHealthProvider,
  createFullyGrantedMockProvider,
  createFailingMockProvider,
  createMockProviderWithSamples,
} from "./providers";
export type { MockHealthConfig } from "./providers";

// Hooks
export {
  useHealthConnection,
  useHealthSync,
  useHealthData,
  useHealthSummary,
  useBackgroundHealthSync,
  healthQueryKeys,
} from "./hooks";
export type {
  UseHealthConnectionResult,
  UseHealthSyncResult,
  UseHealthDataOptions,
  UseHealthDataResult,
  HealthSummary,
} from "./hooks";

// Utilities
export {
  generateSampleHash,
  generateBatchHashes,
  generateQuickHash,
  isValidHash,
  transformSample,
  transformSamples,
  findMatchingChallenge,
  assignChallengesToActivities,
  aggregateByDayAndType,
  calculateTotal,
  filterValidSamples,
  calculateSyncDateRange,
  HEALTHKIT_TYPE_MAP,
  GOOGLEFIT_TYPE_MAP,
  DEFAULT_UNITS,
} from "./utils";
