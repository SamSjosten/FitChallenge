// src/lib/sentry.ts
// Error reporting with Sentry

import * as Sentry from "@sentry/react-native";
import { Config } from "@/constants/config";

/**
 * Error patterns that should NOT be reported to Sentry.
 * These are expected errors (user issues, not bugs).
 */
const IGNORED_ERROR_PATTERNS = [
  // Auth errors (expected when user not logged in)
  /jwt expired/i,
  /jwt invalid/i,
  /invalid.*token/i,
  /authentication required/i,
  /not authenticated/i,

  // RLS/permission errors (expected, not bugs)
  /permission denied/i,
  /row.level security/i,
  /insufficient.privilege/i,

  // Validation errors (user input issues)
  /violates.*constraint/i,
  /duplicate key/i,
  /invalid input/i,
  /validation failed/i,

  // Network errors (transient, not actionable)
  /network request failed/i,
  /failed to fetch/i,
  /timeout/i,

  // Expected app states
  /not found/i,
  /no rows returned/i,
];

/**
 * PostgreSQL/PostgREST error codes to ignore
 */
const IGNORED_ERROR_CODES = new Set([
  // Constraint violations (user data issues)
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23502", // not_null_violation
  "22P02", // invalid_text_representation

  // Not found (expected)
  "PGRST116",

  // Auth (expected)
  "PGRST301", // JWT expired
  "PGRST302", // JWT invalid
]);

/**
 * Check if an error should be ignored (not reported to Sentry)
 */
function shouldIgnoreError(error: unknown): boolean {
  if (!error) return false;

  // Check error message patterns
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  for (const pattern of IGNORED_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }

  // Check error codes (Supabase/PostgreSQL)
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (IGNORED_ERROR_CODES.has(code)) {
      return true;
    }
  }

  return false;
}

/**
 * Initialize Sentry error reporting.
 *
 * Call this once at app startup (in _layout.tsx).
 *
 * Does nothing if:
 * - No DSN configured (development without Sentry)
 * - Already initialized
 */
export function initSentry(): void {
  // Skip if no DSN configured
  if (!Config.sentryDsn) {
    if (__DEV__) {
      console.log("[Sentry] Skipped: No DSN configured");
    }
    return;
  }

  // Skip in development
  if (__DEV__) {
    console.log("[Sentry] Skipped: Development mode");
    return;
  }

  Sentry.init({
    dsn: Config.sentryDsn,

    // Only send errors in production
    enabled: true, // Already gated by __DEV__ check above

    // Set environment
    environment: "production",

    // Sample rate for performance monitoring (disabled for now)
    tracesSampleRate: 0,

    // Mobile replay — only in production with a DSN
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

    // Filter out expected errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      if (shouldIgnoreError(error)) {
        // Return null to drop the event
        return null;
      }

      return event;
    },

    // Add useful context
    initialScope: {
      tags: {
        app: "fitchallenge",
      },
    },
  });

  console.log("[Sentry] Initialized with mobile replay");
}

/**
 * Manually capture an exception.
 *
 * Use this for caught errors that indicate bugs:
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureError(error, { context: 'riskyOperation' });
 *   // Handle error for user...
 * }
 * ```
 *
 * Does NOT report:
 * - Auth/validation errors (expected, not bugs)
 * - Network errors (transient)
 */
export function captureError(error: unknown, context?: Record<string, string>): void {
  // Skip ignored errors
  if (shouldIgnoreError(error)) {
    return;
  }

  // Skip if Sentry not configured
  if (!Config.sentryDsn) {
    if (__DEV__) {
      console.error("[Sentry] Would capture:", error, context);
    }
    return;
  }

  Sentry.captureException(error, {
    tags: context,
  });
}

/**
 * Set user context for error reports.
 *
 * Call when user logs in:
 * ```ts
 * setUserContext({ id: user.id });
 * ```
 *
 * Call with null when user logs out:
 * ```ts
 * setUserContext(null);
 * ```
 */
export function setUserContext(user: { id: string } | null): void {
  if (!Config.sentryDsn) return;

  if (user) {
    Sentry.setUser({ id: user.id });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging context.
 *
 * Use sparingly for important state transitions:
 * ```ts
 * addBreadcrumb('challenge_created', { challengeId: '...' });
 * ```
 */
export function addBreadcrumb(message: string, data?: Record<string, string>): void {
  if (!Config.sentryDsn) return;

  Sentry.addBreadcrumb({
    message,
    data,
    level: "info",
  });
}
