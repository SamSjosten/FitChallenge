// src/lib/__tests__/queryRetry.test.ts
// Unit tests for React Query retry strategy

import { shouldRetryError, queryRetryFn, mutationRetryFn } from "../queryRetry";

// =============================================================================
// shouldRetryError TESTS
// =============================================================================

describe("shouldRetryError", () => {
  describe("should NOT retry auth/permission errors", () => {
    it("should not retry 401 Unauthorized", () => {
      const error = { status: 401, message: "Unauthorized" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry 403 Forbidden", () => {
      const error = { status: 403, message: "Forbidden" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry JWT expired error", () => {
      const error = { code: "PGRST301", message: "JWT expired" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry JWT invalid error", () => {
      const error = { code: "PGRST302", message: "JWT invalid" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry authentication required message", () => {
      const error = {
        message: "Authentication required to perform this action",
      };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry permission denied message", () => {
      const error = { message: "Permission denied for table challenges" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry RLS error by code", () => {
      const error = { code: "42501", message: "insufficient_privilege" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry RLS error by message", () => {
      const error = { message: "new row violates row-level security policy" };
      expect(shouldRetryError(error)).toBe(false);
    });
  });

  describe("should NOT retry validation/constraint errors", () => {
    it("should not retry duplicate key violation", () => {
      const error = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry foreign key violation", () => {
      const error = { code: "23503", message: "foreign key violation" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry not null violation", () => {
      const error = { code: "23502", message: "null value not allowed" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry invalid input syntax", () => {
      const error = {
        code: "22P02",
        message: "invalid input syntax for type uuid",
      };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry 400 Bad Request", () => {
      const error = { status: 400, message: "Bad Request" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry 422 Unprocessable Entity", () => {
      const error = { status: 422, message: "Validation failed" };
      expect(shouldRetryError(error)).toBe(false);
    });
  });

  describe("should NOT retry not found errors", () => {
    it("should not retry PGRST116 (no rows returned)", () => {
      const error = { code: "PGRST116", message: "No rows returned" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry 404 Not Found", () => {
      const error = { status: 404, message: "Not Found" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should not retry 'not found' message pattern", () => {
      const error = { message: "Challenge not found" };
      expect(shouldRetryError(error)).toBe(false);
    });
  });

  describe("should retry transient errors", () => {
    it("should retry 500 Internal Server Error", () => {
      const error = { status: 500, message: "Internal Server Error" };
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry 502 Bad Gateway", () => {
      const error = { status: 502, message: "Bad Gateway" };
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry 503 Service Unavailable", () => {
      const error = { status: 503, message: "Service Unavailable" };
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry network fetch errors", () => {
      const error = new TypeError("Failed to fetch");
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry unknown errors (default to retry)", () => {
      const error = new Error("Something went wrong");
      expect(shouldRetryError(error)).toBe(true);
    });

    it("should retry errors with no recognizable structure", () => {
      const error = { someRandomProperty: "value" };
      expect(shouldRetryError(error)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle null error", () => {
      expect(shouldRetryError(null)).toBe(true);
    });

    it("should handle undefined error", () => {
      expect(shouldRetryError(undefined)).toBe(true);
    });

    it("should handle string error", () => {
      expect(shouldRetryError("Some error string")).toBe(true);
    });

    it("should not retry 409 Conflict", () => {
      const error = { status: 409, message: "Conflict" };
      expect(shouldRetryError(error)).toBe(false);
    });

    it("should handle statusCode property (alternative Supabase format)", () => {
      const error = { statusCode: 401, message: "Unauthorized" };
      expect(shouldRetryError(error)).toBe(false);
    });
  });
});

// =============================================================================
// queryRetryFn TESTS
// =============================================================================

describe("queryRetryFn", () => {
  it("should retry retryable errors up to 3 times", () => {
    const serverError = { status: 500, message: "Server Error" };

    expect(queryRetryFn(0, serverError)).toBe(true);
    expect(queryRetryFn(1, serverError)).toBe(true);
    expect(queryRetryFn(2, serverError)).toBe(true);
    expect(queryRetryFn(3, serverError)).toBe(false); // Max reached
  });

  it("should not retry non-retryable errors even on first failure", () => {
    const authError = { status: 401, message: "Unauthorized" };

    expect(queryRetryFn(0, authError)).toBe(false);
  });

  it("should stop after max retries", () => {
    const networkError = new TypeError("Failed to fetch");

    expect(queryRetryFn(5, networkError)).toBe(false);
  });
});

// =============================================================================
// mutationRetryFn TESTS
// =============================================================================

describe("mutationRetryFn", () => {
  it("should only retry network errors", () => {
    const networkError = new TypeError("Failed to fetch");

    expect(mutationRetryFn(0, networkError)).toBe(true);
    expect(mutationRetryFn(1, networkError)).toBe(false); // Max 1 retry
  });

  it("should not retry server errors (mutations not idempotent)", () => {
    const serverError = { status: 500, message: "Server Error" };

    expect(mutationRetryFn(0, serverError)).toBe(false);
  });

  it("should not retry auth errors", () => {
    const authError = { status: 401, message: "Unauthorized" };

    expect(mutationRetryFn(0, authError)).toBe(false);
  });

  it("should retry timeout errors", () => {
    const timeoutError = { message: "Request timeout" };

    expect(mutationRetryFn(0, timeoutError)).toBe(true);
  });

  it("should not retry validation errors", () => {
    const validationError = { code: "23505", message: "duplicate key" };

    expect(mutationRetryFn(0, validationError)).toBe(false);
  });
});
