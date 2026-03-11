// src/lib/__tests__/invalidateAfterSync.test.ts
// M1: Tests for invalidateAfterSync helper
//
// Behavioral tests: mock queryClient, call helper, assert invalidation calls.
// Structural tests: read source files, assert wiring patterns.

// Mock offlineStore to prevent AsyncStorage/Zustand import chain failure in Node.
// Only the ProcessQueueResult type is needed (erased at compile time), but Jest
// resolves the full module path eagerly.
jest.mock("@/stores/offlineStore", () => ({}));

import { invalidateAfterSync } from "../invalidateAfterSync";
import type { ProcessQueueResult } from "@/stores/offlineStore";

// Minimal mock of QueryClient — only needs invalidateQueries
function createMockQueryClient() {
  return {
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
  } as unknown as import("@tanstack/react-query").QueryClient;
}

// =============================================================================
// BEHAVIORAL TESTS
// =============================================================================

describe("invalidateAfterSync", () => {
  let queryClient: ReturnType<typeof createMockQueryClient>;

  beforeEach(() => {
    queryClient = createMockQueryClient();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("invalidates challenge and activity keys when succeeded > 0", () => {
    const result: ProcessQueueResult = {
      processed: 2,
      succeeded: 2,
      failed: 0,
      remaining: 0,
    };

    const didInvalidate = invalidateAfterSync(result, queryClient);

    expect(didInvalidate).toBe(true);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["challenges"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activities"],
    });
  });

  test("skips invalidation when succeeded === 0 (empty queue)", () => {
    const result: ProcessQueueResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
    };

    const didInvalidate = invalidateAfterSync(result, queryClient);

    expect(didInvalidate).toBe(false);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  test("skips invalidation when succeeded === 0 (all failed)", () => {
    const result: ProcessQueueResult = {
      processed: 3,
      succeeded: 0,
      failed: 3,
      remaining: 3,
    };

    const didInvalidate = invalidateAfterSync(result, queryClient);

    expect(didInvalidate).toBe(false);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  test("skips invalidation for concurrent caller (isProcessing short-circuit)", () => {
    // When a second caller hits processQueue() while first is running,
    // the store returns succeeded: 0 — invalidation should be skipped
    const result: ProcessQueueResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 5,
    };

    const didInvalidate = invalidateAfterSync(result, queryClient);

    expect(didInvalidate).toBe(false);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  test("invalidates on partial success (some succeeded, some failed)", () => {
    const result: ProcessQueueResult = {
      processed: 5,
      succeeded: 3,
      failed: 2,
      remaining: 2,
    };

    const didInvalidate = invalidateAfterSync(result, queryClient);

    expect(didInvalidate).toBe(true);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  test("logs sync summary when invalidation triggers", () => {
    const result: ProcessQueueResult = {
      processed: 1,
      succeeded: 1,
      failed: 0,
      remaining: 0,
    };

    invalidateAfterSync(result, queryClient);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[OfflineSync]"),
    );
  });
});

// =============================================================================
// STRUCTURAL REGRESSION TESTS
// =============================================================================

describe("M1 structural verification", () => {
  const fs = require("fs");
  const path = require("path");

  // Resolve from project root (src/lib/__tests__/ → ../../.. → project root)
  const projectRoot = path.resolve(__dirname, "../../..");

  const readSource = (relativePath: string) =>
    fs.readFileSync(path.resolve(projectRoot, relativePath), "utf-8");

  test("useNetworkStatus imports and calls invalidateAfterSync", () => {
    const source = readSource("src/hooks/useNetworkStatus.ts");
    expect(source).toContain("invalidateAfterSync");
    expect(source).toContain("useQueryClient");
  });

  test("useOfflineQueue imports and calls invalidateAfterSync", () => {
    const source = readSource("src/hooks/useOfflineQueue.ts");
    expect(source).toContain("invalidateAfterSync");
    expect(source).toContain("useQueryClient");
  });

  test("_layout.tsx imports and calls invalidateAfterSync", () => {
    const source = readSource("app/_layout.tsx");
    expect(source).toContain("invalidateAfterSync");
  });

  test("OfflineIndicator uses useOfflineQueue hook, not direct store processQueue", () => {
    const source = readSource("src/components/OfflineIndicator.tsx");
    expect(source).toContain("useOfflineQueue");
    expect(source).toContain("processNow");
    // Should NOT have direct processQueue from store
    expect(source).not.toMatch(/useOfflineStore.*processQueue/s);
  });

  test("useChallenges.ts onSettled comments reference M1", () => {
    const source = readSource("src/hooks/useChallenges.ts");
    expect(source).toContain("M1");
  });
});
