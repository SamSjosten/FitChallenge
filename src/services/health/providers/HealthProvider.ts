// src/services/health/providers/HealthProvider.ts
// =============================================================================
// Abstract Health Provider Base Class
// =============================================================================

import type {
  IHealthProvider,
  HealthProvider as HealthProviderType,
  HealthSample,
  ChallengeType,
  HealthPermission,
  PermissionResult,
} from "../types";

/**
 * Abstract base class for health providers.
 */
export abstract class HealthProvider implements IHealthProvider {
  abstract readonly provider: HealthProviderType;

  abstract isAvailable(): Promise<boolean>;
  abstract getAuthorizationStatus(): Promise<PermissionResult>;
  abstract requestAuthorization(permissions: HealthPermission[]): Promise<PermissionResult>;
  abstract fetchSamples(
    startDate: Date,
    endDate: Date,
    types: ChallengeType[],
  ): Promise<HealthSample[]>;

  subscribeToUpdates?(
    types: ChallengeType[],
    callback: (samples: HealthSample[]) => void,
  ): () => void;

  enableBackgroundDelivery?(types: ChallengeType[]): Promise<boolean>;

  protected mapPermissionsToProvider(permissions: HealthPermission[]): string[] {
    return permissions.map((p) => p);
  }

  protected mapProviderTypeToChallenge(providerType: string): ChallengeType | null {
    return null;
  }

  protected validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate > endDate) {
      throw new Error("Start date must be before end date");
    }

    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new Error("Date range cannot exceed 365 days");
    }
  }

  protected filterSamplesByType(samples: HealthSample[], types: ChallengeType[]): HealthSample[] {
    if (types.length === 0) {
      return samples;
    }
    return samples.filter((sample) => types.includes(sample.type));
  }

  protected sortSamplesByDate(samples: HealthSample[], ascending = false): HealthSample[] {
    return [...samples].sort((a, b) => {
      const diff = a.startDate.getTime() - b.startDate.getTime();
      return ascending ? diff : -diff;
    });
  }

  protected deduplicateSamples(samples: HealthSample[]): HealthSample[] {
    const seen = new Set<string>();
    return samples.filter((sample) => {
      if (seen.has(sample.id)) {
        return false;
      }
      seen.add(sample.id);
      return true;
    });
  }
}
