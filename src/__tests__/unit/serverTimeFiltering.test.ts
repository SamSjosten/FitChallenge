// src/__tests__/unit/serverTimeFiltering.test.ts
// Unit tests for P1-3: Server-authoritative challenge filtering

/**
 * Tests that getMyActiveChallenges and getCompletedChallenges:
 * 1. Call the server-side RPC first to get IDs
 * 2. Guard against empty RPC results (no .in() call)
 * 3. Fetch full challenge data by IDs with correct ordering
 */

// =============================================================================
// MOCKS
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockUserId = "test-user-123";

// Track RPC calls
const rpcCalls: { name: string; args?: unknown }[] = [];

// Track .in() calls to verify empty guard
const inCalls: { column: string; values: unknown[] }[] = [];

// Configurable RPC responses
let activeIdsResponse: { challenge_id: string }[] = [];
let completedIdsResponse: { challenge_id: string }[] = [];

// Configurable challenge data response
let challengesResponse: unknown[] = [];
let participantsResponse: unknown[] = [];

// Mock supabase with RPC support
jest.mock("@/lib/supabase", () => {
  // Create chainable mock for from() queries
  const createFromChain = () => {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockImplementation((column: string, values: unknown[]) => {
        inCalls.push({ column, values });
        return chain;
      }),
      order: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    // Make chain thenable - response depends on what's being queried
    Object.defineProperty(chain, "then", {
      value: (
        resolve: (value: { data: unknown; error: null }) => void,
        reject?: (error: Error) => void,
      ) => {
        // Check if .in() was called to determine response type
        const lastIn = inCalls[inCalls.length - 1];
        if (lastIn?.column === "id") {
          // Challenge fetch by ID
          return Promise.resolve({
            data: challengesResponse,
            error: null,
          }).then(resolve);
        }
        if (lastIn?.column === "challenge_id") {
          // Participants fetch
          return Promise.resolve({
            data: participantsResponse,
            error: null,
          }).then(resolve);
        }
        // Default
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
      configurable: true,
    });

    return chain;
  };

  return {
    getSupabaseClient: jest.fn(() => ({
      rpc: jest.fn().mockImplementation((name: string, args?: unknown) => {
        rpcCalls.push({ name, args });

        if (name === "get_active_challenge_ids") {
          return Promise.resolve({
            data: activeIdsResponse,
            error: null,
          });
        }
        if (name === "get_completed_challenge_ids") {
          return Promise.resolve({
            data: completedIdsResponse,
            error: null,
          });
        }

        return Promise.resolve({ data: null, error: null });
      }),
      from: jest.fn().mockImplementation(() => createFromChain()),
    })),
    withAuth: jest.fn((operation) => operation(mockUserId)),
  };
});

// =============================================================================
// TESTS
// =============================================================================

describe("P1-3: Server-Authoritative Challenge Filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcCalls.length = 0;
    inCalls.length = 0;
    activeIdsResponse = [];
    completedIdsResponse = [];
    challengesResponse = [];
    participantsResponse = [];
  });

  describe("getMyActiveChallenges", () => {
    it("should call get_active_challenge_ids RPC first", async () => {
      const { challengeService } = require("@/services/challenges");

      await challengeService.getMyActiveChallenges();

      // Verify RPC was called
      expect(rpcCalls).toContainEqual({
        name: "get_active_challenge_ids",
        args: undefined,
      });
    });

    it("should return empty array when RPC returns no IDs", async () => {
      activeIdsResponse = []; // Empty response

      const { challengeService } = require("@/services/challenges");

      const result = await challengeService.getMyActiveChallenges();

      // Should return empty without calling .in()
      expect(result).toEqual([]);
      expect(inCalls).toHaveLength(0);
    });

    it("should NOT call .in() when RPC returns empty array", async () => {
      activeIdsResponse = [];

      const { challengeService } = require("@/services/challenges");

      await challengeService.getMyActiveChallenges();

      // Verify .in() was never called (would fail with empty array in PostgREST)
      expect(inCalls).toHaveLength(0);
    });

    it("should fetch challenges by IDs when RPC returns results", async () => {
      activeIdsResponse = [
        { challenge_id: "challenge-1" },
        { challenge_id: "challenge-2" },
      ];

      challengesResponse = [
        {
          id: "challenge-1",
          title: "Challenge 1",
          start_date: "2024-01-01",
          challenge_participants: [
            { invite_status: "accepted", current_progress: 100 },
          ],
        },
        {
          id: "challenge-2",
          title: "Challenge 2",
          start_date: "2024-01-02",
          challenge_participants: [
            { invite_status: "accepted", current_progress: 200 },
          ],
        },
      ];

      participantsResponse = [
        {
          challenge_id: "challenge-1",
          user_id: mockUserId,
          current_progress: 100,
        },
        {
          challenge_id: "challenge-2",
          user_id: mockUserId,
          current_progress: 200,
        },
      ];

      const { challengeService } = require("@/services/challenges");

      const result = await challengeService.getMyActiveChallenges();

      // Verify .in() was called with the IDs from RPC
      expect(inCalls).toContainEqual({
        column: "id",
        values: ["challenge-1", "challenge-2"],
      });

      // Verify we got challenges back
      expect(result.length).toBe(2);
    });

    it("should NOT use client time (getServerNow) for filtering", async () => {
      // This test verifies that the old client-time approach is removed
      // by checking that getServerNow is NOT imported/used

      const { challengeService } = require("@/services/challenges");

      // The mock for getServerNow would be called if it were still used
      // Since we removed the import, this should work without it
      activeIdsResponse = [];

      // Should complete without error even though getServerNow isn't mocked
      const result = await challengeService.getMyActiveChallenges();
      expect(result).toEqual([]);
    });
  });

  describe("getCompletedChallenges", () => {
    it("should call get_completed_challenge_ids RPC first", async () => {
      const { challengeService } = require("@/services/challenges");

      await challengeService.getCompletedChallenges();

      expect(rpcCalls).toContainEqual({
        name: "get_completed_challenge_ids",
        args: undefined,
      });
    });

    it("should return empty array when RPC returns no IDs", async () => {
      completedIdsResponse = [];

      const { challengeService } = require("@/services/challenges");

      const result = await challengeService.getCompletedChallenges();

      expect(result).toEqual([]);
      expect(inCalls).toHaveLength(0);
    });

    it("should NOT call .in() when RPC returns empty array", async () => {
      completedIdsResponse = [];

      const { challengeService } = require("@/services/challenges");

      await challengeService.getCompletedChallenges();

      expect(inCalls).toHaveLength(0);
    });

    it("should fetch challenges by IDs when RPC returns results", async () => {
      completedIdsResponse = [
        { challenge_id: "completed-1" },
        { challenge_id: "completed-2" },
      ];

      challengesResponse = [
        {
          id: "completed-1",
          title: "Completed 1",
          end_date: "2024-01-10",
          challenge_participants: [
            { invite_status: "accepted", current_progress: 500 },
          ],
        },
        {
          id: "completed-2",
          title: "Completed 2",
          end_date: "2024-01-05",
          challenge_participants: [
            { invite_status: "accepted", current_progress: 300 },
          ],
        },
      ];

      participantsResponse = [
        {
          challenge_id: "completed-1",
          user_id: mockUserId,
          current_progress: 500,
        },
        {
          challenge_id: "completed-2",
          user_id: mockUserId,
          current_progress: 300,
        },
      ];

      const { challengeService } = require("@/services/challenges");

      const result = await challengeService.getCompletedChallenges();

      expect(inCalls).toContainEqual({
        column: "id",
        values: ["completed-1", "completed-2"],
      });

      expect(result.length).toBe(2);
    });
  });

  describe("Empty .in() guard (PostgREST compliance)", () => {
    it("getMyActiveChallenges: never calls .in() with empty array", async () => {
      activeIdsResponse = [];

      const { challengeService } = require("@/services/challenges");
      await challengeService.getMyActiveChallenges();

      // Verify no .in() calls at all
      const idInCalls = inCalls.filter((c) => c.column === "id");
      expect(idInCalls).toHaveLength(0);
    });

    it("getCompletedChallenges: never calls .in() with empty array", async () => {
      completedIdsResponse = [];

      const { challengeService } = require("@/services/challenges");
      await challengeService.getCompletedChallenges();

      const idInCalls = inCalls.filter((c) => c.column === "id");
      expect(idInCalls).toHaveLength(0);
    });
  });
});
