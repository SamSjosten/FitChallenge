// src/__tests__/unit/leaderboardOrdering.test.ts
// Tests for P1-2: Deterministic Leaderboard Ordering
//
// These tests verify that leaderboard queries use a stable tie-breaker
// (user_id) to prevent rank jitter when participants have equal progress.
//
// NOTE: getMyActiveChallenges/getCompletedChallenges now use server-side
// RPC (get_my_challenges) with RANK() window function. Ordering/ranking
// tests for those are in integration tests against live database.

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

// Track order() calls to verify tie-breaker is applied
const orderCalls: Array<{ column: string; options: { ascending: boolean } }> =
  [];

// Create a chainable mock that tracks order() calls
const createQueryChain = (finalData: unknown[] = []) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockImplementation((column, options) => {
      orderCalls.push({ column, options });
      return chain;
    }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
      Promise.resolve({ data: finalData, error: null }).then(resolve),
  };
  return chain;
};

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
  withAuth: jest.fn((operation) => operation("test-user-123")),
}));

jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date("2024-06-15T12:00:00Z")),
}));

// =============================================================================
// TESTS
// =============================================================================

describe("Leaderboard Ordering (P1-2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderCalls.length = 0;
  });

  describe("getLeaderboard", () => {
    it("applies user_id as tie-breaker after current_progress", async () => {
      // Setup mock to return participants with tied progress
      const participantsChain = createQueryChain([
        { user_id: "user-c", current_progress: 1000, current_streak: 5 },
        { user_id: "user-a", current_progress: 1000, current_streak: 3 },
        { user_id: "user-b", current_progress: 1000, current_streak: 7 },
      ]);

      const profilesChain = createQueryChain([
        {
          id: "user-a",
          username: "alice",
          display_name: "Alice",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-b",
          username: "bob",
          display_name: "Bob",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-c",
          username: "charlie",
          display_name: "Charlie",
          avatar_url: null,
          updated_at: "",
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === "challenge_participants") return participantsChain;
        if (table === "profiles_public") return profilesChain;
        return createQueryChain([]);
      });

      const { challengeService } = require("@/services/challenges");
      await challengeService.getLeaderboard("challenge-123");

      // Verify order() was called twice on challenge_participants
      // First: current_progress DESC, Second: user_id ASC
      const participantOrders = orderCalls.filter(
        (call) =>
          call.column === "current_progress" || call.column === "user_id",
      );

      expect(participantOrders).toHaveLength(2);
      expect(participantOrders[0]).toEqual({
        column: "current_progress",
        options: { ascending: false },
      });
      expect(participantOrders[1]).toEqual({
        column: "user_id",
        options: { ascending: true },
      });
    });
  });

  describe("getMyActiveChallenges (RPC-based)", () => {
    it("calls get_my_challenges RPC with 'active' filter", async () => {
      // Setup: RPC returns challenge data with ranks pre-computed
      mockRpc.mockResolvedValue({
        data: [
          {
            id: "challenge-1",
            creator_id: "creator-1",
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

      // Verify RPC was called with correct filter
      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "active",
      });

      // Verify result is mapped correctly
      expect(result).toHaveLength(1);
      expect(result[0].my_participation).toEqual({
        invite_status: "accepted",
        current_progress: 500,
      });
      expect(result[0].participant_count).toBe(3);
      expect(result[0].my_rank).toBe(2);
    });
  });

  describe("getCompletedChallenges (RPC-based)", () => {
    it("calls get_my_challenges RPC with 'completed' filter", async () => {
      // Setup: RPC returns completed challenge data
      mockRpc.mockResolvedValue({
        data: [
          {
            id: "challenge-2",
            creator_id: "creator-1",
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

      // Verify RPC was called with correct filter
      expect(mockRpc).toHaveBeenCalledWith("get_my_challenges", {
        p_filter: "completed",
      });

      // Verify result is mapped correctly
      expect(result).toHaveLength(1);
      expect(result[0].my_rank).toBe(1);
    });
  });

  describe("rank stability", () => {
    it("assigns equal ranks for tied progress (standard competition ranking)", async () => {
      // With true tie handling:
      // All users with same progress get the same rank
      // [1000, 1000, 1000] → ranks [1, 1, 1]

      // Simulate database returning in user_id order (as it would with tie-breaker)
      const participantsChain = createQueryChain([
        { user_id: "user-a", current_progress: 1000, current_streak: 3 },
        { user_id: "user-b", current_progress: 1000, current_streak: 7 },
        { user_id: "user-c", current_progress: 1000, current_streak: 5 },
      ]);

      const profilesChain = createQueryChain([
        {
          id: "user-a",
          username: "alice",
          display_name: "Alice",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-b",
          username: "bob",
          display_name: "Bob",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-c",
          username: "charlie",
          display_name: "Charlie",
          avatar_url: null,
          updated_at: "",
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === "challenge_participants") return participantsChain;
        if (table === "profiles_public") return profilesChain;
        return createQueryChain([]);
      });

      const { challengeService } = require("@/services/challenges");
      const leaderboard =
        await challengeService.getLeaderboard("challenge-123");

      // All tied users get rank 1
      expect(leaderboard[0].user_id).toBe("user-a");
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].user_id).toBe("user-b");
      expect(leaderboard[1].rank).toBe(1); // Same progress = same rank
      expect(leaderboard[2].user_id).toBe("user-c");
      expect(leaderboard[2].rank).toBe(1); // Same progress = same rank
    });

    it("skips ranks after ties (1, 1, 3 pattern)", async () => {
      // Standard competition ranking:
      // [1000, 1000, 500] → ranks [1, 1, 3] (not 1, 1, 2)

      const participantsChain = createQueryChain([
        { user_id: "user-a", current_progress: 1000, current_streak: 3 },
        { user_id: "user-b", current_progress: 1000, current_streak: 7 },
        { user_id: "user-c", current_progress: 500, current_streak: 5 },
      ]);

      const profilesChain = createQueryChain([
        {
          id: "user-a",
          username: "alice",
          display_name: "Alice",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-b",
          username: "bob",
          display_name: "Bob",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-c",
          username: "charlie",
          display_name: "Charlie",
          avatar_url: null,
          updated_at: "",
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === "challenge_participants") return participantsChain;
        if (table === "profiles_public") return profilesChain;
        return createQueryChain([]);
      });

      const { challengeService } = require("@/services/challenges");
      const leaderboard =
        await challengeService.getLeaderboard("challenge-123");

      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].rank).toBe(1); // Tied with first
      expect(leaderboard[2].rank).toBe(3); // Skips to position 3, not 2
    });

    it("maintains stable ordering via user_id tie-breaker", async () => {
      // When progress is tied, user_id ASC ensures consistent ordering
      // user-a < user-b < user-c alphabetically

      const participantsChain = createQueryChain([
        { user_id: "user-a", current_progress: 1000, current_streak: 3 },
        { user_id: "user-b", current_progress: 1000, current_streak: 7 },
        { user_id: "user-c", current_progress: 1000, current_streak: 5 },
      ]);

      const profilesChain = createQueryChain([
        {
          id: "user-a",
          username: "alice",
          display_name: "Alice",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-b",
          username: "bob",
          display_name: "Bob",
          avatar_url: null,
          updated_at: "",
        },
        {
          id: "user-c",
          username: "charlie",
          display_name: "Charlie",
          avatar_url: null,
          updated_at: "",
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === "challenge_participants") return participantsChain;
        if (table === "profiles_public") return profilesChain;
        return createQueryChain([]);
      });

      const { challengeService } = require("@/services/challenges");

      // Call multiple times to verify stability
      const results = await Promise.all([
        challengeService.getLeaderboard("challenge-123"),
        challengeService.getLeaderboard("challenge-123"),
        challengeService.getLeaderboard("challenge-123"),
      ]);

      // Order should be consistent across calls
      for (const leaderboard of results) {
        expect(leaderboard[0].user_id).toBe("user-a");
        expect(leaderboard[1].user_id).toBe("user-b");
        expect(leaderboard[2].user_id).toBe("user-c");
      }
    });
  });
});
