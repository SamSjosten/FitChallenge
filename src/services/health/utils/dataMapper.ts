// src/services/health/utils/dataMapper.ts
// =============================================================================
// Data Mapper for Health Provider Data
// =============================================================================
// Transforms raw health provider data into standardized format.
// =============================================================================

import type {
  HealthSample,
  ProcessedActivity,
  ChallengeType,
  ChallengeForSync,
  HealthProvider,
} from "../types";
import { generateSampleHash } from "./hashGenerator";

// =============================================================================
// TYPE MAPPINGS
// =============================================================================

export const HEALTHKIT_TYPE_MAP: Record<string, ChallengeType> = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierAppleExerciseTime: "active_minutes",
  HKQuantityTypeIdentifierActiveEnergyBurned: "calories",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distance",
  HKQuantityTypeIdentifierDistanceCycling: "distance",
};

export const GOOGLEFIT_TYPE_MAP: Record<string, ChallengeType> = {
  "com.google.step_count.delta": "steps",
  "com.google.active_minutes": "active_minutes",
  "com.google.calories.expended": "calories",
  "com.google.distance.delta": "distance",
};

export const DEFAULT_UNITS: Record<ChallengeType, string> = {
  steps: "steps",
  active_minutes: "minutes",
  workouts: "workouts",
  distance: "meters",
  calories: "kcal",
  custom: "units",
};

// =============================================================================
// SAMPLE TRANSFORMATION
// =============================================================================

/**
 * Transform a raw health sample into a processed activity.
 */
export async function transformSample(
  sample: HealthSample,
  provider: HealthProvider,
): Promise<ProcessedActivity> {
  const hash = await generateSampleHash(sample);

  return {
    activity_type: sample.type,
    value: Math.round(sample.value),
    unit: sample.unit || DEFAULT_UNITS[sample.type],
    source: provider,
    source_external_id: hash,
    recorded_at: sample.startDate.toISOString(),
  };
}

/**
 * Transform a batch of samples.
 */
export async function transformSamples(
  samples: HealthSample[],
  provider: HealthProvider,
): Promise<ProcessedActivity[]> {
  const results = await Promise.all(samples.map((sample) => transformSample(sample, provider)));
  return results;
}

// =============================================================================
// CHALLENGE MATCHING
// =============================================================================

/**
 * Find the best matching challenge for a health activity.
 */
export function findMatchingChallenge(
  activity: ProcessedActivity,
  challenges: ChallengeForSync[],
): string | undefined {
  const activityDate = new Date(activity.recorded_at);

  const matches = challenges.filter((challenge) => {
    if (challenge.challenge_type !== activity.activity_type) {
      return false;
    }

    const startDate = new Date(challenge.start_date);
    const endDate = new Date(challenge.end_date);

    return activityDate >= startDate && activityDate <= endDate;
  });

  if (matches.length === 0) {
    return undefined;
  }

  matches.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());

  return matches[0].challenge_id;
}

/**
 * Assign challenges to a batch of activities.
 */
export function assignChallengesToActivities(
  activities: ProcessedActivity[],
  challenges: ChallengeForSync[],
): ProcessedActivity[] {
  return activities.map((activity) => ({
    ...activity,
    challenge_id: findMatchingChallenge(activity, challenges),
  }));
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Aggregate samples by day and type.
 */
export function aggregateByDayAndType(
  samples: HealthSample[],
): Map<string, Map<ChallengeType, number>> {
  const result = new Map<string, Map<ChallengeType, number>>();

  for (const sample of samples) {
    const dateKey = sample.startDate.toISOString().split("T")[0];

    if (!result.has(dateKey)) {
      result.set(dateKey, new Map());
    }

    const dayMap = result.get(dateKey)!;
    const currentValue = dayMap.get(sample.type) || 0;
    dayMap.set(sample.type, currentValue + sample.value);
  }

  return result;
}

/**
 * Calculate total for a specific type across all samples.
 */
export function calculateTotal(samples: HealthSample[], type: ChallengeType): number {
  return samples.filter((s) => s.type === type).reduce((sum, s) => sum + s.value, 0);
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a health sample has required fields.
 */
export function isValidSample(sample: Partial<HealthSample>): sample is HealthSample {
  return (
    typeof sample.id === "string" &&
    sample.id.length > 0 &&
    typeof sample.type === "string" &&
    typeof sample.value === "number" &&
    sample.value >= 0 &&
    sample.startDate instanceof Date &&
    sample.endDate instanceof Date &&
    sample.startDate <= sample.endDate &&
    typeof sample.sourceId === "string"
  );
}

/**
 * Filter out invalid samples from a batch.
 */
export function filterValidSamples(samples: Partial<HealthSample>[]): HealthSample[] {
  return samples.filter(isValidSample);
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Get the start of day in UTC for a given date.
 */
export function startOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of day in UTC for a given date.
 */
export function endOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/**
 * Calculate date range for sync based on lookback days.
 */
export function calculateSyncDateRange(lookbackDays: number): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - lookbackDays);

  return {
    startDate: startOfDayUTC(startDate),
    endDate: now,
  };
}
