// src/lib/storageProbe.ts
// Storage capability detection and resilient adapter
//
// Problem: SecureStore can fail silently, causing session loss
// Solution: Probe storage at startup, fall back gracefully, report status

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// =============================================================================
// TYPES
// =============================================================================

export type StorageType = "secure" | "async" | "localStorage" | "memory";

export interface StorageStatus {
  type: StorageType;
  isSecure: boolean; // Only SecureStore provides encryption
  isPersistent: boolean; // Everything except memory
  probeError?: string; // Debug info if degraded
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PROBE_KEY = "__fitchallenge_storage_probe__";
const PROBE_VALUE = "probe_test_value";

// =============================================================================
// STATE
// =============================================================================

let probeResult: StorageStatus | null = null;
let probePromiseResolver: ((status: StorageStatus) => void) | null = null;

// Promise that resolves when probe completes
export const storageProbePromise: Promise<StorageStatus> = new Promise(
  (resolve) => {
    probePromiseResolver = resolve;
  },
);

// =============================================================================
// STORAGE IMPLEMENTATIONS
// =============================================================================

const secureStorageAdapter: StorageAdapter = {
  getItem: async (key) => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    await SecureStore.deleteItemAsync(key);
  },
};

const asyncStorageAdapter: StorageAdapter = {
  getItem: async (key) => {
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key);
  },
};

const localStorageAdapter: StorageAdapter = {
  getItem: async (key) => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

// In-memory fallback (session-only, no persistence)
const memoryStorage = new Map<string, string>();
const memoryStorageAdapter: StorageAdapter = {
  getItem: async (key) => {
    return memoryStorage.get(key) ?? null;
  },
  setItem: async (key, value) => {
    memoryStorage.set(key, value);
  },
  removeItem: async (key) => {
    memoryStorage.delete(key);
  },
};

// =============================================================================
// PROBE LOGIC
// =============================================================================

/**
 * Test if a storage adapter works by doing a full write/read/delete cycle
 */
async function probeStorage(adapter: StorageAdapter): Promise<boolean> {
  try {
    // Write
    await adapter.setItem(PROBE_KEY, PROBE_VALUE);

    // Read back
    const readValue = await adapter.getItem(PROBE_KEY);
    if (readValue !== PROBE_VALUE) {
      return false;
    }

    // Clean up
    await adapter.removeItem(PROBE_KEY);

    // Verify deletion
    const afterDelete = await adapter.getItem(PROBE_KEY);
    if (afterDelete !== null) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Run storage probe and determine best available storage
 */
async function runStorageProbe(): Promise<StorageStatus> {
  const isWeb = Platform.OS === "web";

  // Web platform: try localStorage first
  if (isWeb) {
    const localStorageWorks = await probeStorage(localStorageAdapter);
    if (localStorageWorks) {
      return {
        type: "localStorage",
        isSecure: false, // localStorage is not encrypted
        isPersistent: true,
      };
    }

    // localStorage failed (private browsing?), fall to memory
    return {
      type: "memory",
      isSecure: false,
      isPersistent: false,
      probeError: "localStorage unavailable (private browsing?)",
    };
  }

  // Native platforms: try SecureStore first (encrypted)
  const secureStoreWorks = await probeStorage(secureStorageAdapter);
  if (secureStoreWorks) {
    return {
      type: "secure",
      isSecure: true,
      isPersistent: true,
    };
  }

  // SecureStore failed, try AsyncStorage (unencrypted but persistent)
  const asyncStorageWorks = await probeStorage(asyncStorageAdapter);
  if (asyncStorageWorks) {
    return {
      type: "async",
      isSecure: false,
      isPersistent: true,
      probeError: "SecureStore unavailable, using unencrypted storage",
    };
  }

  // All persistent storage failed, use memory
  return {
    type: "memory",
    isSecure: false,
    isPersistent: false,
    probeError: "All persistent storage unavailable",
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get current storage status (sync)
 * Returns null if probe hasn't completed yet
 */
export function getStorageStatus(): StorageStatus | null {
  return probeResult;
}

/**
 * Check if storage probe has completed
 */
export function isStorageProbeComplete(): boolean {
  return probeResult !== null;
}

/**
 * Get the appropriate storage adapter based on probe result
 * Must be called after probe completes
 */
function getActiveAdapter(): StorageAdapter {
  if (!probeResult) {
    // This shouldn't happen if used correctly, but fall back safely
    console.warn(
      "[StorageProbe] getActiveAdapter called before probe complete",
    );
    return memoryStorageAdapter;
  }

  switch (probeResult.type) {
    case "secure":
      return secureStorageAdapter;
    case "async":
      return asyncStorageAdapter;
    case "localStorage":
      return localStorageAdapter;
    case "memory":
      return memoryStorageAdapter;
  }
}

/**
 * Create a resilient storage adapter for Supabase auth
 *
 * This adapter:
 * 1. Waits for probe to complete before any operation
 * 2. Uses the best available storage based on probe result
 * 3. Never throws - falls back to memory on any error
 */
export function createResilientStorageAdapter(): StorageAdapter {
  return {
    getItem: async (key: string): Promise<string | null> => {
      // Wait for probe to complete
      await storageProbePromise;

      try {
        return await getActiveAdapter().getItem(key);
      } catch (error) {
        console.warn("[StorageProbe] getItem error, returning null:", error);
        return null;
      }
    },

    setItem: async (key: string, value: string): Promise<void> => {
      // Wait for probe to complete
      await storageProbePromise;

      try {
        await getActiveAdapter().setItem(key, value);
      } catch (error) {
        console.warn("[StorageProbe] setItem error:", error);
        // Fall back to memory for this value
        memoryStorage.set(key, value);
      }
    },

    removeItem: async (key: string): Promise<void> => {
      // Wait for probe to complete
      await storageProbePromise;

      try {
        await getActiveAdapter().removeItem(key);
      } catch (error) {
        console.warn("[StorageProbe] removeItem error:", error);
      }
      // Also remove from memory fallback
      memoryStorage.delete(key);
    },
  };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize storage probe
 * Called automatically on module load
 */
async function initializeStorageProbe(): Promise<void> {
  try {
    const status = await runStorageProbe();
    probeResult = status;

    // Log result for debugging
    if (status.isSecure) {
      console.log("[StorageProbe] Using SecureStore (encrypted)");
    } else if (status.isPersistent) {
      console.warn(
        `[StorageProbe] Using ${status.type} (unencrypted): ${status.probeError}`,
      );
    } else {
      console.error(
        `[StorageProbe] Using memory only (no persistence): ${status.probeError}`,
      );
    }

    // Resolve the promise so waiting adapters can proceed
    probePromiseResolver?.(status);
  } catch (error) {
    // Catastrophic failure - use memory
    const fallbackStatus: StorageStatus = {
      type: "memory",
      isSecure: false,
      isPersistent: false,
      probeError: `Probe failed: ${error}`,
    };
    probeResult = fallbackStatus;
    probePromiseResolver?.(fallbackStatus);
    console.error("[StorageProbe] Probe failed, using memory:", error);
  }
}

// Start probe immediately on module load
initializeStorageProbe();

// =============================================================================
// TEST HELPERS (only for testing)
// =============================================================================

/**
 * Reset probe state - FOR TESTING ONLY
 */
export function __resetProbeForTesting(): void {
  probeResult = null;
  memoryStorage.clear();
}

/**
 * Set probe result directly - FOR TESTING ONLY
 */
export function __setProbeResultForTesting(status: StorageStatus): void {
  probeResult = status;
}
