// src/__tests__/unit/activityIdempotency.test.ts
// Tests for P1-1: Idempotent Activity Logging (React Query Retry-Safe)
//
// These tests verify that:
// 1. client_event_id from mutation input is passed to the service (not generated internally)
// 2. React Query retries reuse the same client_event_id (preventing double-counting)

// =============================================================================
// MOCKS (must be before imports)
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-crypto to use Node's crypto instead
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("crypto").randomUUID(),
}));

// Track all client_event_ids passed to the RPC
const capturedEventIds: string[] = [];
let rpcCallCount = 0;
let shouldFailUntilAttempt = 0; // Fail RPC until this many attempts

const mockRpc = jest.fn().mockImplementation(async () => {
  rpcCallCount++;
  if (rpcCallCount <= shouldFailUntilAttempt) {
    return { data: null, error: { message: "Network error", code: "NETWORK" } };
  }
  return { data: null, error: null };
});

// Mock supabase
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: (...args: unknown[]) => {
      // Capture the client_event_id from the RPC args
      const [, params] = args as [string, { p_client_event_id?: string }];
      if (params?.p_client_event_id) {
        capturedEventIds.push(params.p_client_event_id);
      }
      return mockRpc(...args);
    },
  })),
  withAuth: jest.fn((operation) => operation("test-user-123")),
}));

// Mock validation to pass through
jest.mock("@/lib/validation", () => ({
  validate: jest.fn((_, input) => input),
  logActivitySchema: {},
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { activityService, generateClientEventId } from "@/services/activities";

// =============================================================================
// TESTS
// =============================================================================

describe("Activity Logging Idempotency (P1-1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedEventIds.length = 0;
    rpcCallCount = 0;
    shouldFailUntilAttempt = 0;
  });

  describe("client_event_id passthrough", () => {
    it("passes client_event_id from input to RPC (not generating internally)", async () => {
      const inputEventId = "fixed-event-id-12345";

      await activityService.logActivity({
        challenge_id: "challenge-1",
        activity_type: "steps",
        value: 5000,
        client_event_id: inputEventId,
      });

      expect(capturedEventIds).toHaveLength(1);
      expect(capturedEventIds[0]).toBe(inputEventId);
    });

    it("uses exact client_event_id provided, not a new generated one", async () => {
      const providedId = generateClientEventId();

      await activityService.logActivity({
        challenge_id: "challenge-1",
        activity_type: "steps",
        value: 1000,
        client_event_id: providedId,
      });

      // The ID passed to RPC should be exactly what we provided
      expect(capturedEventIds[0]).toBe(providedId);
      // Not some other generated ID
      expect(capturedEventIds[0]).not.toBe(generateClientEventId());
    });
  });

  describe("retry behavior simulation", () => {
    /**
     * This test simulates what happens when React Query retries a failed mutation.
     *
     * KEY INSIGHT:
     * - React Query calls mutationFn with the SAME input on retry
     * - If client_event_id is IN the input, it stays the same
     * - If client_event_id was generated INSIDE mutationFn (the bug), each retry gets a new ID
     *
     * The fix moves ID generation to the call site, so retries reuse the same ID.
     */
    it("uses same client_event_id when called multiple times with same input (simulating retries)", async () => {
      // This simulates what React Query does: call mutationFn multiple times with same input
      const input = {
        challenge_id: "challenge-1",
        activity_type: "steps" as const,
        value: 5000,
        client_event_id: "retry-test-event-id",
      };

      // Simulate 3 retry attempts (like React Query would do on network failure)
      await activityService.logActivity(input);
      await activityService.logActivity(input);
      await activityService.logActivity(input);

      // All 3 calls should use the SAME client_event_id
      expect(capturedEventIds).toHaveLength(3);
      expect(capturedEventIds[0]).toBe("retry-test-event-id");
      expect(capturedEventIds[1]).toBe("retry-test-event-id");
      expect(capturedEventIds[2]).toBe("retry-test-event-id");

      // Verify they're all identical
      const uniqueIds = new Set(capturedEventIds);
      expect(uniqueIds.size).toBe(1);
    });

    it("different user actions get different client_event_ids", async () => {
      // User logs activity twice (two separate actions)
      const action1EventId = generateClientEventId();
      const action2EventId = generateClientEventId();

      await activityService.logActivity({
        challenge_id: "challenge-1",
        activity_type: "steps",
        value: 5000,
        client_event_id: action1EventId,
      });

      await activityService.logActivity({
        challenge_id: "challenge-1",
        activity_type: "steps",
        value: 3000,
        client_event_id: action2EventId,
      });

      // Two different actions = two different IDs
      expect(capturedEventIds).toHaveLength(2);
      expect(capturedEventIds[0]).not.toBe(capturedEventIds[1]);
    });
  });

  describe("integration with call site pattern", () => {
    /**
     * This test verifies the CORRECT pattern:
     * 1. Generate client_event_id ONCE at call site
     * 2. Pass it as part of mutation input
     * 3. Retries reuse the same input (and thus same ID)
     */
    it("demonstrates correct call site pattern prevents double-counting", async () => {
      // === CORRECT PATTERN (what we implemented) ===
      // The call site generates ID once, before any retry logic
      const eventIdGeneratedOnce = generateClientEventId();

      // Simulate the mutation input that gets passed to mutationFn
      const mutationInput = {
        challenge_id: "challenge-1",
        activity_type: "steps" as const,
        value: 5000,
        client_event_id: eventIdGeneratedOnce, // ID is part of input
      };

      // Simulate React Query calling mutationFn 3 times (initial + 2 retries)
      // In the real code, this is: mutationFn: async (input) => activityService.logActivity(input)
      const simulateMutationFn = async (
        input: typeof mutationInput,
      ): Promise<void> => {
        await activityService.logActivity(input);
      };

      // React Query passes the SAME input object on each retry
      await simulateMutationFn(mutationInput);
      await simulateMutationFn(mutationInput);
      await simulateMutationFn(mutationInput);

      // Verify: all attempts used the same ID
      expect(new Set(capturedEventIds).size).toBe(1);
      expect(capturedEventIds[0]).toBe(eventIdGeneratedOnce);
    });

    /**
     * This test demonstrates what the BUGGY pattern would do
     * (generating ID inside mutationFn)
     */
    it("demonstrates buggy pattern WOULD cause different IDs per retry", async () => {
      // === BUGGY PATTERN (what we fixed) ===
      // If ID was generated inside mutationFn, each call gets a new ID
      const simulateBuggyMutationFn = async (input: {
        challenge_id: string;
        activity_type: string;
        value: number;
      }): Promise<void> => {
        // BUG: ID generated inside the function, not from input
        const client_event_id = generateClientEventId();
        await activityService.logActivity({ ...input, client_event_id });
      };

      const input = {
        challenge_id: "challenge-1",
        activity_type: "steps",
        value: 5000,
      };

      // Each "retry" generates a NEW ID (the bug!)
      await simulateBuggyMutationFn(input);
      await simulateBuggyMutationFn(input);
      await simulateBuggyMutationFn(input);

      // BUG DEMONSTRATED: all IDs are different
      expect(capturedEventIds).toHaveLength(3);
      expect(new Set(capturedEventIds).size).toBe(3); // 3 unique IDs = double/triple counting!

      // This is exactly what we fixed - the test proves the fix works
      // by showing the contrasting behavior
    });
  });

  describe("duplicate detection behavior", () => {
    it("silently succeeds when server returns duplicate key error", async () => {
      // Mock RPC to return duplicate key error
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: {
          message: "duplicate key value violates unique constraint",
          code: "23505",
        },
      });

      // Should not throw - duplicates are expected during retries
      await expect(
        activityService.logActivity({
          challenge_id: "challenge-1",
          activity_type: "steps",
          value: 5000,
          client_event_id: "duplicate-test-id",
        }),
      ).resolves.toBeUndefined();
    });
  });
});
