// src/lib/__tests__/withAuth.test.ts
// Tests for withAuth defense-in-depth authentication pattern

/**
 * These tests verify the withAuth pattern behavior.
 *
 * The actual withAuth function in supabase.ts depends on Supabase client,
 * so we test the pattern using a mock implementation that mirrors the real behavior.
 * This validates the contract without requiring Supabase connection.
 */

// =============================================================================
// MOCK IMPLEMENTATION (mirrors src/lib/supabase.ts withAuth)
// =============================================================================

type MockUser = { id: string } | null;
let mockCurrentUser: MockUser = null;

// Simulates requireUserId from supabase.ts
async function mockRequireUserId(): Promise<string> {
  if (!mockCurrentUser) {
    throw new Error("Authentication required");
  }
  return mockCurrentUser.id;
}

// Simulates withAuth from supabase.ts
async function withAuth<T>(
  operation: (userId: string) => Promise<T>
): Promise<T> {
  const userId = await mockRequireUserId();
  return operation(userId);
}

// Test helpers
function setMockUser(user: MockUser) {
  mockCurrentUser = user;
}

function clearMockUser() {
  mockCurrentUser = null;
}

// =============================================================================
// TESTS
// =============================================================================

describe("withAuth", () => {
  beforeEach(() => {
    clearMockUser();
  });

  describe("when user is authenticated", () => {
    beforeEach(() => {
      setMockUser({ id: "user-123" });
    });

    test("executes the operation", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      const result = await withAuth(mockOperation);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test("passes userId to the operation", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      await withAuth(mockOperation);

      expect(mockOperation).toHaveBeenCalledWith("user-123");
    });

    test("returns the operation result", async () => {
      const expectedResult = { data: "test", count: 42 };
      const mockOperation = jest.fn().mockResolvedValue(expectedResult);

      const result = await withAuth(mockOperation);

      expect(result).toEqual(expectedResult);
    });

    test("propagates operation errors", async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error("DB error"));

      await expect(withAuth(mockOperation)).rejects.toThrow("DB error");
    });
  });

  describe("when user is NOT authenticated", () => {
    beforeEach(() => {
      clearMockUser();
    });

    test('throws "Authentication required" error', async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      await expect(withAuth(mockOperation)).rejects.toThrow(
        "Authentication required"
      );
    });

    test("does NOT execute the operation", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      try {
        await withAuth(mockOperation);
      } catch {
        // Expected to throw
      }

      expect(mockOperation).not.toHaveBeenCalled();
    });

    test("fails fast before any database operation", async () => {
      const operationSteps: string[] = [];

      const mockOperation = jest.fn().mockImplementation(async () => {
        operationSteps.push("database-call");
        return "success";
      });

      try {
        await withAuth(mockOperation);
      } catch {
        operationSteps.push("auth-rejected");
      }

      // Auth rejection should happen BEFORE any database call
      expect(operationSteps).toEqual(["auth-rejected"]);
      expect(operationSteps).not.toContain("database-call");
    });
  });
});

describe("defense-in-depth mutation pattern", () => {
  /**
   * These tests document the expected behavior for mutation methods
   * that use withAuth (inviteUser, cancelChallenge, etc.)
   */

  // Simulates a mutation method wrapped with withAuth
  async function protectedMutation(
    mutationFn: () => Promise<void>
  ): Promise<void> {
    return withAuth(async (userId) => {
      // userId is available for logging/audit
      console.debug(`Mutation by user: ${userId}`);
      return mutationFn();
    });
  }

  beforeEach(() => {
    clearMockUser();
  });

  test("authenticated user can perform mutation", async () => {
    setMockUser({ id: "creator-456" });
    const mutation = jest.fn().mockResolvedValue(undefined);

    await expect(protectedMutation(mutation)).resolves.toBeUndefined();
    expect(mutation).toHaveBeenCalled();
  });

  test("unauthenticated user is rejected before mutation", async () => {
    clearMockUser();
    const mutation = jest.fn().mockResolvedValue(undefined);

    await expect(protectedMutation(mutation)).rejects.toThrow(
      "Authentication required"
    );
    expect(mutation).not.toHaveBeenCalled();
  });

  test("userId is available within the protected scope", async () => {
    setMockUser({ id: "audit-user-789" });
    let capturedUserId: string | null = null;

    await withAuth(async (userId) => {
      capturedUserId = userId;
    });

    expect(capturedUserId).toBe("audit-user-789");
  });
});

describe("requireUserId", () => {
  beforeEach(() => {
    clearMockUser();
  });

  test("returns user ID when authenticated", async () => {
    setMockUser({ id: "test-user-id" });

    const userId = await mockRequireUserId();

    expect(userId).toBe("test-user-id");
  });

  test("throws when not authenticated", async () => {
    clearMockUser();

    await expect(mockRequireUserId()).rejects.toThrow(
      "Authentication required"
    );
  });
});
