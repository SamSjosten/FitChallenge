// src/services/__tests__/challenges.test.ts
// Unit tests for challenges service

/**
 * Tests for challengeService, specifically the getPendingInvites guard
 * against empty .in() queries.
 */

// =============================================================================
// MOCKS
// =============================================================================

// Mock React Native modules
jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Track calls to Supabase methods
const mockSelect = jest.fn();
const mockIn = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

// Chain mocks for fluent API
const createChainMock = (finalData: unknown, finalError: unknown = null) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: jest.fn((resolve) => resolve({ data: finalData, error: finalError })),
  };
  // Make it thenable for async/await
  Object.defineProperty(chain, "then", {
    value: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: finalData, error: finalError }).then(resolve),
  });
  return chain;
};

// Mock user for withAuth
const mockUserId = "test-user-123";

// Mock supabase module
jest.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: jest.fn(),
    },
    withAuth: jest.fn((operation) => operation(mockUserId)),
  };
});

// Mock serverTime
jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date()),
}));

// =============================================================================
// TESTS
// =============================================================================

describe("challengeService.getPendingInvites", () => {
  let supabase: { from: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    // Get reference to mocked supabase
    supabase = require("@/lib/supabase").supabase;
  });

  describe("empty creatorIds guard", () => {
    it("should NOT call .in() when challenges.length === 0", async () => {
      // Setup: challenge_participants query returns empty array
      const participantsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      // Make the chain resolve to empty data
      let eqCallCount = 0;
      participantsChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          // After both .eq() calls, return the final promise
          return Promise.resolve({ data: [], error: null });
        }
        return participantsChain;
      });

      // Track .in() calls explicitly
      const inCalls: unknown[][] = [];
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockImplementation((...args: unknown[]) => {
          inCalls.push(args);
          return Promise.resolve({ data: [], error: null });
        }),
      };

      // Track which tables are queried
      const queriedTables: string[] = [];
      supabase.from.mockImplementation((table: string) => {
        queriedTables.push(table);
        if (table === "challenge_participants") {
          return participantsChain;
        }
        if (table === "profiles_public") {
          return profilesChain;
        }
        return createChainMock([]);
      });

      // Import fresh to use mocks
      const { challengeService } = require("@/services/challenges");

      // Act
      const result = await challengeService.getPendingInvites();

      // Assert: returns empty list without error
      expect(result).toEqual([]);

      // Assert: profiles_public was NOT queried (no .in() call)
      expect(queriedTables).toContain("challenge_participants");
      expect(queriedTables).not.toContain("profiles_public");
      expect(inCalls).toHaveLength(0); // .in() should never be called
    });

    it("should NOT call .in() when all creator_ids are null/empty", async () => {
      // Setup: invites exist but all have null creator_id
      const mockInvites = [
        { joined_at: "2024-01-01", challenge: { id: "c1", creator_id: null } },
        { joined_at: "2024-01-02", challenge: { id: "c2", creator_id: null } },
      ];

      const participantsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
      let eqCallCount = 0;
      participantsChain.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ data: mockInvites, error: null });
        }
        return participantsChain;
      });

      // Track .in() calls explicitly
      const inCalls: unknown[][] = [];
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockImplementation((...args: unknown[]) => {
          inCalls.push(args);
          return Promise.resolve({ data: [], error: null });
        }),
      };

      const queriedTables: string[] = [];
      supabase.from.mockImplementation((table: string) => {
        queriedTables.push(table);
        if (table === "challenge_participants") {
          return participantsChain;
        }
        if (table === "profiles_public") {
          return profilesChain;
        }
        return createChainMock([]);
      });

      const { challengeService } = require("@/services/challenges");

      // Act
      const result = await challengeService.getPendingInvites();

      // Assert: returns invites with fallback profiles, no error
      expect(result).toHaveLength(2);

      // Assert: .in() was never called (empty creatorIds after filtering nulls)
      expect(queriedTables).not.toContain("profiles_public");
      expect(inCalls).toHaveLength(0);

      // Verify fallback profile is used
      expect(result[0].creator.username).toBe("Unknown");
      expect(result[1].creator.username).toBe("Unknown");
    });

    it("should query profiles_public when there are valid creator_ids", async () => {
      // Setup: invites with valid creator_ids
      const mockInvites = [
        {
          joined_at: "2024-01-01",
          challenge: { id: "c1", creator_id: "creator-1" },
        },
      ];
      const mockCreators = [
        {
          id: "creator-1",
          username: "alice",
          display_name: "Alice",
          avatar_url: null,
          updated_at: "2024-01-01",
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
          return Promise.resolve({ data: mockInvites, error: null });
        }
        return participantsChain;
      });

      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        in: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: mockCreators, error: null })
          ),
      };

      const queriedTables: string[] = [];
      supabase.from.mockImplementation((table: string) => {
        queriedTables.push(table);
        if (table === "challenge_participants") {
          return participantsChain;
        }
        if (table === "profiles_public") {
          return profilesChain;
        }
        return createChainMock([]);
      });

      const { challengeService } = require("@/services/challenges");

      // Act
      const result = await challengeService.getPendingInvites();

      // Assert
      expect(result).toHaveLength(1);
      expect(queriedTables).toContain("profiles_public");
      expect(result[0].creator.username).toBe("alice");
    });
  });
});
