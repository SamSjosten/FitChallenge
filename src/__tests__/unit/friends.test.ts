// src/__tests__/unit/friends.test.ts
// Unit tests for friends service validation and auth patterns

/**
 * Tests for friendsService mutations:
 * - Input validation (Zod schemas)
 * - Authentication (withAuth wrapper)
 * - Database calls (correct data passed to Supabase)
 *
 * These tests verify P2-1: friends service consistency with codebase patterns.
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

// Track auth state for withAuth mock
let mockAuthenticatedUserId: string | null = null;

// Track Supabase calls
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

// Chain mock for fluent Supabase API
const createChainMock = (
  finalData: unknown = null,
  finalError: unknown = null,
) => {
  const chain = {
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockImplementation(() => {
      return Promise.resolve({ data: finalData, error: finalError });
    }),
  };
  return chain;
};

// Mock supabase module
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
  withAuth: jest.fn((operation) => {
    if (!mockAuthenticatedUserId) {
      return Promise.reject(new Error("Authentication required"));
    }
    return operation(mockAuthenticatedUserId);
  }),
}));

// =============================================================================
// TEST HELPERS
// =============================================================================

function setAuthenticatedUser(userId: string) {
  mockAuthenticatedUserId = userId;
}

function clearAuthenticatedUser() {
  mockAuthenticatedUserId = null;
}

// Valid UUID for testing
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_TARGET_UUID = "660e8400-e29b-41d4-a716-446655440001";

// =============================================================================
// TESTS
// =============================================================================

describe("friendsService", () => {
  let supabase: { from: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthenticatedUser();
    supabase = require("@/lib/supabase").supabase;
    supabase.from.mockImplementation(() => createChainMock());
  });

  // ===========================================================================
  // sendRequest
  // ===========================================================================
  describe("sendRequest", () => {
    describe("validation", () => {
      beforeEach(() => {
        setAuthenticatedUser("user-123");
      });

      it("should reject invalid UUID for target_user_id", async () => {
        const { friendsService } = require("@/services/friends");
        const { ValidationError } = require("@/lib/validation");

        try {
          await friendsService.sendRequest({ target_user_id: "not-a-uuid" });
          fail("Should have thrown ValidationError");
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as { firstError: string }).firstError).toBe(
            "Invalid ID format",
          );
        }
      });

      it("should reject missing target_user_id", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(friendsService.sendRequest({})).rejects.toThrow(
          "Validation failed",
        );
      });

      it("should reject null input", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(friendsService.sendRequest(null)).rejects.toThrow();
      });

      it("should accept valid UUID", async () => {
        const { friendsService } = require("@/services/friends");

        // Should not throw validation error (may throw other errors)
        await expect(
          friendsService.sendRequest({ target_user_id: VALID_TARGET_UUID }),
        ).resolves.not.toThrow();
      });
    });

    describe("authentication", () => {
      it("should reject unauthenticated users", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.sendRequest({ target_user_id: VALID_TARGET_UUID }),
        ).rejects.toThrow("Authentication required");
      });

      it("should not call database when unauthenticated", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        try {
          await friendsService.sendRequest({
            target_user_id: VALID_TARGET_UUID,
          });
        } catch {
          // Expected to throw
        }

        expect(supabase.from).not.toHaveBeenCalled();
      });
    });

    describe("self-request prevention", () => {
      it("should reject sending request to self", async () => {
        const userId = VALID_UUID;
        setAuthenticatedUser(userId);
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.sendRequest({ target_user_id: userId }),
        ).rejects.toThrow("Cannot send friend request to yourself");
      });
    });

    describe("database interaction", () => {
      it("should insert with correct data", async () => {
        setAuthenticatedUser("user-123");
        const { friendsService } = require("@/services/friends");

        await friendsService.sendRequest({ target_user_id: VALID_TARGET_UUID });

        expect(supabase.from).toHaveBeenCalledWith("friends");
        expect(mockInsert).toHaveBeenCalledWith({
          requested_by: "user-123",
          requested_to: VALID_TARGET_UUID,
          status: "pending",
        });
      });
    });
  });

  // ===========================================================================
  // acceptRequest
  // ===========================================================================
  describe("acceptRequest", () => {
    describe("validation", () => {
      beforeEach(() => {
        setAuthenticatedUser("user-123");
      });

      it("should reject invalid UUID for friendship_id", async () => {
        const { friendsService } = require("@/services/friends");
        const { ValidationError } = require("@/lib/validation");

        try {
          await friendsService.acceptRequest({ friendship_id: "not-a-uuid" });
          fail("Should have thrown ValidationError");
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as { firstError: string }).firstError).toBe(
            "Invalid ID format",
          );
        }
      });

      it("should reject missing friendship_id", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(friendsService.acceptRequest({})).rejects.toThrow(
          "Validation failed",
        );
      });

      it("should accept valid UUID", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.acceptRequest({ friendship_id: VALID_UUID }),
        ).resolves.not.toThrow();
      });
    });

    describe("authentication", () => {
      it("should reject unauthenticated users", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.acceptRequest({ friendship_id: VALID_UUID }),
        ).rejects.toThrow("Authentication required");
      });

      it("should not call database when unauthenticated", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        try {
          await friendsService.acceptRequest({ friendship_id: VALID_UUID });
        } catch {
          // Expected to throw
        }

        expect(supabase.from).not.toHaveBeenCalled();
      });
    });

    describe("database interaction", () => {
      it("should update status to accepted", async () => {
        setAuthenticatedUser("user-123");
        const { friendsService } = require("@/services/friends");

        await friendsService.acceptRequest({ friendship_id: VALID_UUID });

        expect(supabase.from).toHaveBeenCalledWith("friends");
        expect(mockUpdate).toHaveBeenCalledWith({ status: "accepted" });
        expect(mockEq).toHaveBeenCalledWith("id", VALID_UUID);
      });
    });
  });

  // ===========================================================================
  // declineRequest
  // ===========================================================================
  describe("declineRequest", () => {
    describe("validation", () => {
      beforeEach(() => {
        setAuthenticatedUser("user-123");
      });

      it("should reject invalid UUID for friendship_id", async () => {
        const { friendsService } = require("@/services/friends");
        const { ValidationError } = require("@/lib/validation");

        try {
          await friendsService.declineRequest({ friendship_id: "invalid" });
          fail("Should have thrown ValidationError");
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as { firstError: string }).firstError).toBe(
            "Invalid ID format",
          );
        }
      });

      it("should reject empty string", async () => {
        const { friendsService } = require("@/services/friends");
        const { ValidationError } = require("@/lib/validation");

        try {
          await friendsService.declineRequest({ friendship_id: "" });
          fail("Should have thrown ValidationError");
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as { firstError: string }).firstError).toBe(
            "Invalid ID format",
          );
        }
      });

      it("should accept valid UUID", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.declineRequest({ friendship_id: VALID_UUID }),
        ).resolves.not.toThrow();
      });
    });

    describe("authentication", () => {
      it("should reject unauthenticated users", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.declineRequest({ friendship_id: VALID_UUID }),
        ).rejects.toThrow("Authentication required");
      });

      it("should not call database when unauthenticated", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        try {
          await friendsService.declineRequest({ friendship_id: VALID_UUID });
        } catch {
          // Expected to throw
        }

        expect(supabase.from).not.toHaveBeenCalled();
      });
    });

    describe("database interaction", () => {
      it("should delete the friendship row", async () => {
        setAuthenticatedUser("user-123");
        const { friendsService } = require("@/services/friends");

        await friendsService.declineRequest({ friendship_id: VALID_UUID });

        expect(supabase.from).toHaveBeenCalledWith("friends");
        expect(mockDelete).toHaveBeenCalled();
        expect(mockEq).toHaveBeenCalledWith("id", VALID_UUID);
      });
    });
  });

  // ===========================================================================
  // removeFriend
  // ===========================================================================
  describe("removeFriend", () => {
    describe("validation", () => {
      beforeEach(() => {
        setAuthenticatedUser("user-123");
      });

      it("should reject invalid UUID for friendship_id", async () => {
        const { friendsService } = require("@/services/friends");
        const { ValidationError } = require("@/lib/validation");

        try {
          await friendsService.removeFriend({ friendship_id: "bad-id" });
          fail("Should have thrown ValidationError");
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as { firstError: string }).firstError).toBe(
            "Invalid ID format",
          );
        }
      });

      it("should reject undefined input", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(friendsService.removeFriend(undefined)).rejects.toThrow();
      });

      it("should accept valid UUID", async () => {
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.removeFriend({ friendship_id: VALID_UUID }),
        ).resolves.not.toThrow();
      });
    });

    describe("authentication", () => {
      it("should reject unauthenticated users", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        await expect(
          friendsService.removeFriend({ friendship_id: VALID_UUID }),
        ).rejects.toThrow("Authentication required");
      });

      it("should not call database when unauthenticated", async () => {
        clearAuthenticatedUser();
        const { friendsService } = require("@/services/friends");

        try {
          await friendsService.removeFriend({ friendship_id: VALID_UUID });
        } catch {
          // Expected to throw
        }

        expect(supabase.from).not.toHaveBeenCalled();
      });
    });

    describe("database interaction", () => {
      it("should delete the friendship row", async () => {
        setAuthenticatedUser("user-123");
        const { friendsService } = require("@/services/friends");

        await friendsService.removeFriend({ friendship_id: VALID_UUID });

        expect(supabase.from).toHaveBeenCalledWith("friends");
        expect(mockDelete).toHaveBeenCalled();
        expect(mockEq).toHaveBeenCalledWith("id", VALID_UUID);
      });
    });
  });

  // ===========================================================================
  // Validation error structure
  // ===========================================================================
  describe("ValidationError structure", () => {
    beforeEach(() => {
      setAuthenticatedUser("user-123");
    });

    it("should throw ValidationError with field information", async () => {
      const { friendsService } = require("@/services/friends");
      const { ValidationError } = require("@/lib/validation");

      try {
        await friendsService.sendRequest({ target_user_id: "invalid" });
        fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(
          (error as { errors: Array<{ field: string }> }).errors[0].field,
        ).toBe("target_user_id");
      }
    });
  });
});

// =============================================================================
// Validation schema tests (pure, no mocks needed)
// =============================================================================
describe("friends validation schemas", () => {
  const {
    sendFriendRequestSchema,
    acceptFriendRequestSchema,
    declineFriendRequestSchema,
    removeFriendSchema,
  } = require("@/lib/validation");

  describe("sendFriendRequestSchema", () => {
    it("should accept valid input", () => {
      const result = sendFriendRequestSchema.safeParse({
        target_user_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = sendFriendRequestSchema.safeParse({
        target_user_id: "not-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing field", () => {
      const result = sendFriendRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("acceptFriendRequestSchema", () => {
    it("should accept valid input", () => {
      const result = acceptFriendRequestSchema.safeParse({
        friendship_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = acceptFriendRequestSchema.safeParse({
        friendship_id: "123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("declineFriendRequestSchema", () => {
    it("should accept valid input", () => {
      const result = declineFriendRequestSchema.safeParse({
        friendship_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty string", () => {
      const result = declineFriendRequestSchema.safeParse({
        friendship_id: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("removeFriendSchema", () => {
    it("should accept valid input", () => {
      const result = removeFriendSchema.safeParse({
        friendship_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it("should reject null", () => {
      const result = removeFriendSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });
});
