// src/__tests__/unit/serverTimeFiltering.test.ts
// Unit tests for P1-3: Server-authoritative challenge filtering
//
// With the consolidated RPC (get_my_challenges), time filtering is now
// entirely server-side. These tests verify:
// 1. Correct filter parameter is passed to RPC
// 2. No client-side time logic is used
// 3. Results are returned directly from RPC without additional filtering

// =============================================================================
// MOCKS
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("crypto").randomUUID(),
}));

const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
  withAuth: jest.fn((operation) => operation("test-user-123")),
}));

// =============================================================================
// TEST DATA - Valid UUIDs for Zod schema validation
// =============================================================================
const TEST_UUIDS = {
  challenge1: "11111111-1111-1111-1111-111111111111",
  challenge2: "22222222-2222-2222-2222-222222222222",
  creator1: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
};

// =============================================================================
// TESTS
// =============================================================================

describe("P1-3: Server-Authoritative Challenge Filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMyActiveChallenges", () => {
    it("passes 'active' filter to consolidated RPC", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getMyActiveChallenges();

      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "active",
      });
    });

    it("does not use client-side time filtering", async () => {
      // The old implementation used getServerNow() for client-side filtering
      // The new implementation delegates all filtering to the database
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getMyActiveChallenges();

      // Only one call to rpc, no additional filtering
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "active",
      });
    });

    it("returns RPC results directly (no post-processing filter)", async () => {
      const serverResults = [
        {
          id: TEST_UUIDS.challenge1,
          creator_id: TEST_UUIDS.creator1,
          title: "Active Challenge",
          description: null,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          daily_target: null,
          start_date: "2024-06-01T00:00:00Z",
          end_date: "2024-06-30T00:00:00Z",
          status: "active",
          xp_reward: 100,
          max_participants: 50,
          is_public: false,
          custom_activity_name: null,
          created_at: "2024-06-01T00:00:00Z",
          updated_at: "2024-06-01T00:00:00Z",
          my_invite_status: "accepted",
          my_current_progress: 500,
          participant_count: 3,
          my_rank: 1,
        },
      ];
      mockRpc.mockResolvedValue({ data: serverResults, error: null });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getMyActiveChallenges();

      // Result count matches server response (no client filtering)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(TEST_UUIDS.challenge1);
    });
  });

  describe("getCompletedChallenges", () => {
    it("passes 'completed' filter to consolidated RPC", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getCompletedChallenges();

      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "completed",
      });
    });

    it("does not use client-side time filtering", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getCompletedChallenges();

      // Only one call to rpc, no additional filtering
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "completed",
      });
    });

    it("returns RPC results directly (no post-processing filter)", async () => {
      const serverResults = [
        {
          id: TEST_UUIDS.challenge2,
          creator_id: TEST_UUIDS.creator1,
          title: "Completed Challenge",
          description: null,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          daily_target: null,
          start_date: "2024-05-01T00:00:00Z",
          end_date: "2024-05-31T00:00:00Z",
          status: "completed",
          xp_reward: 100,
          max_participants: 50,
          is_public: false,
          custom_activity_name: null,
          created_at: "2024-05-01T00:00:00Z",
          updated_at: "2024-05-31T00:00:00Z",
          my_invite_status: "accepted",
          my_current_progress: 15000,
          participant_count: 5,
          my_rank: 1,
        },
      ];
      mockRpc.mockResolvedValue({ data: serverResults, error: null });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getCompletedChallenges();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(TEST_UUIDS.challenge2);
    });
  });

  describe("Server-time contract", () => {
    it("active challenges: server determines time boundaries", async () => {
      // The RPC uses: start_date <= now() AND end_date > now()
      // Client has no knowledge of server time - trusts the RPC result
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getMyActiveChallenges();

      // Verify RPC was called (server does the filtering)
      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "active",
      });
      // No client-side Date operations or time comparisons
    });

    it("completed challenges: server determines time boundaries", async () => {
      // The RPC uses: end_date <= now()
      // Client trusts server response
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getCompletedChallenges();

      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "completed",
      });
    });
  });
});
