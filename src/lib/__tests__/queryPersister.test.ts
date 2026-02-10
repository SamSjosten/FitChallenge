// src/lib/__tests__/queryPersister.test.ts
// Unit tests for query cache persistence configuration

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPersistedQueryCache, persistOptions } from "../queryPersister";

describe("Query Persister Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("persistOptions", () => {
    it("has a 24-hour maxAge", () => {
      expect(persistOptions.maxAge).toBe(1000 * 60 * 60 * 24);
    });

    it("has a persister configured", () => {
      expect(persistOptions.persister).toBeDefined();
    });

    it("has dehydrateOptions configured", () => {
      expect(persistOptions.dehydrateOptions).toBeDefined();
      expect(persistOptions.dehydrateOptions?.shouldDehydrateQuery).toBeInstanceOf(Function);
    });
  });

  describe("shouldDehydrateQuery", () => {
    const shouldDehydrate = persistOptions.dehydrateOptions!.shouldDehydrateQuery!;

    it("includes successful challenges queries", () => {
      const mockQuery = {
        state: { status: "success" },
        queryKey: ["challenges", "active"],
      };
      expect(shouldDehydrate(mockQuery as any)).toBe(true);
    });

    it("includes successful friends queries", () => {
      const mockQuery = {
        state: { status: "success" },
        queryKey: ["friends", "user-123"],
      };
      expect(shouldDehydrate(mockQuery as any)).toBe(true);
    });

    it("includes successful leaderboard queries", () => {
      const mockQuery = {
        state: { status: "success" },
        queryKey: ["challenges", "leaderboard", "challenge-123"],
      };
      expect(shouldDehydrate(mockQuery as any)).toBe(true);
    });

    it("excludes notifications queries", () => {
      const mockQuery = {
        state: { status: "success" },
        queryKey: ["notifications", "user-123"],
      };
      expect(shouldDehydrate(mockQuery as any)).toBe(false);
    });

    it("excludes non-successful queries", () => {
      const mockQuery = {
        state: { status: "pending" },
        queryKey: ["challenges", "active"],
      };
      expect(shouldDehydrate(mockQuery as any)).toBe(false);
    });

    it("excludes error queries", () => {
      const mockQuery = {
        state: { status: "error" },
        queryKey: ["challenges", "active"],
      };
      expect(shouldDehydrate(mockQuery as any)).toBe(false);
    });
  });

  describe("clearPersistedQueryCache", () => {
    it("removes the cache key from AsyncStorage", async () => {
      await clearPersistedQueryCache();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("FITCHALLENGE_QUERY_CACHE");
    });

    it("logs success message", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await clearPersistedQueryCache();

      expect(consoleSpy).toHaveBeenCalledWith("[QueryPersister] Cache cleared");
      consoleSpy.mockRestore();
    });

    it("handles errors gracefully", async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error("Storage error"));
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      await clearPersistedQueryCache();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[QueryPersister] Failed to clear cache:",
        expect.any(Error),
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
