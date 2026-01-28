// src/services/health/utils/hashGenerator.ts
// =============================================================================
// Hash Generator for Health Data Deduplication
// =============================================================================
// Generates consistent SHA-256 hashes for health samples to prevent
// duplicate entries in the database.
// =============================================================================

import * as Crypto from "expo-crypto";
import type { HealthSample, ChallengeType } from "../types";

/**
 * Generate a SHA-256 hash for a health sample.
 * This hash is used as source_external_id for deduplication.
 */
export async function generateSampleHash(
  sample: HealthSample,
): Promise<string> {
  const hashInput = [
    sample.type,
    sample.value.toString(),
    sample.unit,
    sample.startDate.toISOString(),
    sample.endDate.toISOString(),
    sample.sourceId,
    sample.id,
  ].join("|");

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    hashInput,
  );

  return hash;
}

/**
 * Generate a batch of hashes for multiple samples.
 */
export async function generateBatchHashes(
  samples: HealthSample[],
): Promise<string[]> {
  const hashPromises = samples.map((sample) => generateSampleHash(sample));
  return Promise.all(hashPromises);
}

/**
 * Generate a simple hash for manual deduplication checks.
 */
export async function generateQuickHash(
  type: ChallengeType,
  value: number,
  timestamp: Date,
  sourceId: string,
): Promise<string> {
  const hashInput = [
    type,
    value.toString(),
    timestamp.toISOString(),
    sourceId,
  ].join("|");

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    hashInput,
  );
}

/**
 * Validate that a hash string is properly formatted.
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}
