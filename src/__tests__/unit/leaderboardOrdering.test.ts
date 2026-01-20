// src/__tests__/unit/leaderboardOrdering.test.ts
// Tests for P1-2: Deterministic Leaderboard Ordering
//
// These tests verify that leaderboard queries use a stable tie-breaker
// (user_id) to prevent rank jitter when participants have equal progress.

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

  describe("getMyActiveChallenges", () => {
    it("applies user_id as tie-breaker for participant ranking", async () => {
      // Setup: RPC returns challenge IDs
      mockRpc.mockImplementation((name: string) => {
        if (name === "get_active_challenge_ids") {
          return Promise.resolve({
            data: [{ challenge_id: "challenge-1" }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      // Setup: challenges query returns one challenge
      const challengesChain = createQueryChain([
        {
          id: "challenge-1",
          title: "Test",
          challenge_participants: [
            { invite_status: "accepted", current_progress: 500 },
          ],
        },
      ]);

      // Setup: participants query returns tied progress
      const participantsChain = createQueryChain([
        {
          challenge_id: "challenge-1",
          user_id: "user-c",
          current_progress: 1000,
        },
        {
          challenge_id: "challenge-1",
          user_id: "user-a",
          current_progress: 1000,
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === "challenges") return challengesChain;
        if (table === "challenge_participants") return participantsChain;
        return createQueryChain([]);
      });

      // Clear order calls from setup
      orderCalls.length = 0;

      const { challengeService } = require("@/services/challenges");
      await challengeService.getMyActiveChallenges();

      // Verify participant ranking query uses tie-breaker
      const participantOrders = orderCalls.filter(
        (call) =>
          call.column === "current_progress" || call.column === "user_id",
      );

      expect(participantOrders).toContainEqual({
        column: "current_progress",
        options: { ascending: false },
      });
      expect(participantOrders).toContainEqual({
        column: "user_id",
        options: { ascending: true },
      });
    });
  });

  describe("getCompletedChallenges", () => {
    it("applies user_id as tie-breaker for participant ranking", async () => {
      // Setup: RPC returns completed challenge IDs
      mockRpc.mockImplementation((name: string) => {
        if (name === "get_completed_challenge_ids") {
          return Promise.resolve({
            data: [{ challenge_id: "challenge-1" }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      // Setup: challenges query returns one completed challenge
      const challengesChain = createQueryChain([
        {
          id: "challenge-1",
          title: "Completed Test",
          end_date: "2024-06-01T00:00:00Z",
          challenge_participants: [
            { invite_status: "accepted", current_progress: 500 },
          ],
        },
      ]);

      // Setup: participants query
      const participantsChain = createQueryChain([
        {
          challenge_id: "challenge-1",
          user_id: "user-b",
          current_progress: 1000,
        },
        {
          challenge_id: "challenge-1",
          user_id: "user-a",
          current_progress: 1000,
        },
      ]);

      mockFrom.mockImplementation((table: string) => {
        if (table === "challenges") return challengesChain;
        if (table === "challenge_participants") return participantsChain;
        return createQueryChain([]);
      });

      // Clear order calls
      orderCalls.length = 0;

      const { challengeService } = require("@/services/challenges");
      await challengeService.getCompletedChallenges();

      // Verify participant ranking query uses tie-breaker
      const participantOrders = orderCalls.filter(
        (call) =>
          call.column === "current_progress" || call.column === "user_id",
      );

      expect(participantOrders).toContainEqual({
        column: "current_progress",
        options: { ascending: false },
      });
      expect(participantOrders).toContainEqual({
        column: "user_id",
        options: { ascending: true },
      });
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
