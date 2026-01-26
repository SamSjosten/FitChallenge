// src/lib/hybridStorage.ts
// Hybrid storage adapter that encrypts large payloads for secure persistence
//
// Problem: SecureStore has a 2KB limit per key, but Supabase sessions can exceed this
// Solution: Store encryption key in SecureStore (small), encrypted payload in AsyncStorage
//
// Security model:
// - Encryption key (32 bytes = 256-bit AES key) stored in SecureStore (Keychain/Keystore)
// - Encrypted session payload stored in AsyncStorage (no size limit)
// - AES-256-CTR encryption via aes-js (pure JavaScript, React Native compatible)
// - Random counter for each encryption (stored with ciphertext)
// - Key rotation on each new session (login)
//
// Fallback chain:
// - If SecureStore unavailable: AsyncStorage unencrypted (with UI warning)
// - If AsyncStorage unavailable: Memory only (session-only)

import "react-native-get-random-values"; // Must be imported before aes-js for crypto.getRandomValues
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";

// =============================================================================
// TYPES
// =============================================================================

export type HybridStorageMode =
  | "hybrid-encrypted" // SecureStore (key) + AsyncStorage (encrypted payload)
  | "async-unencrypted" // AsyncStorage only (SecureStore unavailable)
  | "localStorage" // Web platform
  | "memory"; // Last resort fallback

export interface HybridStorageStatus {
  mode: HybridStorageMode;
  isEncrypted: boolean;
  isPersistent: boolean;
  error?: string;
  degradedAt?: number;
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export type HybridStorageStatusListener = (status: HybridStorageStatus) => void;

// =============================================================================
// CONSTANTS
// =============================================================================

// Storage key prefixes
const KEY_PREFIX = "fitchallenge_hybrid_";
const ENC_KEY_PREFIX = `${KEY_PREFIX}key_`; // Encryption key in SecureStore
const PAYLOAD_PREFIX = `${KEY_PREFIX}payload_`; // Encrypted payload in AsyncStorage
const LEGACY_PREFIX = "sb-"; // Supabase's default key prefix for migration

// Probe key for testing storage availability
const PROBE_KEY = "__fitchallenge_hybrid_probe__";
const PROBE_VALUE = "probe_test";

// AES-256 key length (32 bytes = 256 bits)
const KEY_LENGTH = 32;

// CTR counter length (16 bytes for AES block size)
const COUNTER_LENGTH = 16;

// Failure thresholds
const FAILURE_THRESHOLD = 2;

// =============================================================================
// STATE
// =============================================================================

let storageStatus: HybridStorageStatus | null = null;
let statusResolver: ((status: HybridStorageStatus) => void) | null = null;
let consecutiveFailures = 0;
let isInitializing = false;

// In-memory fallback
const memoryStorage = new Map<string, string>();

// Status listeners
const statusListeners = new Set<HybridStorageStatusListener>();

// Promise that resolves when initialization completes
export const hybridStorageReady: Promise<HybridStorageStatus> = new Promise(
  (resolve) => {
    statusResolver = resolve;
  },
);

// =============================================================================
// CRYPTO UTILITIES (AES-256-CTR via aes-js)
// =============================================================================

/**
 * Generate a cryptographically secure random key (256-bit for AES-256)
 */
function generateEncryptionKey(): Uint8Array {
  const key = new Uint8Array(KEY_LENGTH);
  // crypto.getRandomValues is polyfilled by react-native-get-random-values
  crypto.getRandomValues(key);
  return key;
}

/**
 * Generate a random counter/nonce for CTR mode
 */
function generateCounter(): Uint8Array {
  const counter = new Uint8Array(COUNTER_LENGTH);
  crypto.getRandomValues(counter);
  return counter;
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return aesjs.utils.hex.fromBytes(bytes);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  return aesjs.utils.hex.toBytes(hex);
}

/**
 * Encrypt plaintext using AES-256-CTR
 * Returns hex string: counter (32 hex chars = 16 bytes) + ciphertext
 */
function encrypt(plaintext: string, keyBytes: Uint8Array): string {
  // Convert plaintext to bytes using TextEncoder for proper UTF-8 handling
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(plaintext);

  // Generate random counter for this encryption
  const counter = generateCounter();

  // Create AES-CTR cipher
  const aesCtr = new aesjs.ModeOfOperation.ctr(
    keyBytes,
    new aesjs.Counter(counter),
  );

  // Encrypt
  const encryptedBytes = aesCtr.encrypt(textBytes);

  // Combine counter + ciphertext as hex
  const counterHex = uint8ArrayToHex(counter);
  const ciphertextHex = uint8ArrayToHex(encryptedBytes);

  return counterHex + ciphertextHex;
}

/**
 * Decrypt ciphertext using AES-256-CTR
 * Expects hex string: counter (32 hex chars) + ciphertext
 */
function decrypt(encryptedHex: string, keyBytes: Uint8Array): string {
  // Extract counter (first 32 hex chars = 16 bytes)
  const counterHex = encryptedHex.slice(0, COUNTER_LENGTH * 2);
  const ciphertextHex = encryptedHex.slice(COUNTER_LENGTH * 2);

  // Convert from hex
  const counter = hexToUint8Array(counterHex);
  const ciphertext = hexToUint8Array(ciphertextHex);

  // Create AES-CTR cipher with same counter
  const aesCtr = new aesjs.ModeOfOperation.ctr(
    keyBytes,
    new aesjs.Counter(counter),
  );

  // Decrypt
  const decryptedBytes = aesCtr.decrypt(ciphertext);

  // Convert back to string using TextDecoder for proper UTF-8 handling
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}

// =============================================================================
// STORAGE KEY HELPERS
// =============================================================================

/**
 * Get the SecureStore key name for an encryption key
 */
function getEncKeyName(originalKey: string): string {
  return `${ENC_KEY_PREFIX}${hashKey(originalKey)}`;
}

/**
 * Get the AsyncStorage key name for an encrypted payload
 */
function getPayloadKeyName(originalKey: string): string {
  return `${PAYLOAD_PREFIX}${hashKey(originalKey)}`;
}

/**
 * Simple hash for key derivation (not cryptographic, just for naming)
 * Uses djb2 algorithm for fast, deterministic hashing
 */
function hashKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16);
}

// =============================================================================
// STORAGE PROBING
// =============================================================================

/**
 * Test if SecureStore is available and working
 */
async function probeSecureStore(): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(PROBE_KEY, PROBE_VALUE);
    const read = await SecureStore.getItemAsync(PROBE_KEY);
    await SecureStore.deleteItemAsync(PROBE_KEY);
    return read === PROBE_VALUE;
  } catch {
    return false;
  }
}

/**
 * Test if AsyncStorage is available and working
 */
async function probeAsyncStorage(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PROBE_KEY, PROBE_VALUE);
    const read = await AsyncStorage.getItem(PROBE_KEY);
    await AsyncStorage.removeItem(PROBE_KEY);
    return read === PROBE_VALUE;
  } catch {
    return false;
  }
}

/**
 * Test if localStorage is available (web platform)
 */
async function probeLocalStorage(): Promise<boolean> {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(PROBE_KEY, PROBE_VALUE);
    const read = localStorage.getItem(PROBE_KEY);
    localStorage.removeItem(PROBE_KEY);
    return read === PROBE_VALUE;
  } catch {
    return false;
  }
}

// =============================================================================
// MIGRATION
// =============================================================================

/**
 * Check for and migrate legacy Supabase session from old storage format
 * Returns the migrated value if found, null otherwise
 */
async function migrateLegacySession(
  originalKey: string,
): Promise<string | null> {
  // Only attempt migration for Supabase auth keys
  if (!originalKey.startsWith(LEGACY_PREFIX)) {
    return null;
  }

  try {
    // Try to read from SecureStore (old format)
    const legacyValue = await SecureStore.getItemAsync(originalKey);
    if (legacyValue) {
      console.log(
        "[HybridStorage] Found legacy session in SecureStore, migrating...",
      );

      // Clear the legacy key (best effort)
      try {
        await SecureStore.deleteItemAsync(originalKey);
      } catch {
        console.warn("[HybridStorage] Could not delete legacy key");
      }

      return legacyValue;
    }

    // Also check AsyncStorage (might have been demoted previously)
    const asyncValue = await AsyncStorage.getItem(originalKey);
    if (asyncValue) {
      console.log(
        "[HybridStorage] Found legacy session in AsyncStorage, migrating...",
      );

      // Clear the legacy key
      try {
        await AsyncStorage.removeItem(originalKey);
      } catch {
        console.warn(
          "[HybridStorage] Could not delete legacy AsyncStorage key",
        );
      }

      return asyncValue;
    }
  } catch (error) {
    console.warn("[HybridStorage] Migration check failed:", error);
  }

  return null;
}

// =============================================================================
// CORE STORAGE OPERATIONS
// =============================================================================

/**
 * Store a value using hybrid AES-encrypted storage
 */
async function setItemHybridEncrypted(
  key: string,
  value: string,
): Promise<void> {
  const encKeyName = getEncKeyName(key);
  const payloadKeyName = getPayloadKeyName(key);

  // Generate new encryption key (256-bit for AES-256)
  const encKey = generateEncryptionKey();
  const encKeyHex = uint8ArrayToHex(encKey);

  // Encrypt the value using AES-256-CTR
  const encrypted = encrypt(value, encKey);

  // Store encrypted payload first (if this fails, no key is stored)
  await AsyncStorage.setItem(payloadKeyName, encrypted);

  // Store encryption key in SecureStore
  // Key is 64 hex chars (32 bytes), well under 2KB limit
  await SecureStore.setItemAsync(encKeyName, encKeyHex);
}

/**
 * Retrieve a value from hybrid AES-encrypted storage
 */
async function getItemHybridEncrypted(key: string): Promise<string | null> {
  const encKeyName = getEncKeyName(key);
  const payloadKeyName = getPayloadKeyName(key);

  console.log(
    `[HybridStorage] getItemHybridEncrypted: encKeyName=${encKeyName}`,
  );
  console.log(
    `[HybridStorage] getItemHybridEncrypted: payloadKeyName=${payloadKeyName}`,
  );

  // Get encryption key from SecureStore
  const encKeyHex = await SecureStore.getItemAsync(encKeyName);
  console.log(
    `[HybridStorage] getItemHybridEncrypted: encKeyHex=${encKeyHex ? "found" : "null"}`,
  );

  if (!encKeyHex) {
    // No key means no data (or data was cleared)
    return null;
  }

  // Get encrypted payload from AsyncStorage
  const encrypted = await AsyncStorage.getItem(payloadKeyName);
  console.log(
    `[HybridStorage] getItemHybridEncrypted: encrypted payload=${encrypted ? `${encrypted.length} chars` : "null"}`,
  );

  if (!encrypted) {
    // Payload missing but key exists - inconsistent state, clean up
    console.warn("[HybridStorage] Payload missing, cleaning up orphaned key");
    try {
      await SecureStore.deleteItemAsync(encKeyName);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }

  // Decrypt using AES-256-CTR
  console.log(`[HybridStorage] getItemHybridEncrypted: decrypting...`);
  const encKey = hexToUint8Array(encKeyHex);
  const decrypted = decrypt(encrypted, encKey);
  console.log(
    `[HybridStorage] getItemHybridEncrypted: decrypted=${decrypted ? `${decrypted.length} chars` : "null"}`,
  );
  return decrypted;
}

/**
 * Remove a value from hybrid storage
 */
async function removeItemHybrid(key: string): Promise<void> {
  const encKeyName = getEncKeyName(key);
  const payloadKeyName = getPayloadKeyName(key);

  // Remove both parts (best effort)
  const errors: Error[] = [];

  try {
    await SecureStore.deleteItemAsync(encKeyName);
  } catch (error) {
    errors.push(error as Error);
  }

  try {
    await AsyncStorage.removeItem(payloadKeyName);
  } catch (error) {
    errors.push(error as Error);
  }

  if (errors.length === 2) {
    // Both failed, might be a real problem
    console.warn("[HybridStorage] Failed to remove item:", errors);
  }
}

/**
 * Store a value in AsyncStorage (unencrypted fallback)
 */
async function setItemAsyncUnencrypted(
  key: string,
  value: string,
): Promise<void> {
  const payloadKeyName = getPayloadKeyName(key);
  await AsyncStorage.setItem(payloadKeyName, value);
}

/**
 * Retrieve a value from AsyncStorage (unencrypted fallback)
 */
async function getItemAsyncUnencrypted(key: string): Promise<string | null> {
  const payloadKeyName = getPayloadKeyName(key);
  return await AsyncStorage.getItem(payloadKeyName);
}

/**
 * Remove a value from AsyncStorage (unencrypted fallback)
 */
async function removeItemAsyncUnencrypted(key: string): Promise<void> {
  const payloadKeyName = getPayloadKeyName(key);
  await AsyncStorage.removeItem(payloadKeyName);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize hybrid storage and determine best available mode
 */
async function initializeHybridStorage(): Promise<HybridStorageStatus> {
  if (isInitializing) {
    return hybridStorageReady;
  }
  isInitializing = true;

  const isWeb = Platform.OS === "web";

  // Web platform: use localStorage
  if (isWeb) {
    const localStorageWorks = await probeLocalStorage();
    if (localStorageWorks) {
      return {
        mode: "localStorage",
        isEncrypted: false,
        isPersistent: true,
      };
    }

    return {
      mode: "memory",
      isEncrypted: false,
      isPersistent: false,
      error: "localStorage unavailable (private browsing?)",
    };
  }

  // Native platforms: try hybrid encrypted first
  const secureStoreWorks = await probeSecureStore();
  const asyncStorageWorks = await probeAsyncStorage();

  if (secureStoreWorks && asyncStorageWorks) {
    return {
      mode: "hybrid-encrypted",
      isEncrypted: true,
      isPersistent: true,
    };
  }

  if (asyncStorageWorks) {
    return {
      mode: "async-unencrypted",
      isEncrypted: false,
      isPersistent: true,
      error: "SecureStore unavailable, using unencrypted storage",
    };
  }

  return {
    mode: "memory",
    isEncrypted: false,
    isPersistent: false,
    error: "All persistent storage unavailable",
  };
}

/**
 * Start initialization on module load
 */
async function startInitialization(): Promise<void> {
  try {
    const status = await initializeHybridStorage();
    storageStatus = status;

    // Log status
    if (status.mode === "hybrid-encrypted") {
      console.log("[HybridStorage] Using AES-256-CTR encrypted storage");
    } else if (status.isPersistent) {
      console.warn(
        `[HybridStorage] Using ${status.mode}: ${status.error || "no encryption"}`,
      );
    } else {
      console.error(
        `[HybridStorage] Using memory only: ${status.error || "no persistence"}`,
      );
    }

    statusResolver?.(status);
  } catch (error) {
    const fallbackStatus: HybridStorageStatus = {
      mode: "memory",
      isEncrypted: false,
      isPersistent: false,
      error: `Initialization failed: ${error}`,
    };
    storageStatus = fallbackStatus;
    statusResolver?.(fallbackStatus);
    console.error("[HybridStorage] Initialization failed:", error);
  }
}

// Start initialization
startInitialization();

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get current storage status (sync)
 */
export function getHybridStorageStatus(): HybridStorageStatus | null {
  return storageStatus;
}

/**
 * Check if hybrid storage initialization is complete
 */
export function isHybridStorageReady(): boolean {
  return storageStatus !== null;
}

/**
 * Subscribe to storage status changes
 */
export function subscribeToHybridStorageStatus(
  listener: HybridStorageStatusListener,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Notify listeners of status change
 */
function notifyStatusListeners(status: HybridStorageStatus): void {
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (error) {
      console.warn("[HybridStorage] Listener error:", error);
    }
  });
}

/**
 * Demote from hybrid-encrypted to async-unencrypted after failures
 */
async function demoteToUnencrypted(
  key: string,
  value: string,
): Promise<boolean> {
  try {
    // Verify AsyncStorage works
    const asyncWorks = await probeAsyncStorage();
    if (!asyncWorks) {
      console.error("[HybridStorage] AsyncStorage also unavailable");
      memoryStorage.set(key, value);
      return false;
    }

    // Write unencrypted
    await setItemAsyncUnencrypted(key, value);

    // Clean up any existing encrypted data
    try {
      await removeItemHybrid(key);
    } catch {
      // Ignore cleanup errors
    }

    // Migrate memory values
    for (const [memKey, memValue] of memoryStorage) {
      try {
        await setItemAsyncUnencrypted(memKey, memValue);
      } catch {
        console.warn("[HybridStorage] Failed to migrate key:", memKey);
      }
    }
    memoryStorage.clear();

    // Update status
    const newStatus: HybridStorageStatus = {
      mode: "async-unencrypted",
      isEncrypted: false,
      isPersistent: true,
      error: "Encryption failed mid-session, demoted to unencrypted storage",
      degradedAt: Date.now(),
    };
    storageStatus = newStatus;

    console.warn("[HybridStorage] Demoted to unencrypted AsyncStorage");
    notifyStatusListeners(newStatus);

    return true;
  } catch (error) {
    console.error("[HybridStorage] Demotion failed:", error);
    memoryStorage.set(key, value);
    return false;
  }
}

/**
 * Create a hybrid storage adapter for Supabase auth
 *
 * This adapter:
 * 1. Waits for initialization before any operation
 * 2. Uses AES-256-CTR encrypted storage when available
 * 3. Falls back gracefully: async-unencrypted → memory
 * 4. Migrates legacy sessions automatically
 */
export function createHybridStorageAdapter(): StorageAdapter {
  return {
    getItem: async (key: string): Promise<string | null> => {
      console.log(
        `[HybridStorage] getItem called for key: ${key.substring(0, 30)}...`,
      );

      await hybridStorageReady;
      console.log(
        `[HybridStorage] getItem: storage ready, mode=${storageStatus?.mode}`,
      );

      try {
        // Check for legacy migration first
        const legacyValue = await migrateLegacySession(key);
        if (legacyValue) {
          console.log(
            `[HybridStorage] getItem: found legacy session, migrating`,
          );
          // Store in new format and return
          try {
            await createHybridStorageAdapter().setItem(key, legacyValue);
          } catch {
            // Migration storage failed, but we have the value
            console.warn("[HybridStorage] Could not store migrated session");
          }
          consecutiveFailures = 0;
          return legacyValue;
        }

        let value: string | null = null;

        switch (storageStatus?.mode) {
          case "hybrid-encrypted":
            console.log(
              `[HybridStorage] getItem: reading from hybrid-encrypted`,
            );
            value = await getItemHybridEncrypted(key);
            console.log(
              `[HybridStorage] getItem: got value=${value ? "yes" : "null"}`,
            );
            break;
          case "async-unencrypted":
            value = await getItemAsyncUnencrypted(key);
            break;
          case "localStorage":
            value = localStorage.getItem(getPayloadKeyName(key));
            break;
          case "memory":
            value = memoryStorage.get(key) ?? null;
            break;
        }

        consecutiveFailures = 0;
        return value;
      } catch (error) {
        console.warn("[HybridStorage] getItem error:", error);

        // Try memory fallback
        const memValue = memoryStorage.get(key);
        if (memValue !== undefined) {
          return memValue;
        }

        return null;
      }
    },

    setItem: async (key: string, value: string): Promise<void> => {
      console.log(
        `[HybridStorage] setItem called for key: ${key.substring(0, 30)}... (${value.length} chars)`,
      );

      await hybridStorageReady;
      console.log(
        `[HybridStorage] setItem: storage ready, mode=${storageStatus?.mode}`,
      );

      try {
        switch (storageStatus?.mode) {
          case "hybrid-encrypted":
            console.log(`[HybridStorage] setItem: writing to hybrid-encrypted`);
            await setItemHybridEncrypted(key, value);
            console.log(`[HybridStorage] setItem: write complete`);
            break;
          case "async-unencrypted":
            await setItemAsyncUnencrypted(key, value);
            break;
          case "localStorage":
            localStorage.setItem(getPayloadKeyName(key), value);
            break;
          case "memory":
            memoryStorage.set(key, value);
            break;
        }

        consecutiveFailures = 0;
      } catch (error) {
        console.warn("[HybridStorage] setItem error:", error);
        consecutiveFailures++;

        // Try to demote if using hybrid-encrypted
        if (
          storageStatus?.mode === "hybrid-encrypted" &&
          consecutiveFailures >= FAILURE_THRESHOLD
        ) {
          console.warn(
            `[HybridStorage] Encryption failed ${consecutiveFailures} times, demoting`,
          );
          const demoted = await demoteToUnencrypted(key, value);
          if (demoted) {
            consecutiveFailures = 0;
            return;
          }
        }

        // Fall back to memory
        memoryStorage.set(key, value);
      }
    },

    removeItem: async (key: string): Promise<void> => {
      await hybridStorageReady;

      try {
        switch (storageStatus?.mode) {
          case "hybrid-encrypted":
            await removeItemHybrid(key);
            break;
          case "async-unencrypted":
            await removeItemAsyncUnencrypted(key);
            break;
          case "localStorage":
            localStorage.removeItem(getPayloadKeyName(key));
            break;
          case "memory":
            // Just remove from memory below
            break;
        }

        consecutiveFailures = 0;
      } catch (error) {
        console.warn("[HybridStorage] removeItem error:", error);
        // Don't increment failures for remove - not critical
      }

      // Always clear from memory as well
      memoryStorage.delete(key);
    },
  };
}

// =============================================================================
// TEST HELPERS (only for testing)
// =============================================================================

/**
 * Reset storage state - FOR TESTING ONLY
 */
export function __resetHybridStorageForTesting(): void {
  storageStatus = null;
  memoryStorage.clear();
  consecutiveFailures = 0;
  isInitializing = false;
  statusListeners.clear();
}

/**
 * Set storage status directly - FOR TESTING ONLY
 */
export function __setHybridStorageStatusForTesting(
  status: HybridStorageStatus,
): void {
  storageStatus = status;
}

/**
 * Get memory storage contents - FOR TESTING ONLY
 */
export function __getMemoryStorageForTesting(): Map<string, string> {
  return new Map(memoryStorage);
}

/**
 * Export crypto utilities for testing - FOR TESTING ONLY
 */
export const __cryptoForTesting = {
  encrypt,
  decrypt,
  generateEncryptionKey,
  uint8ArrayToHex,
  hexToUint8Array,
};
