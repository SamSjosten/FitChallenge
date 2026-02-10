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
 * Message patterns that indicate transient network errors worth retrying.
 * These provide explicit positive matching for common mobile/network errors.
 */
const RETRYABLE_NETWORK_PATTERNS = [
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
  /ECONNABORTED/i,
  /network request failed/i,
  /network error/i,
  /socket hang up/i,
  /timeout/i,
];

/**
 * Type guard to check if error has Supabase/PostgrestError shape
 */
interface SupabaseError {
  code?: string;
  status?: number;
  message?: string;
  statusCode?: number; // Some Supabase errors use this
  name?: string; // Error name (e.g., AbortError)
}

function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "status" in error || "message" in error)
  );
}

/**
 * Check if an error is an AbortError (request was cancelled).
 * AbortError can be a DOMException (web) or Error with name 'AbortError' (React Native).
 * Also checks message as fallback for edge cases where abort surfaces differently.
 *
 * Note: ECONNABORTED is a network socket error, NOT a user-initiated abort.
 */
function isAbortError(error: unknown): boolean {
  // Check Error instance with name
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  // Check for Supabase error structure with AbortError name
  if (isSupabaseError(error) && error.name === "AbortError") {
    return true;
  }
  // Fallback: check message for abort indicators (some RN cases)
  // Exclude ECONNABORTED which is a network error, not a user cancellation
  const message = (error as { message?: string })?.message ?? "";
  if (/ECONN/i.test(message)) {
    return false; // Network error codes like ECONNABORTED, ECONNRESET, etc.
  }
  if (/\babort/i.test(message)) {
    return true;
  }
  return false;
}

/**
 * Check if error message matches any retryable network patterns.
 */
function matchesRetryablePattern(message: string): boolean {
  return RETRYABLE_NETWORK_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Determines if an error should be retried.
 *
 * Returns false for:
 * - AbortError (request was cancelled)
 * - Auth errors (401, 403, JWT issues)
 * - RLS/permission errors
 * - Validation/constraint errors
 * - Client errors (4xx)
 *
 * Returns true for:
 * - Network errors (ETIMEDOUT, ECONNRESET, etc.)
 * - Server errors (5xx)
 * - Timeouts
 * - Unknown errors (err on side of retrying)
 */
export function shouldRetryError(error: unknown): boolean {
  // AbortError - request was cancelled, don't retry
  if (isAbortError(error)) {
    return false;
  }

  // TypeError - often indicates network failure
  // Expand detection beyond just "fetch" to catch mobile network errors
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed")) {
      return true;
    }
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

    // Check message for non-retryable patterns
    if (error.message) {
      for (const pattern of NON_RETRYABLE_PATTERNS) {
        if (pattern.test(error.message)) {
          return false;
        }
      }

      // Check message for retryable network patterns (explicit positive match)
      if (matchesRetryablePattern(error.message)) {
        return true;
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

  // AbortError - don't retry cancelled requests
  if (isAbortError(error)) {
    return false;
  }

  // Only retry obvious network failures (expanded detection)
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed")) {
      return true;
    }
  }

  // Check for timeout or network errors in Supabase error structure
  if (isSupabaseError(error) && error.message) {
    if (matchesRetryablePattern(error.message)) {
      return true;
    }
  }

  // Don't retry other errors for mutations
  return false;
}
