// src/lib/username.ts
// Username normalization utilities

/**
 * Normalize username to lowercase for consistent storage and lookup.
 *
 * Note: The signUpSchema also applies .toLowerCase() via Zod transform,
 * but we apply it explicitly here for:
 * 1. Defense-in-depth (in case schema changes)
 * 2. Code clarity (makes normalization visible at call sites)
 * 3. Consistency with isUsernameAvailable behavior
 *
 * DATABASE NOTE: The profiles table should ideally enforce case-insensitive
 * uniqueness via CITEXT type or a unique index on LOWER(username) to prevent
 * race conditions between availability check and insert.
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}
