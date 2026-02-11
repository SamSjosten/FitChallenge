// src/hooks/__tests__/useHomeScreenData.test.ts
// Tests for splitChallengesByStatus utility function

import type { ChallengeWithParticipation } from "@/services/challenges";

// Import after mocks are set up
import { splitChallengesByStatus } from "../useHomeScreenData";

// Mock serverTime module before importing the function under test
const mockGetServerNow = jest.fn();
jest.mock("@/lib/serverTime", () => ({
  getServerNow: () => mockGetServerNow(),
}));

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

const FIXED_NOW = new Date("2025-02-01T12:00:00Z");
const USER_ID = "user-123";
const OTHER_USER_ID = "user-456";

function makeChallenge(
  overrides: Partial<ChallengeWithParticipation> = {},
): ChallengeWithParticipation {
  return {
    id: `challenge-${Math.random().toString(36).slice(2)}`,
    creator_id: OTHER_USER_ID,
    title: "Test Challenge",
    description: null,
    challenge_type: "steps",
    goal_value: 10000,
    goal_unit: "steps",
    win_condition: "highest_total",
    daily_target: null,
    start_date: "2025-02-01T00:00:00Z",
    end_date: "2025-02-28T23:59:59Z",
    status: "active",
    xp_reward: 100,
    max_participants: 10,
    is_public: false,
    custom_activity_name: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    starting_soon_notified_at: null,
    ending_soon_notified_at: null,
    my_participation: {
      invite_status: "accepted",
      current_progress: 0,
    },
    participant_count: 2,
    my_rank: 1,
    ...overrides,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("splitChallengesByStatus", () => {
  beforeEach(() => {
    mockGetServerNow.mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    test("returns undefined for both when challenges is undefined", () => {
      const result = splitChallengesByStatus(undefined, USER_ID);

      expect(result.inProgress).toBeUndefined();
      expect(result.startingSoon).toBeUndefined();
    });

    test("returns empty arrays when challenges is empty", () => {
      const result = splitChallengesByStatus([], USER_ID);

      expect(result.inProgress).toEqual([]);
      expect(result.startingSoon).toEqual([]);
    });

    test("handles undefined userId gracefully", () => {
      const challenge = makeChallenge({ creator_id: USER_ID });
      const result = splitChallengesByStatus([challenge], undefined);

      // is_creator should be false when userId is undefined
      expect(result.inProgress?.[0]?.is_creator).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Status splitting
  // ---------------------------------------------------------------------------

  describe("status splitting", () => {
    test("puts challenges where start_date > now into startingSoon", () => {
      const upcomingChallenge = makeChallenge({
        start_date: "2025-02-05T00:00:00Z", // 4 days in future
        end_date: "2025-02-28T23:59:59Z",
      });

      const result = splitChallengesByStatus([upcomingChallenge], USER_ID);

      expect(result.startingSoon).toHaveLength(1);
      expect(result.inProgress).toHaveLength(0);
    });

    test("puts challenges where start_date <= now < end_date into inProgress", () => {
      const activeChallenge = makeChallenge({
        start_date: "2025-01-15T00:00:00Z", // Started 2 weeks ago
        end_date: "2025-02-28T23:59:59Z", // Ends in future
      });

      const result = splitChallengesByStatus([activeChallenge], USER_ID);

      expect(result.inProgress).toHaveLength(1);
      expect(result.startingSoon).toHaveLength(0);
    });

    test("splits mixed challenges correctly", () => {
      const upcoming1 = makeChallenge({
        id: "upcoming-1",
        start_date: "2025-02-10T00:00:00Z",
        end_date: "2025-03-10T23:59:59Z",
      });
      const upcoming2 = makeChallenge({
        id: "upcoming-2",
        start_date: "2025-02-05T00:00:00Z",
        end_date: "2025-03-05T23:59:59Z",
      });
      const active1 = makeChallenge({
        id: "active-1",
        start_date: "2025-01-01T00:00:00Z",
        end_date: "2025-02-28T23:59:59Z",
      });
      const active2 = makeChallenge({
        id: "active-2",
        start_date: "2025-01-15T00:00:00Z",
        end_date: "2025-02-15T23:59:59Z",
      });

      const result = splitChallengesByStatus([upcoming1, active1, upcoming2, active2], USER_ID);

      expect(result.startingSoon).toHaveLength(2);
      expect(result.inProgress).toHaveLength(2);

      // Verify correct challenges in each bucket
      expect(result.startingSoon?.map((c) => c.id)).toContain("upcoming-1");
      expect(result.startingSoon?.map((c) => c.id)).toContain("upcoming-2");
      expect(result.inProgress?.map((c) => c.id)).toContain("active-1");
      expect(result.inProgress?.map((c) => c.id)).toContain("active-2");
    });

    test("respects cancelled/archived status override", () => {
      // These should NOT appear in results since they're excluded by RPC,
      // but if they somehow got through, they'd be filtered out
      const cancelledChallenge = makeChallenge({
        status: "cancelled",
        start_date: "2025-01-01T00:00:00Z",
        end_date: "2025-02-28T23:59:59Z",
      });

      const result = splitChallengesByStatus([cancelledChallenge], USER_ID);

      // Cancelled challenges don't go into either bucket
      expect(result.inProgress).toHaveLength(0);
      expect(result.startingSoon).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // is_creator flag
  // ---------------------------------------------------------------------------

  describe("is_creator flag", () => {
    test("sets is_creator=true when creator_id matches userId", () => {
      const myChallenge = makeChallenge({ creator_id: USER_ID });

      const result = splitChallengesByStatus([myChallenge], USER_ID);

      expect(result.inProgress?.[0]?.is_creator).toBe(true);
    });

    test("sets is_creator=false when creator_id does not match userId", () => {
      const othersChallenge = makeChallenge({ creator_id: OTHER_USER_ID });

      const result = splitChallengesByStatus([othersChallenge], USER_ID);

      expect(result.inProgress?.[0]?.is_creator).toBe(false);
    });

    test("preserves is_creator in both buckets", () => {
      const myUpcoming = makeChallenge({
        creator_id: USER_ID,
        start_date: "2025-02-05T00:00:00Z",
      });
      const othersActive = makeChallenge({
        creator_id: OTHER_USER_ID,
        start_date: "2025-01-01T00:00:00Z",
      });

      const result = splitChallengesByStatus([myUpcoming, othersActive], USER_ID);

      expect(result.startingSoon?.[0]?.is_creator).toBe(true);
      expect(result.inProgress?.[0]?.is_creator).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  describe("sorting", () => {
    test("sorts startingSoon by start_date ascending (soonest first)", () => {
      const later = makeChallenge({
        id: "later",
        start_date: "2025-02-15T00:00:00Z",
        end_date: "2025-03-15T23:59:59Z",
      });
      const sooner = makeChallenge({
        id: "sooner",
        start_date: "2025-02-03T00:00:00Z",
        end_date: "2025-03-03T23:59:59Z",
      });
      const middle = makeChallenge({
        id: "middle",
        start_date: "2025-02-10T00:00:00Z",
        end_date: "2025-03-10T23:59:59Z",
      });

      // Pass in unsorted order
      const result = splitChallengesByStatus([later, sooner, middle], USER_ID);

      expect(result.startingSoon?.map((c) => c.id)).toEqual(["sooner", "middle", "later"]);
    });

    test("does not change order of inProgress challenges", () => {
      // inProgress keeps insertion order (RPC already sorts by end_date)
      const c1 = makeChallenge({
        id: "c1",
        start_date: "2025-01-20T00:00:00Z",
      });
      const c2 = makeChallenge({
        id: "c2",
        start_date: "2025-01-10T00:00:00Z",
      });
      const c3 = makeChallenge({
        id: "c3",
        start_date: "2025-01-15T00:00:00Z",
      });

      const result = splitChallengesByStatus([c1, c2, c3], USER_ID);

      // Order preserved from input
      expect(result.inProgress?.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Server time usage
  // ---------------------------------------------------------------------------

  describe("server time usage", () => {
    test("uses getServerNow for time comparison", () => {
      // Challenge that starts exactly at FIXED_NOW - edge case
      const edgeChallenge = makeChallenge({
        start_date: "2025-02-01T12:00:00Z", // Exactly FIXED_NOW
        end_date: "2025-02-28T23:59:59Z",
      });

      splitChallengesByStatus([edgeChallenge], USER_ID);

      expect(mockGetServerNow).toHaveBeenCalled();
    });

    test("boundary: challenge starting exactly at now is active (not upcoming)", () => {
      // start_date == now means it HAS started (half-open interval [start, end))
      const startsNow = makeChallenge({
        start_date: "2025-02-01T12:00:00Z", // Exactly FIXED_NOW
        end_date: "2025-02-28T23:59:59Z",
      });

      const result = splitChallengesByStatus([startsNow], USER_ID);

      expect(result.inProgress).toHaveLength(1);
      expect(result.startingSoon).toHaveLength(0);
    });

    test("uses server time when device time is off", () => {
      // Server says it's Feb 1, but device thinks it's Jan 31
      // Challenge starts Feb 1 - should be active per server time
      const serverTime = new Date("2025-02-01T12:00:00Z");
      mockGetServerNow.mockReturnValue(serverTime);

      const challenge = makeChallenge({
        start_date: "2025-02-01T00:00:00Z",
        end_date: "2025-02-28T23:59:59Z",
      });

      const result = splitChallengesByStatus([challenge], USER_ID);

      // Should be active because server time (Feb 1) is past start_date
      expect(result.inProgress).toHaveLength(1);
      expect(result.startingSoon).toHaveLength(0);
    });
  });
});
