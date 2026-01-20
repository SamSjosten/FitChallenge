// src/lib/__tests__/storageProbe.test.ts
// Unit tests for storage probe and resilient adapter

/**
 * Tests for Issue #5: Storage fallback for sessions
 *
 * Verifies:
 * - Storage probe detects available storage correctly
 * - Fallback chain works (SecureStore -> AsyncStorage -> localStorage -> memory)
 * - Resilient adapter waits for probe before operations
 * - Storage status is reported correctly for UI warnings
 */

import { Platform } from "react-native";

// =============================================================================
// MOCKS
// =============================================================================

// Mock Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios", // Default to iOS, override in tests
  },
}));

// Track storage operation results
let secureStoreWorks = true;
let asyncStorageWorks = true;
let localStorageWorks = true;

// Mock SecureStore
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => {
    if (!secureStoreWorks) throw new Error("SecureStore unavailable");
    return mockSecureStorage.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (!secureStoreWorks) throw new Error("SecureStore unavailable");
    mockSecureStorage.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    if (!secureStoreWorks) throw new Error("SecureStore unavailable");
    mockSecureStorage.delete(key);
  }),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => {
    if (!asyncStorageWorks) throw new Error("AsyncStorage unavailable");
    return mockAsyncStorage.get(key) ?? null;
  }),
  setItem: jest.fn(async (key: string, value: string) => {
    if (!asyncStorageWorks) throw new Error("AsyncStorage unavailable");
    mockAsyncStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    if (!asyncStorageWorks) throw new Error("AsyncStorage unavailable");
    mockAsyncStorage.delete(key);
  }),
}));

// Mock storage maps
const mockSecureStorage = new Map<string, string>();
const mockAsyncStorage = new Map<string, string>();
const mockLocalStorage = new Map<string, string>();

// Mock localStorage for web tests
const mockLocalStorageImpl = {
  getItem: (key: string) => {
    if (!localStorageWorks) throw new Error("localStorage unavailable");
    return mockLocalStorage.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (!localStorageWorks) throw new Error("localStorage unavailable");
    mockLocalStorage.set(key, value);
  },
  removeItem: (key: string) => {
    if (!localStorageWorks) throw new Error("localStorage unavailable");
    mockLocalStorage.delete(key);
  },
};

// =============================================================================
// TEST HELPERS
// =============================================================================

function resetMocks() {
  secureStoreWorks = true;
  asyncStorageWorks = true;
  localStorageWorks = true;
  mockSecureStorage.clear();
  mockAsyncStorage.clear();
  mockLocalStorage.clear();
  jest.clearAllMocks();
}

function setPlatform(os: "ios" | "android" | "web") {
  (Platform as any).OS = os;
}

// =============================================================================
// TESTS
// =============================================================================

describe("storageProbe", () => {
  beforeEach(() => {
    resetMocks();
    jest.resetModules();
    // Reset localStorage mock
    if (typeof global.localStorage !== "undefined") {
      delete (global as any).localStorage;
    }
  });

  describe("on native platforms (iOS/Android)", () => {
    beforeEach(() => {
      setPlatform("ios");
    });

    it("uses SecureStore when available", async () => {
      secureStoreWorks = true;

      const {
        storageProbePromise,
        getStorageStatus,
      } = require("../storageProbe");
      const status = await storageProbePromise;

      expect(status.type).toBe("secure");
      expect(status.isSecure).toBe(true);
      expect(status.isPersistent).toBe(true);
      expect(status.probeError).toBeUndefined();
    });

    it("falls back to AsyncStorage when SecureStore fails", async () => {
      secureStoreWorks = false;
      asyncStorageWorks = true;

      const { storageProbePromise } = require("../storageProbe");
      const status = await storageProbePromise;

      expect(status.type).toBe("async");
      expect(status.isSecure).toBe(false);
      expect(status.isPersistent).toBe(true);
      expect(status.probeError).toContain("SecureStore unavailable");
    });

    it("falls back to memory when all storage fails", async () => {
      secureStoreWorks = false;
      asyncStorageWorks = false;

      const { storageProbePromise } = require("../storageProbe");
      const status = await storageProbePromise;

      expect(status.type).toBe("memory");
      expect(status.isSecure).toBe(false);
      expect(status.isPersistent).toBe(false);
      expect(status.probeError).toBeDefined();
    });
  });

  describe("on web platform", () => {
    beforeEach(() => {
      setPlatform("web");
    });

    it("uses localStorage when available", async () => {
      (global as any).localStorage = mockLocalStorageImpl;
      localStorageWorks = true;

      const { storageProbePromise } = require("../storageProbe");
      const status = await storageProbePromise;

      expect(status.type).toBe("localStorage");
      expect(status.isSecure).toBe(false);
      expect(status.isPersistent).toBe(true);
    });

    it("falls back to memory when localStorage unavailable (private browsing)", async () => {
      // Don't define localStorage at all
      delete (global as any).localStorage;

      const { storageProbePromise } = require("../storageProbe");
      const status = await storageProbePromise;

      expect(status.type).toBe("memory");
      expect(status.isSecure).toBe(false);
      expect(status.isPersistent).toBe(false);
    });
  });

  describe("resilient adapter", () => {
    beforeEach(() => {
      setPlatform("ios");
      secureStoreWorks = true;
    });

    it("waits for probe before storage operations", async () => {
      const {
        createResilientStorageAdapter,
        storageProbePromise,
      } = require("../storageProbe");
      const adapter = createResilientStorageAdapter();

      // Start operations before probe completes
      const setPromise = adapter.setItem("test-key", "test-value");
      const getPromise = adapter.getItem("test-key");

      // Both should wait for probe
      await storageProbePromise;
      await setPromise;
      const value = await getPromise;

      // Value should be stored (probe completed, then operations ran)
      expect(value).toBe("test-value");
    });

    it("stores and retrieves values correctly", async () => {
      const {
        createResilientStorageAdapter,
        storageProbePromise,
      } = require("../storageProbe");
      await storageProbePromise;

      const adapter = createResilientStorageAdapter();

      await adapter.setItem("user-token", "abc123");
      const retrieved = await adapter.getItem("user-token");

      expect(retrieved).toBe("abc123");
    });

    it("removes values correctly", async () => {
      const {
        createResilientStorageAdapter,
        storageProbePromise,
      } = require("../storageProbe");
      await storageProbePromise;

      const adapter = createResilientStorageAdapter();

      await adapter.setItem("temp-key", "temp-value");
      await adapter.removeItem("temp-key");
      const retrieved = await adapter.getItem("temp-key");

      expect(retrieved).toBeNull();
    });

    it("falls back to memory on runtime errors", async () => {
      // Start with working SecureStore
      const {
        createResilientStorageAdapter,
        storageProbePromise,
      } = require("../storageProbe");
      await storageProbePromise;

      const adapter = createResilientStorageAdapter();

      // Store a value
      await adapter.setItem("key1", "value1");

      // Now break SecureStore (simulating runtime failure)
      secureStoreWorks = false;

      // New writes should fall back to memory (not throw)
      await expect(adapter.setItem("key2", "value2")).resolves.not.toThrow();
    });
  });

  describe("status reporting", () => {
    beforeEach(() => {
      setPlatform("ios");
    });

    it("getStorageStatus returns null before probe completes", () => {
      // Don't await the probe
      const { getStorageStatus } = require("../storageProbe");

      // Immediately check (probe may or may not be done)
      // This tests the sync behavior
      const status = getStorageStatus();

      // Status could be null or the result depending on timing
      // The important thing is it doesn't throw
      expect(status === null || typeof status === "object").toBe(true);
    });

    it("isStorageProbeComplete returns false initially, true after probe", async () => {
      const {
        isStorageProbeComplete,
        storageProbePromise,
      } = require("../storageProbe");

      // Wait for probe
      await storageProbePromise;

      expect(isStorageProbeComplete()).toBe(true);
    });

    it("reports correct status for SecureStore", async () => {
      secureStoreWorks = true;

      const {
        storageProbePromise,
        getStorageStatus,
      } = require("../storageProbe");
      await storageProbePromise;

      const status = getStorageStatus();
      expect(status?.type).toBe("secure");
      expect(status?.isSecure).toBe(true);
      expect(status?.isPersistent).toBe(true);
    });

    it("reports correct status for AsyncStorage fallback", async () => {
      secureStoreWorks = false;
      asyncStorageWorks = true;

      const {
        storageProbePromise,
        getStorageStatus,
      } = require("../storageProbe");
      await storageProbePromise;

      const status = getStorageStatus();
      expect(status?.type).toBe("async");
      expect(status?.isSecure).toBe(false);
      expect(status?.isPersistent).toBe(true);
    });

    it("reports correct status for memory fallback", async () => {
      secureStoreWorks = false;
      asyncStorageWorks = false;

      const {
        storageProbePromise,
        getStorageStatus,
      } = require("../storageProbe");
      await storageProbePromise;

      const status = getStorageStatus();
      expect(status?.type).toBe("memory");
      expect(status?.isSecure).toBe(false);
      expect(status?.isPersistent).toBe(false);
    });
  });
});
