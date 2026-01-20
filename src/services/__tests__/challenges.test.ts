// src/__tests__/unit/challenges.test.ts
// Unit tests for challenges service

/**
 * Tests for challengeService, specifically the getPendingInvites guard
 * against empty .in() queries.
 *
 * MOCK STRATEGY: Jest hoists jest.mock() calls but allows variables prefixed
 * with "mock" to be referenced. We use a mockSupabase object that can be
 * configured in beforeEach.
 */

// =============================================================================
// MOCKS - Variables prefixed with "mock" are allowed in hoisted jest.mock()
// =============================================================================

// This object will be configured in beforeEach - accessible due to "mock" prefix
const mockSupabase = {
  from: jest.fn(),
};

jest.mock("react-native-url-polyfill/auto", () => {});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("@/lib/storageProbe", () => ({
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

jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date()),
}));

// Mock supabase - references mockSupabase which is allowed due to "mock" prefix
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  withAuth: jest.fn((operation: (userId: string) => unknown) =>
    operation("test-user-123"),
  ),
}));

// Import AFTER mocks are set up
import { challengeService } from "@/services/challenges";

// =============================================================================
// TESTS
// =============================================================================

describe("challengeService.getPendingInvites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    mockSupabase.from.mockReset();
  });

  describe("empty creatorIds guard", () => {
    it("should NOT call .in() when challenges.length === 0", async () => {
      // Setup: challenge_participants query returns empty array
      const participantsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      let eqCallCount = 0;
      participantsChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          // After both .eq() calls, return thenable with empty data
          return {
            ...participantsChain,
            then: (resolve: (value: unknown) => void) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
          };
        }
        return participantsChain;
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "challenge_participants") {
          return participantsChain;
        }
        // profiles_public should never be called when challenges is empty
        throw new Error(`Unexpected table access: ${table}`);
      });

      // Execute
      const result = await challengeService.getPendingInvites();

      // Verify
      expect(result).toEqual([]);
      expect(mockSupabase.from).toHaveBeenCalledWith("challenge_participants");
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only participants, not profiles_public
    });

    it("should call .in() with creatorIds when challenges.length > 0", async () => {
      // Track .in() calls
      const inMock = jest.fn();

      // Setup: challenge_participants returns some challenges
      // Note: The query uses "challenge:challenges!inner" so the alias is "challenge" (singular)
      const mockChallenges = [
        {
          joined_at: "2024-01-01",
          challenge: {
            id: "challenge-1",
            title: "Test Challenge",
            creator_id: "creator-1",
          },
        },
        {
          joined_at: "2024-01-02",
          challenge: {
            id: "challenge-2",
            title: "Test Challenge 2",
            creator_id: "creator-2",
          },
        },
      ];

      const participantsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      let eqCallCount = 0;
      participantsChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return {
            ...participantsChain,
            then: (resolve: (value: unknown) => void) =>
              Promise.resolve({ data: mockChallenges, error: null }).then(
                resolve,
              ),
          };
        }
        return participantsChain;
      });

      // Setup: profiles_public query
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        in: inMock.mockReturnThis(),
      };
      inMock.mockImplementation(() => ({
        ...profilesChain,
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({
            data: [
              { id: "creator-1", username: "user1", display_name: "User 1" },
              { id: "creator-2", username: "user2", display_name: "User 2" },
            ],
            error: null,
          }).then(resolve),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "challenge_participants") {
          return participantsChain;
        }
        if (table === "profiles_public") {
          return profilesChain;
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      // Execute
      const result = await challengeService.getPendingInvites();

      // Verify .in() was called with the creator IDs
      expect(inMock).toHaveBeenCalledWith("id", ["creator-1", "creator-2"]);
      expect(result.length).toBe(2);
    });

    it("should deduplicate creatorIds before calling .in()", async () => {
      const inMock = jest.fn();

      // Setup: challenges with duplicate creator
      // Note: The query uses "challenge:challenges!inner" so the alias is "challenge" (singular)
      const mockChallenges = [
        {
          joined_at: "2024-01-01",
          challenge: {
            id: "challenge-1",
            title: "Test Challenge",
            creator_id: "same-creator",
          },
        },
        {
          joined_at: "2024-01-02",
          challenge: {
            id: "challenge-2",
            title: "Test Challenge 2",
            creator_id: "same-creator", // Same creator
          },
        },
        {
          joined_at: "2024-01-03",
          challenge: {
            id: "challenge-3",
            title: "Test Challenge 3",
            creator_id: "different-creator",
          },
        },
      ];

      const participantsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      let eqCallCount = 0;
      participantsChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return {
            ...participantsChain,
            then: (resolve: (value: unknown) => void) =>
              Promise.resolve({ data: mockChallenges, error: null }).then(
                resolve,
              ),
          };
        }
        return participantsChain;
      });

      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        in: inMock.mockReturnThis(),
      };
      inMock.mockImplementation(() => ({
        ...profilesChain,
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({
            data: [
              {
                id: "same-creator",
                username: "user1",
                display_name: "User 1",
              },
              {
                id: "different-creator",
                username: "user2",
                display_name: "User 2",
              },
            ],
            error: null,
          }).then(resolve),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "challenge_participants") {
          return participantsChain;
        }
        if (table === "profiles_public") {
          return profilesChain;
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      // Execute
      await challengeService.getPendingInvites();

      // Verify .in() was called with deduplicated IDs
      expect(inMock).toHaveBeenCalledTimes(1);
      const calledWithIds = inMock.mock.calls[0][1];
      expect(calledWithIds).toHaveLength(2); // Not 3
      expect(calledWithIds).toContain("same-creator");
      expect(calledWithIds).toContain("different-creator");
    });
  });
});
