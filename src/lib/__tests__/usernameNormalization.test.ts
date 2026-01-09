// src/lib/__tests__/usernameNormalization.test.ts
// Tests for consistent username normalization

import { normalizeUsername } from "../username";

describe("normalizeUsername", () => {
  describe("lowercase conversion", () => {
    test("converts uppercase to lowercase", () => {
      expect(normalizeUsername("JOHNDOE")).toBe("johndoe");
    });

    test("converts mixed case to lowercase", () => {
      expect(normalizeUsername("JohnDoe")).toBe("johndoe");
    });

    test("preserves already lowercase", () => {
      expect(normalizeUsername("johndoe")).toBe("johndoe");
    });

    test("handles single character", () => {
      expect(normalizeUsername("A")).toBe("a");
    });

    test("handles numbers (unchanged)", () => {
      expect(normalizeUsername("User123")).toBe("user123");
    });

    test("handles underscores (unchanged)", () => {
      expect(normalizeUsername("John_Doe")).toBe("john_doe");
    });

    test("handles mixed alphanumeric with underscores", () => {
      expect(normalizeUsername("John_Doe_123")).toBe("john_doe_123");
    });
  });

  describe("edge cases", () => {
    test("handles empty string", () => {
      expect(normalizeUsername("")).toBe("");
    });

    test("handles string with only numbers", () => {
      expect(normalizeUsername("12345")).toBe("12345");
    });

    test("handles string with only underscores", () => {
      expect(normalizeUsername("___")).toBe("___");
    });
  });

  describe("consistency verification", () => {
    test("different case variants normalize to same value", () => {
      const variants = ["JohnDoe", "johndoe", "JOHNDOE", "jOhNdOe", "johnDOE"];
      const normalized = variants.map(normalizeUsername);

      // All should be the same
      expect(new Set(normalized).size).toBe(1);
      expect(normalized[0]).toBe("johndoe");
    });

    test("normalization is idempotent", () => {
      const original = "JohnDoe";
      const once = normalizeUsername(original);
      const twice = normalizeUsername(once);
      const thrice = normalizeUsername(twice);

      expect(once).toBe(twice);
      expect(twice).toBe(thrice);
    });
  });
});

describe("username normalization integration", () => {
  /**
   * These tests verify that the normalization approach prevents
   * case-variant duplicates. In a real integration test, you would
   * mock Supabase, but here we test the normalization logic itself.
   */

  describe("duplicate prevention scenarios", () => {
    // Simulated database of existing usernames (all stored lowercase)
    const existingUsernames = new Set(["johndoe", "alice", "bob123"]);

    // Simulated isUsernameAvailable check
    const isAvailable = (username: string): boolean => {
      const normalized = normalizeUsername(username);
      return !existingUsernames.has(normalized);
    };

    test("rejects exact match", () => {
      expect(isAvailable("johndoe")).toBe(false);
    });

    test("rejects uppercase variant", () => {
      expect(isAvailable("JOHNDOE")).toBe(false);
    });

    test("rejects mixed case variant", () => {
      expect(isAvailable("JohnDoe")).toBe(false);
    });

    test("rejects camelCase variant", () => {
      expect(isAvailable("johnDoe")).toBe(false);
    });

    test("accepts genuinely new username", () => {
      expect(isAvailable("janedoe")).toBe(true);
    });

    test("accepts new username regardless of input case", () => {
      expect(isAvailable("JaneDoe")).toBe(true);
      expect(isAvailable("JANEDOE")).toBe(true);
      expect(isAvailable("janedoe")).toBe(true);
    });
  });

  describe("signup flow simulation", () => {
    // Simulates the signup flow's normalization
    const simulateSignup = (inputUsername: string): string => {
      // This mirrors what happens in signUp():
      // 1. Validation transforms to lowercase (via Zod)
      // 2. normalizeUsername applied for defense-in-depth
      return normalizeUsername(inputUsername.toLowerCase());
    };

    test('user signs up with "JohnDoe" stores as "johndoe"', () => {
      expect(simulateSignup("JohnDoe")).toBe("johndoe");
    });

    test('user signs up with "JOHNDOE" stores as "johndoe"', () => {
      expect(simulateSignup("JOHNDOE")).toBe("johndoe");
    });

    test("different case inputs result in same stored value", () => {
      const inputs = ["User_One", "USER_ONE", "user_one", "User_ONE"];
      const stored = inputs.map(simulateSignup);

      expect(new Set(stored).size).toBe(1);
      expect(stored[0]).toBe("user_one");
    });
  });
});
