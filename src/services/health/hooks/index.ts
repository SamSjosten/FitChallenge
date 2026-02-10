// src/services/health/hooks/index.ts
export { useHealthConnection, healthQueryKeys } from "./useHealthConnection";
export type { UseHealthConnectionResult } from "./useHealthConnection";

export { useHealthSync, useBackgroundHealthSync } from "./useHealthSync";
export type { UseHealthSyncResult } from "./useHealthSync";

export { useHealthData, useHealthSummary } from "./useHealthData";
export type { UseHealthDataOptions, UseHealthDataResult, HealthSummary } from "./useHealthData";
