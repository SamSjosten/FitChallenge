// src/lib/__tests__/supabaseClient.test.ts
// Unit tests for getSupabaseClient guard function

/**
 * Tests for Issue #3: Supabase client guard function
 *
 * Verifies that getSupabaseClient() throws an explicit error when
 * configuration is invalid, ensuring fail-fast behavior regardless
 * of when/where the client is accessed.
 */

// =============================================================================
// MOCKS (must be before imports)
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios ?? obj.default),
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock storageProbe to avoid complex initialization
jest.mock("../storageProbe", () => ({
  createResilientStorageAdapter: jest.fn(() => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  })),
  getStorageStatus: jest.fn(() => ({
    type: "memory",
    isSecure: false,
    isPersistent: false,
  })),
  isStorageProbeComplete: jest.fn(() => true),
  storageProbePromise: Promise.resolve(),
  subscribeToStorageStatus: jest.fn(() => () => {}),
}));

// Track config validation state
let mockConfigIsValid = true;
let mockConfigMessage = "Test error message";

jest.mock("@/constants/config", () => ({
  Config: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test-key",
  },
  configValidation: {
    get isValid() {
      return mockConfigIsValid;
    },
    get message() {
      return mockConfigMessage;
    },
  },
}));

// Mock __DEV__ to be false so the module-level throw doesn't happen
// @ts-expect-error - global
global.__DEV__ = false;

// =============================================================================
// TESTS
// =============================================================================

describe("getSupabaseClient", () => {
  beforeEach(() => {
    jest.resetModules();
    mockConfigIsValid = true;
  });

  describe("when configuration is valid", () => {
    it("returns a Supabase client instance", () => {
      mockConfigIsValid = true;

      const { getSupabaseClient } = require("../supabase");
      const client = getSupabaseClient();

      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it("returns the same instance on subsequent calls (lazy singleton)", () => {
      mockConfigIsValid = true;

      const { getSupabaseClient } = require("../supabase");
      const client1 = getSupabaseClient();
      const client2 = getSupabaseClient();

      expect(client1).toBe(client2);
    });
  });

  describe("when configuration is invalid", () => {
    beforeEach(() => {
      // Suppress expected console.error from production logging
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("throws an explicit error with the config validation message", () => {
      mockConfigIsValid = false;
      mockConfigMessage = "Missing EXPO_PUBLIC_SUPABASE_URL";

      const { getSupabaseClient } = require("../supabase");

      expect(() => getSupabaseClient()).toThrow(
        "[FitChallenge] Supabase client unavailable: Missing EXPO_PUBLIC_SUPABASE_URL",
      );
    });

    it("includes the original validation message in the error", () => {
      mockConfigIsValid = false;
      mockConfigMessage = "Custom validation error";

      const { getSupabaseClient } = require("../supabase");

      expect(() => getSupabaseClient()).toThrow("Custom validation error");
    });
  });

  describe("supabaseConfigError export", () => {
    beforeEach(() => {
      // Suppress expected console.error from production logging
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("is null when configuration is valid", () => {
      mockConfigIsValid = true;

      const { supabaseConfigError } = require("../supabase");

      expect(supabaseConfigError).toBeNull();
    });

    it("contains the error message when configuration is invalid", () => {
      mockConfigIsValid = false;
      mockConfigMessage = "Missing environment variables";

      const { supabaseConfigError } = require("../supabase");

      expect(supabaseConfigError).toBe("Missing environment variables");
    });
  });
});

describe("helper functions with invalid config", () => {
  beforeEach(() => {
    jest.resetModules();
    mockConfigIsValid = false;
    mockConfigMessage = "Config invalid";
    // Suppress expected console.error from production logging
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requireUserId throws when config is invalid", async () => {
    const { requireUserId } = require("../supabase");

    await expect(requireUserId()).rejects.toThrow("[FitChallenge] Supabase client unavailable");
  });

  it("getUserId throws when config is invalid", async () => {
    const { getUserId } = require("../supabase");

    await expect(getUserId()).rejects.toThrow("[FitChallenge] Supabase client unavailable");
  });

  it("withAuth throws when config is invalid", async () => {
    const { withAuth } = require("../supabase");

    await expect(withAuth(async () => "test")).rejects.toThrow(
      "[FitChallenge] Supabase client unavailable",
    );
  });
});
