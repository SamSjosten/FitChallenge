// src/services/health/providers/MockHealthProvider.ts
// =============================================================================
// Mock Health Provider for Testing
// =============================================================================

import { HealthProvider } from "./HealthProvider";
import type {
  HealthProvider as HealthProviderType,
  HealthSample,
  ChallengeType,
  HealthPermission,
  PermissionResult,
} from "../types";

export interface MockHealthConfig {
  isAvailable?: boolean;
  grantedPermissions?: HealthPermission[];
  authorizationFails?: boolean;
  delay?: number;
  samples?: HealthSample[];
  fetchFails?: boolean;
  errorMessage?: string;
}

const DEFAULT_CONFIG: MockHealthConfig = {
  isAvailable: true,
  grantedPermissions: ["steps", "calories", "activeMinutes", "distance"],
  authorizationFails: false,
  delay: 100,
  samples: undefined,
  fetchFails: false,
  errorMessage: "Mock error",
};

export class MockHealthProvider extends HealthProvider {
  readonly provider: HealthProviderType = "healthkit";

  private config: MockHealthConfig;
  private updateSubscribers: Set<(samples: HealthSample[]) => void> = new Set();

  constructor(config: MockHealthConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(config: Partial<MockHealthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async isAvailable(): Promise<boolean> {
    await this.delay();
    return this.config.isAvailable ?? true;
  }

  async getAuthorizationStatus(): Promise<PermissionResult> {
    await this.delay();
    const allPermissions: HealthPermission[] = [
      "steps",
      "activeMinutes",
      "workouts",
      "distance",
      "calories",
    ];
    const granted = this.config.grantedPermissions ?? [];

    return {
      granted,
      denied: [],
      notDetermined: allPermissions.filter((p) => !granted.includes(p)),
    };
  }

  async requestAuthorization(permissions: HealthPermission[]): Promise<PermissionResult> {
    await this.delay();

    if (this.config.authorizationFails) {
      return {
        granted: [],
        denied: permissions,
        notDetermined: [],
      };
    }

    const newGranted = [...(this.config.grantedPermissions ?? []), ...permissions];
    this.config.grantedPermissions = [...new Set(newGranted)];

    return {
      granted: permissions,
      denied: [],
      notDetermined: [],
    };
  }

  async fetchSamples(
    startDate: Date,
    endDate: Date,
    types: ChallengeType[],
  ): Promise<HealthSample[]> {
    this.validateDateRange(startDate, endDate);
    await this.delay();

    if (this.config.fetchFails) {
      throw new Error(this.config.errorMessage ?? "Mock fetch error");
    }

    if (this.config.samples) {
      return this.filterSamplesByType(
        this.config.samples.filter((s) => s.startDate >= startDate && s.endDate <= endDate),
        types,
      );
    }

    return this.generateMockSamples(startDate, endDate, types);
  }

  subscribeToUpdates(
    _types: ChallengeType[],
    callback: (samples: HealthSample[]) => void,
  ): () => void {
    this.updateSubscribers.add(callback);
    return () => {
      this.updateSubscribers.delete(callback);
    };
  }

  pushUpdate(samples: HealthSample[]): void {
    this.updateSubscribers.forEach((callback) => callback(samples));
  }

  async enableBackgroundDelivery(_types: ChallengeType[]): Promise<boolean> {
    await this.delay();
    return !this.config.fetchFails;
  }

  private async delay(): Promise<void> {
    const ms = this.config.delay ?? 0;
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  private generateMockSamples(
    startDate: Date,
    endDate: Date,
    types: ChallengeType[],
  ): HealthSample[] {
    const samples: HealthSample[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * dayMs);

      for (const type of types) {
        if (type === "custom") continue;

        const sample = this.generateSampleForType(type, date, i);
        samples.push(sample);
      }
    }

    return this.sortSamplesByDate(samples);
  }

  private generateSampleForType(type: ChallengeType, date: Date, dayIndex: number): HealthSample {
    const id = `mock-${type}-${date.toISOString()}-${dayIndex}`;

    const valueRanges: Record<ChallengeType, { min: number; max: number }> = {
      steps: { min: 2000, max: 15000 },
      active_minutes: { min: 10, max: 120 },
      workouts: { min: 0, max: 3 },
      distance: { min: 1000, max: 10000 },
      calories: { min: 100, max: 800 },
      custom: { min: 1, max: 10 },
    };

    const range = valueRanges[type];
    const value = Math.floor(Math.random() * (range.max - range.min + 1) + range.min);

    const units: Record<ChallengeType, string> = {
      steps: "count",
      active_minutes: "min",
      workouts: "count",
      distance: "m",
      calories: "kcal",
      custom: "count",
    };

    return {
      id,
      type,
      value,
      unit: units[type],
      startDate: new Date(date.setHours(8, 0, 0, 0)),
      endDate: new Date(date.setHours(20, 0, 0, 0)),
      sourceName: "MockHealth",
      sourceId: "com.mock.health",
    };
  }
}

export function createFullyGrantedMockProvider(): MockHealthProvider {
  return new MockHealthProvider({
    isAvailable: true,
    grantedPermissions: ["steps", "activeMinutes", "workouts", "distance", "calories"],
  });
}

export function createFailingMockProvider(errorMessage = "Mock error"): MockHealthProvider {
  return new MockHealthProvider({
    fetchFails: true,
    errorMessage,
  });
}

export function createMockProviderWithSamples(samples: HealthSample[]): MockHealthProvider {
  return new MockHealthProvider({
    samples,
  });
}
