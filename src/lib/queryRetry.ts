// src/lib/queryRetry.ts
// Smart retry strategy for React Query with Supabase

/**
 * Error codes that should NOT be retried.
 * These are client errors where retrying won't help.
 */
const NON_RETRYABLE_CODES = new Set([
  // PostgreSQL constraint violations
  "23505", // unique_violation (duplicate key)
  "23503", // foreign_key_violation
  "23502", // not_null_violation
  "22P02", // invalid_text_representation (invalid input syntax)
  "22003", // numeric_value_out_of_range

  // PostgREST errors
  "PGRST116", // Not found (no rows returned)
  "PGRST301", // JWT expired
  "PGRST302", // JWT invalid

  // RLS / Permission errors
  "42501", // insufficient_privilege
  "42000", // syntax_error_or_access_rule_violation
]);

/**
 * HTTP status codes that should NOT be retried.
 */
const NON_RETRYABLE_STATUS = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  409, // Conflict
  422, // Unprocessable Entity
]);

/**
 * Message patterns that indicate non-retryable errors.
 */
const NON_RETRYABLE_PATTERNS = [
  /jwt expired/i,
  /jwt invalid/i,
  /invalid.*token/i,
  /authentication required/i,
  /permission denied/i,
  /row.level security/i,
  /rls/i,
  /violates.*constraint/i,
  /duplicate key/i,
  /not found/i,
  /invalid input/i,
];

/**
 * Type guard to check if error has Supabase/PostgrestError shape
 */
interface SupabaseError {
  code?: string;
  status?: number;
  message?: string;
  statusCode?: number; // Some Supabase errors use this
}

function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "status" in error || "message" in error)
  );
}

/**
 * Determines if an error should be retried.
 *
 * Returns false for:
 * - Auth errors (401, 403, JWT issues)
 * - RLS/permission errors
 * - Validation/constraint errors
 * - Client errors (4xx)
 *
 * Returns true for:
 * - Network errors
 * - Server errors (5xx)
 * - Timeouts
 * - Unknown errors (err on side of retrying)
 */
export function shouldRetryError(error: unknown): boolean {
  // Network errors (fetch failed, no response) - should retry
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Check Supabase error structure
  if (isSupabaseError(error)) {
    // Check error code
    if (error.code && NON_RETRYABLE_CODES.has(error.code)) {
      return false;
    }

    // Check HTTP status
    const status = error.status ?? error.statusCode;
    if (status) {
      // 4xx errors - don't retry
      if (status >= 400 && status < 500) {
        return false;
      }
      // 5xx errors - retry
      if (status >= 500) {
        return true;
      }
    }

    // Check message patterns
    if (error.message) {
      for (const pattern of NON_RETRYABLE_PATTERNS) {
        if (pattern.test(error.message)) {
          return false;
        }
      }
    }
  }

  // Default: retry unknown errors (network issues often don't have clear structure)
  return true;
}

/**
 * React Query retry function.
 *
 * Usage:
 * ```ts
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: {
 *       retry: queryRetryFn,
 *     },
 *   },
 * });
 * ```
 *
 * @param failureCount - Number of times the query has failed
 * @param error - The error that caused the failure
 * @returns Whether to retry (true) or not (false)
 */
export function queryRetryFn(failureCount: number, error: unknown): boolean {
  // Max 3 retries
  if (failureCount >= 3) {
    return false;
  }

  return shouldRetryError(error);
}

/**
 * Mutation retry function - more conservative than queries.
 * Only retries on clear network errors, not server errors.
 *
 * Mutations are not idempotent by default, so we're more careful.
 */
export function mutationRetryFn(failureCount: number, error: unknown): boolean {
  // Max 1 retry for mutations
  if (failureCount >= 1) {
    return false;
  }

  // Only retry obvious network failures
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Check for timeout
  if (isSupabaseError(error) && error.message?.includes("timeout")) {
    return true;
  }

  // Don't retry other errors for mutations
  return false;
}
