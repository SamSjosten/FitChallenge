// src/__tests__/unit/leaderboardOrdering.test.ts
// Tests for challenge list and leaderboard service methods
//
// All methods now use server-side RPCs with:
// - Atomic queries (no race windows)
// - Server-side RANK() for competition ranking
// - Flattened response shapes
//
// NOTE: Actual ranking behavior is tested in integration tests against live DB.
// These unit tests verify RPC calls and response mapping.

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

jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date("2024-06-15T12:00:00Z")),
}));

// =============================================================================
// TEST DATA - Valid UUIDs for Zod schema validation
// =============================================================================
const TEST_UUIDS = {
  challenge1: "11111111-1111-1111-1111-111111111111",
  challenge2: "22222222-2222-2222-2222-222222222222",
  challenge123: "12312312-1231-1231-1231-123123123123",
  challenge456: "45645645-4564-4564-4564-456456456456",
  creator1: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  userA: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  userB: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  userC: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  testUser: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
};

// =============================================================================
// TESTS
// =============================================================================

describe("Challenge Service (RPC-based)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMyActiveChallenges", () => {
    it("calls get_my_challenges RPC with 'active' filter", async () => {
      mockRpc.mockResolvedValue({
        data: [
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
            my_rank: 2,
          },
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getMyActiveChallenges();

      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "active",
      });

      expect(result).toHaveLength(1);
      expect(result[0].my_participation).toEqual({
        invite_status: "accepted",
        current_progress: 500,
      });
      expect(result[0].participant_count).toBe(3);
      expect(result[0].my_rank).toBe(2);
    });

    it("returns empty array when RPC returns empty", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getMyActiveChallenges();

      expect(result).toEqual([]);
    });
  });

  describe("getCompletedChallenges", () => {
    it("calls get_my_challenges RPC with 'completed' filter", async () => {
      mockRpc.mockResolvedValue({
        data: [
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
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getCompletedChallenges();

      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "completed",
      });

      expect(result).toHaveLength(1);
      expect(result[0].my_rank).toBe(1);
    });
  });

  describe("getLeaderboard", () => {
    it("calls get_leaderboard RPC with challenge ID", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            user_id: TEST_UUIDS.userA,
            current_progress: 1000,
            current_streak: 5,
            rank: 1,
            username: "alice",
            display_name: "Alice",
            avatar_url: null,
          },
          {
            user_id: TEST_UUIDS.userB,
            current_progress: 800,
            current_streak: 3,
            rank: 2,
            username: "bob",
            display_name: "Bob",
            avatar_url: "https://example.com/bob.jpg",
          },
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getLeaderboard(
        TEST_UUIDS.challenge123,
      );

      expect(mockRpc).toHaveBeenCalledWith("get_leaderboard", {
        p_challenge_id: TEST_UUIDS.challenge123,
      });

      expect(result).toHaveLength(2);
    });

    it("maps flattened RPC response to LeaderboardEntry with nested profile", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            user_id: TEST_UUIDS.userA,
            current_progress: 1000,
            current_streak: 5,
            rank: 1,
            username: "alice",
            display_name: "Alice",
            avatar_url: "https://example.com/alice.jpg",
          },
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getLeaderboard(
        TEST_UUIDS.challenge123,
      );

      expect(result[0]).toEqual({
        user_id: TEST_UUIDS.userA,
        current_progress: 1000,
        current_streak: 5,
        rank: 1,
        profile: {
          id: TEST_UUIDS.userA,
          username: "alice",
          display_name: "Alice",
          avatar_url: "https://example.com/alice.jpg",
          updated_at: "",
        },
      });
    });

    it("returns empty array when user is not accepted participant", async () => {
      // RPC returns empty when explicit gate check fails
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getLeaderboard(
        TEST_UUIDS.challenge456,
      );

      expect(result).toEqual([]);
    });

    it("handles tied ranks from server (standard competition ranking)", async () => {
      // Server returns pre-computed ranks with ties
      mockRpc.mockResolvedValue({
        data: [
          {
            user_id: TEST_UUIDS.userA,
            current_progress: 1000,
            current_streak: 3,
            rank: 1,
            username: "alice",
            display_name: "Alice",
            avatar_url: null,
          },
          {
            user_id: TEST_UUIDS.userB,
            current_progress: 1000,
            current_streak: 7,
            rank: 1, // Same progress = same rank
            username: "bob",
            display_name: "Bob",
            avatar_url: null,
          },
          {
            user_id: TEST_UUIDS.userC,
            current_progress: 500,
            current_streak: 5,
            rank: 3, // Skips to position 3 (1, 1, 3 pattern)
            username: "charlie",
            display_name: "Charlie",
            avatar_url: null,
          },
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");
      const result = await challengeService.getLeaderboard(
        TEST_UUIDS.challenge123,
      );

      // Verify ranks are passed through from server
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(1); // Tied
      expect(result[2].rank).toBe(3); // Gap after tie
    });

    it("throws on RPC error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const { challengeService } = require("@/services/challenges");

      await expect(
        challengeService.getLeaderboard(TEST_UUIDS.challenge123),
      ).rejects.toEqual({ message: "Database error" });
    });
  });

  describe("response validation", () => {
    it("throws ZodError on malformed get_my_challenges response", async () => {
      // Missing required field
      mockRpc.mockResolvedValue({
        data: [
          {
            id: TEST_UUIDS.challenge1,
            // missing title and other required fields
          },
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");

      await expect(challengeService.getMyActiveChallenges()).rejects.toThrow();
    });

    it("throws ZodError on malformed get_leaderboard response", async () => {
      // Invalid rank type
      mockRpc.mockResolvedValue({
        data: [
          {
            user_id: TEST_UUIDS.userA,
            current_progress: 1000,
            current_streak: 5,
            rank: "first", // Should be number
            username: "alice",
            display_name: "Alice",
            avatar_url: null,
          },
        ],
        error: null,
      });

      const { challengeService } = require("@/services/challenges");

      await expect(
        challengeService.getLeaderboard(TEST_UUIDS.challenge123),
      ).rejects.toThrow();
    });
  });
});
