// src/services/auth.ts
// Authentication and profile management service

import { AuthError } from "@supabase/supabase-js";
import { getSupabaseClient, requireUserId, withAuth } from "@/lib/supabase";
import {
  validate,
  signUpSchema,
  signInSchema,
  updateProfileSchema,
  SignUpInput,
  SignInInput,
  UpdateProfileInput,
} from "@/lib/validation";
import { normalizeUsername } from "@/lib/username";
import { clearPersistedQueryCache } from "@/lib/queryPersister";
import type { Profile, ProfilePublic } from "@/types/database";

// Re-export normalizeUsername for backward compatibility
// (callers can import from '@/services/auth' or '@/lib/username')
export { normalizeUsername };

// =============================================================================
// ERROR MAPPING
// =============================================================================

/**
 * Map sign-up errors to user-friendly messages.
 *
 * CRITICAL DEPENDENCY: Username uniqueness relies on DB constraint.
 * Defined in: supabase/migrations/001_initial_schema.sql
 *   Line 26: `username text unique not null`
 *
 * If this constraint is missing, the TOCTOU race condition returns and
 * duplicate usernames become possible. The error mapping below will also
 * fail silently (no 23505 error to catch).
 *
 * VERIFICATION: Run integration tests to verify constraint exists:
 *   npm run test:integration -- auth.constraints
 *   See: src/__tests__/integration/auth.constraints.integration.test.ts
 *
 * When the trigger fails due to duplicate username, Supabase may return:
 * - PostgreSQL error code 23505 (unique_violation)
 * - Message containing "duplicate key" or "unique constraint"
 * - Message containing "username" (from constraint name)
 *
 * We check multiple patterns defensively since error shape may vary.
 */
function mapSignUpError(error: AuthError): Error {
  const code = (error as AuthError & { code?: string }).code;
  const message = error.message?.toLowerCase() ?? "";

  // Username already taken (unique constraint violation)
  if (
    code === "23505" ||
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    (message.includes("unique") && message.includes("username"))
  ) {
    return new Error("Username is already taken");
  }

  // Email already registered
  if (
    message.includes("user already registered") ||
    message.includes("email already") ||
    message.includes("already been registered")
  ) {
    return new Error("An account with this email already exists");
  }

  // Password too weak (Supabase auth policy)
  if (message.includes("password")) {
    return new Error(error.message); // Pass through password policy messages
  }

  // Invalid email format
  if (message.includes("invalid") && message.includes("email")) {
    return new Error("Please enter a valid email address");
  }

  // Default: return original error
  return error;
}

// =============================================================================
// SERVICE
// =============================================================================

export const authService = {
  /**
   * Sign up a new user
   * Profile is auto-created by database trigger
   * Returns session info to determine if email confirmation is required
   *
   * NOTE: Username uniqueness is enforced by DB constraint, not pre-check.
   * Use isUsernameAvailable() for real-time UI hints only.
   */
  async signUp(
    input: unknown,
  ): Promise<{ session: import("@supabase/supabase-js").Session | null }> {
    // Validation applies .toLowerCase() transform to username
    const {
      email,
      password,
      username: validatedUsername,
    } = validate(signUpSchema, input);

    // Explicit normalization for defense-in-depth and clarity
    const username = normalizeUsername(validatedUsername);

    // Create auth user - profile created by trigger
    // Username uniqueness is enforced by DB constraint on profiles.username
    // onboarding_completed: false triggers the onboarding flow for new users
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          onboarding_completed: false, // New users need to complete onboarding
        },
      },
    });

    if (error) {
      // Map database errors to user-friendly messages
      throw mapSignUpError(error);
    }

    // Return session so caller can determine if email confirmation is pending
    return { session: data.session };
  },

  /**
   * Sign in an existing user
   */
  async signIn(input: unknown): Promise<void> {
    const { email, password } = validate(signInSchema, input);

    const { error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  },

  /**
   * Sign out the current user
   * GUARDRAIL 6: Clears persisted query cache to prevent data leakage
   */
  async signOut(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;

    // Clear persisted cache to prevent cross-account data leakage
    await clearPersistedQueryCache();
  },

  /**
   * Get the current user's full profile (private data)
   * CONTRACT: Only returns self data via RLS
   */
  async getMyProfile(): Promise<Profile> {
    return withAuth(async (userId) => {
      return this.getMyProfileWithUserId(userId);
    });
  },

  /**
   * Get the current user's full profile by userId (private data)
   * Use this variant when you already have the userId to avoid redundant getUser() calls.
   *
   * CONTRACT: Only returns self data via RLS
   * CALLER RESPONSIBILITY: Only call this after INITIAL_SESSION event has fired.
   * Calling before auth is fully initialized may result in RLS evaluation failures.
   *
   * TIMEOUT: 3 seconds. A primary key lookup should complete in <1s.
   * If this times out, something is wrong (network, Supabase, or auth context).
   */
  async getMyProfileWithUserId(userId: string): Promise<Profile> {
    const TIMEOUT_MS = 3000;

    const queryPromise = getSupabaseClient()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Profile query timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);
    });

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) throw error;
    if (!data) throw new Error("Profile not found");
    return data;
  },

  /**
   * Update the current user's profile
   * CONTRACT: Only self-update allowed via RLS
   */
  async updateProfile(input: unknown): Promise<Profile> {
    const validated = validate(updateProfileSchema, input);

    return withAuth(async (userId) => {
      const { data, error } = await getSupabaseClient()
        .from("profiles")
        .update(validated)
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("Profile not found");
      return data;
    });
  },

  /**
   * Check if a username is available (UX hint only).
   *
   * NOTE: This is for real-time UI feedback while typing, not authoritative.
   * The DB unique constraint on profiles.username is the source of truth.
   * Do NOT use this as a gate before signUp - that creates a TOCTOU race.
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const normalized = normalizeUsername(username);
    const { data, error } = await getSupabaseClient()
      .from("profiles_public")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    if (error) {
      throw new Error(
        "Unable to check username availability. Please try again.",
      );
    }

    return data === null;
  },

  /**
   * Get a user's public profile by ID
   * CONTRACT: Uses profiles_public, not profiles
   */
  async getPublicProfile(userId: string): Promise<ProfilePublic | null> {
    const { data, error } = await getSupabaseClient()
      .from("profiles_public")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Search for users by username
   * CONTRACT: Uses profiles_public for safe search
   */
  async searchUsers(query: string): Promise<ProfilePublic[]> {
    if (query.length < 2) return [];

    const { data, error } = await getSupabaseClient()
      .from("profiles_public")
      .select("*")
      .ilike("username", `%${query}%`)
      .limit(20);

    if (error) throw error;
    return data || [];
  },
};
