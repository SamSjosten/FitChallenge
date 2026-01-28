// src/services/health/providers/HealthKitProvider.ts
// =============================================================================
// HealthKit Provider Implementation (iOS)
// =============================================================================

import { Platform } from "react-native";
import { HealthProvider } from "./HealthProvider";
import type {
  HealthProvider as HealthProviderType,
  HealthSample,
  ChallengeType,
  HealthPermission,
  PermissionResult,
} from "../types";
import { HEALTHKIT_TYPE_MAP } from "../utils/dataMapper";

const HEALTHKIT_PERMISSIONS: Record<HealthPermission, string> = {
  steps: "HKQuantityTypeIdentifierStepCount",
  activeMinutes: "HKQuantityTypeIdentifierAppleExerciseTime",
  workouts: "HKWorkoutType",
  distance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  calories: "HKQuantityTypeIdentifierActiveEnergyBurned",
  heartRate: "HKQuantityTypeIdentifierHeartRate",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
};

const CHALLENGE_TO_HEALTHKIT: Record<ChallengeType, string[]> = {
  steps: ["HKQuantityTypeIdentifierStepCount"],
  active_minutes: ["HKQuantityTypeIdentifierAppleExerciseTime"],
  workouts: ["HKWorkoutType"],
  distance: [
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
    "HKQuantityTypeIdentifierDistanceCycling",
  ],
  calories: ["HKQuantityTypeIdentifierActiveEnergyBurned"],
  custom: [],
};

export class HealthKitProvider extends HealthProvider {
  readonly provider: HealthProviderType = "healthkit";
  private healthKit: typeof import("react-native-health") | null = null;

  private async getHealthKit(): Promise<
    typeof import("react-native-health") | null
  > {
    if (Platform.OS !== "ios") {
      return null;
    }

    if (this.healthKit) {
      return this.healthKit;
    }

    try {
      this.healthKit = await import("react-native-health");
      return this.healthKit;
    } catch (error) {
      console.warn("HealthKit module not available:", error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      return false;
    }

    const healthKit = await this.getHealthKit();
    if (!healthKit) {
      return false;
    }

    return new Promise((resolve) => {
      healthKit.default.isAvailable(
        (error: Error | null, available: boolean) => {
          resolve(!error && available);
        },
      );
    });
  }

  async getAuthorizationStatus(): Promise<PermissionResult> {
    const healthKit = await this.getHealthKit();
    if (!healthKit) {
      return {
        granted: [],
        denied: [],
        notDetermined: Object.keys(HEALTHKIT_PERMISSIONS) as HealthPermission[],
      };
    }

    return {
      granted: [],
      denied: [],
      notDetermined: Object.keys(HEALTHKIT_PERMISSIONS) as HealthPermission[],
    };
  }

  async requestAuthorization(
    permissions: HealthPermission[],
  ): Promise<PermissionResult> {
    const healthKit = await this.getHealthKit();
    if (!healthKit) {
      return {
        granted: [],
        denied: permissions,
        notDetermined: [],
      };
    }

    const readPermissions = permissions
      .map((p) => HEALTHKIT_PERMISSIONS[p])
      .filter(Boolean);

    return new Promise((resolve) => {
      healthKit.default.initHealthKit(
        {
          permissions: {
            read: readPermissions,
            write: [],
          },
        },
        (error: Error | null) => {
          if (error) {
            console.error("HealthKit authorization error:", error);
            resolve({
              granted: [],
              denied: permissions,
              notDetermined: [],
            });
          } else {
            resolve({
              granted: permissions,
              denied: [],
              notDetermined: [],
            });
          }
        },
      );
    });
  }

  async fetchSamples(
    startDate: Date,
    endDate: Date,
    types: ChallengeType[],
  ): Promise<HealthSample[]> {
    this.validateDateRange(startDate, endDate);

    const healthKit = await this.getHealthKit();
    if (!healthKit) {
      return [];
    }

    const allSamples: HealthSample[] = [];

    for (const type of types) {
      const healthKitTypes = CHALLENGE_TO_HEALTHKIT[type] || [];

      for (const hkType of healthKitTypes) {
        try {
          const samples = await this.fetchSamplesForType(
            healthKit,
            hkType,
            startDate,
            endDate,
            type,
          );
          allSamples.push(...samples);
        } catch (error) {
          console.error(`Error fetching ${hkType}:`, error);
        }
      }
    }

    return this.sortSamplesByDate(this.deduplicateSamples(allSamples));
  }

  private async fetchSamplesForType(
    healthKit: typeof import("react-native-health"),
    hkType: string,
    startDate: Date,
    endDate: Date,
    challengeType: ChallengeType,
  ): Promise<HealthSample[]> {
    const options = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ascending: false,
      limit: 1000,
    };

    return new Promise((resolve) => {
      const callback = (
        error: Error | null,
        results: Array<{
          id: string;
          value: number;
          startDate: string;
          endDate: string;
          sourceName: string;
          sourceId: string;
          unit?: string;
        }>,
      ) => {
        if (error || !results) {
          console.error(`HealthKit query error for ${hkType}:`, error);
          resolve([]);
          return;
        }

        const samples: HealthSample[] = results.map((r) => ({
          id: r.id || `${hkType}-${r.startDate}-${r.value}`,
          type: challengeType,
          value: r.value,
          unit: r.unit || this.getDefaultUnit(challengeType),
          startDate: new Date(r.startDate),
          endDate: new Date(r.endDate),
          sourceName: r.sourceName,
          sourceId: r.sourceId,
        }));

        resolve(samples);
      };

      switch (hkType) {
        case "HKQuantityTypeIdentifierStepCount":
          healthKit.default.getDailyStepCountSamples(options, callback);
          break;
        case "HKQuantityTypeIdentifierAppleExerciseTime":
          healthKit.default.getAppleExerciseTime(options, callback);
          break;
        case "HKQuantityTypeIdentifierActiveEnergyBurned":
          healthKit.default.getActiveEnergyBurned(options, callback);
          break;
        case "HKQuantityTypeIdentifierDistanceWalkingRunning":
          healthKit.default.getDistanceWalkingRunning(options, callback);
          break;
        case "HKQuantityTypeIdentifierDistanceCycling":
          healthKit.default.getDistanceCycling(options, callback);
          break;
        default:
          resolve([]);
      }
    });
  }

  private getDefaultUnit(type: ChallengeType): string {
    const units: Record<ChallengeType, string> = {
      steps: "count",
      active_minutes: "min",
      workouts: "count",
      distance: "m",
      calories: "kcal",
      custom: "count",
    };
    return units[type] || "count";
  }

  async enableBackgroundDelivery(types: ChallengeType[]): Promise<boolean> {
    const healthKit = await this.getHealthKit();
    if (!healthKit) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        resolve(true);
      });
    } catch (error) {
      console.error("Error enabling background delivery:", error);
      return false;
    }
  }

  protected override mapPermissionsToProvider(
    permissions: HealthPermission[],
  ): string[] {
    return permissions
      .map((p) => HEALTHKIT_PERMISSIONS[p])
      .filter((p): p is string => p !== undefined);
  }

  protected override mapProviderTypeToChallenge(
    providerType: string,
  ): ChallengeType | null {
    return HEALTHKIT_TYPE_MAP[providerType] || null;
  }
}
