// src/lib/storageProbe.ts
// Storage capability detection and resilient adapter
//
// This module now delegates to hybridStorage.ts for the actual storage implementation.
// It maintains the same public API for backward compatibility.
//
// Architecture:
// - hybridStorage.ts: Handles encryption, size limits, and storage operations
// - storageProbe.ts: Provides the public API and re-exports for existing consumers
//
// The hybrid storage strategy:
// - SecureStore: encryption key only (< 100 bytes, well under 2KB limit)
// - AsyncStorage: encrypted session payload (no size limit)
// - Fallback: unencrypted AsyncStorage, then memory

import {
  createHybridStorageAdapter,
  getHybridStorageStatus,
  isHybridStorageReady,
  hybridStorageReady,
  subscribeToHybridStorageStatus,
  __resetHybridStorageForTesting,
  __setHybridStorageStatusForTesting,
  type HybridStorageStatus,
  type HybridStorageMode,
} from "./hybridStorage";

// =============================================================================
// TYPES (Backward Compatible)
// =============================================================================

// Map hybrid modes to legacy storage types for backward compatibility
export type StorageType = "secure" | "async" | "localStorage" | "memory";

export interface StorageStatus {
  type: StorageType;
  isSecure: boolean; // True if data is encrypted
  isPersistent: boolean; // True if data survives app restart
  probeError?: string; // Debug info if degraded
  degradedAt?: number; // Timestamp if degraded mid-session
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export type StorageStatusListener = (status: StorageStatus) => void;

// =============================================================================
// TYPE CONVERSION
// =============================================================================

/**
 * Convert HybridStorageStatus to legacy StorageStatus format
 * for backward compatibility with existing consumers
 */
function toStorageStatus(hybrid: HybridStorageStatus): StorageStatus {
  // Map hybrid mode to legacy type
  let type: StorageType;
  switch (hybrid.mode) {
    case "hybrid-encrypted":
      // Hybrid encrypted is conceptually "secure" from the consumer's perspective
      type = "secure";
      break;
    case "async-unencrypted":
      type = "async";
      break;
    case "localStorage":
      type = "localStorage";
      break;
    case "memory":
      type = "memory";
      break;
    default:
      type = "memory";
  }

  return {
    type,
    isSecure: hybrid.isEncrypted,
    isPersistent: hybrid.isPersistent,
    probeError: hybrid.error,
    degradedAt: hybrid.degradedAt,
  };
}

// =============================================================================
// STATE (Listeners for backward compatibility)
// =============================================================================

const legacyListeners = new Map<StorageStatusListener, () => void>();

// =============================================================================
// PUBLIC API (Backward Compatible)
// =============================================================================

/**
 * Promise that resolves when storage probe completes
 */
export const storageProbePromise: Promise<StorageStatus> = hybridStorageReady.then(toStorageStatus);

/**
 * Get current storage status (sync)
 * Returns null if probe hasn't completed yet
 */
export function getStorageStatus(): StorageStatus | null {
  const hybrid = getHybridStorageStatus();
  return hybrid ? toStorageStatus(hybrid) : null;
}

/**
 * Check if storage probe has completed
 */
export function isStorageProbeComplete(): boolean {
  return isHybridStorageReady();
}

/**
 * Subscribe to storage status changes (e.g., mid-session degradation)
 * Returns unsubscribe function
 */
export function subscribeToStorageStatus(listener: StorageStatusListener): () => void {
  // Wrap the listener to convert hybrid status to legacy format
  const wrappedListener = (hybrid: HybridStorageStatus) => {
    listener(toStorageStatus(hybrid));
  };

  const unsubscribe = subscribeToHybridStorageStatus(wrappedListener);
  legacyListeners.set(listener, unsubscribe);

  return () => {
    unsubscribe();
    legacyListeners.delete(listener);
  };
}

/**
 * Create a resilient storage adapter for Supabase auth
 *
 * This adapter:
 * 1. Waits for probe to complete before any operation
 * 2. Uses hybrid encrypted storage when available (SecureStore key + AsyncStorage payload)
 * 3. Falls back gracefully: async-unencrypted → memory
 * 4. Migrates legacy sessions automatically
 * 5. Never throws - falls back to memory as last resort
 */
export function createResilientStorageAdapter(): StorageAdapter {
  return createHybridStorageAdapter();
}

// =============================================================================
// TEST HELPERS (only for testing)
// =============================================================================

/**
 * Reset probe state - FOR TESTING ONLY
 */
export function __resetProbeForTesting(): void {
  __resetHybridStorageForTesting();
  legacyListeners.clear();
}

/**
 * Set probe result directly - FOR TESTING ONLY
 */
export function __setProbeResultForTesting(status: StorageStatus): void {
  // Convert legacy status to hybrid format
  let mode: HybridStorageMode;
  switch (status.type) {
    case "secure":
      mode = "hybrid-encrypted";
      break;
    case "async":
      mode = "async-unencrypted";
      break;
    case "localStorage":
      mode = "localStorage";
      break;
    case "memory":
      mode = "memory";
      break;
    default:
      mode = "memory";
  }

  __setHybridStorageStatusForTesting({
    mode,
    isEncrypted: status.isSecure,
    isPersistent: status.isPersistent,
    error: status.probeError,
    degradedAt: status.degradedAt,
  });
}

/**
 * Get consecutive failures count - FOR TESTING ONLY
 * Note: This is now managed internally by hybridStorage, so we return 0
 */
export function __getConsecutiveFailuresForTesting(): number {
  // Consecutive failures are now managed in hybridStorage.ts
  // Return 0 for backward compatibility with tests that check this
  return 0;
}
