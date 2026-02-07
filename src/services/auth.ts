// src/services/auth.ts
// Authentication and profile management service

import { AuthError } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { getSupabaseClient, withAuth } from "@/lib/supabase";
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
   * RETRY: For new social-auth users, the profile may not exist yet because
   * the handle_new_user trigger hasn't completed. We retry up to MAX_RETRIES
   * times with a delay between attempts.
   *
   * TIMEOUT: 5 seconds per attempt. A primary key lookup should complete in <1s.
   * If all retries fail, something is wrong (network, Supabase, or auth context).
   */
  async getMyProfileWithUserId(userId: string): Promise<Profile> {
    const TIMEOUT_MS = 5000;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;
    const shortId = userId.substring(0, 8);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(
        `[AuthService] 📂 getMyProfileWithUserId attempt ${attempt}/${MAX_RETRIES} for ${shortId}`,
      );
      const startTime = Date.now();

      try {
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

        const { data, error } = await Promise.race([
          queryPromise,
          timeoutPromise,
        ]);
        const elapsed = Date.now() - startTime;

        if (error) {
          // PGRST116 = "JSON object requested, multiple (or no) rows returned"
          // This means the profile row doesn't exist yet (new user trigger lag)
          const isNotFound =
            error.code === "PGRST116" ||
            error.message?.includes("not found") ||
            error.message?.includes("no rows");

          if (isNotFound && attempt < MAX_RETRIES) {
            console.log(
              `[AuthService] ⏳ Profile not found for ${shortId} (${elapsed}ms), ` +
                `retrying in ${RETRY_DELAY_MS}ms (trigger may still be running)...`,
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }

          console.error(
            `[AuthService] ❌ Profile query failed for ${shortId} after ${elapsed}ms:`,
            error.code,
            error.message,
          );
          throw error;
        }

        if (!data) {
          if (attempt < MAX_RETRIES) {
            console.log(
              `[AuthService] ⏳ Profile null for ${shortId} (${elapsed}ms), ` +
                `retrying in ${RETRY_DELAY_MS}ms...`,
            );
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          throw new Error("Profile not found after all retries");
        }

        console.log(
          `[AuthService] ✅ Profile loaded for ${shortId} in ${elapsed}ms` +
            (attempt > 1 ? ` (attempt ${attempt})` : ""),
        );
        return data;
      } catch (err: any) {
        const elapsed = Date.now() - startTime;
        const isTimeout = err?.message?.includes("timed out");

        if (isTimeout && attempt < MAX_RETRIES) {
          console.warn(
            `[AuthService] ⏱️ Profile query timed out for ${shortId} (${elapsed}ms), ` +
              `retrying in ${RETRY_DELAY_MS}ms...`,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        console.error(
          `[AuthService] ❌ Profile query failed for ${shortId} after ${elapsed}ms ` +
            `(attempt ${attempt}/${MAX_RETRIES}):`,
          err?.message || err,
        );
        throw err;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error("Profile not found after all retries");
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

  /**
   * Sign in with Apple (native iOS)
   * Uses nonce-based replay protection and exchanges identity token with Supabase.
   * Profile is auto-created by database trigger for new users.
   *
   * Returns the Apple-provided display name (if any) so the caller can apply it
   * AFTER the profile is confirmed to exist. This avoids racing with the
   * handle_new_user trigger that creates the profile row.
   *
   * NOTE: Only available on iOS. Caller should check platform before invoking.
   */
  async signInWithApple(): Promise<{ appleDisplayName: string | null }> {
    if (Platform.OS !== "ios") {
      throw new Error("Apple Sign-In is only available on iOS");
    }

    // Check if Apple Sign-In is available on this device
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Apple Sign-In is not available on this device");
    }

    // Generate nonce for replay protection
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    // Present native Apple Sign-In dialog
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error("No identity token received from Apple");
    }

    // Exchange Apple identity token with Supabase
    const { error } = await getSupabaseClient().auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;

    // Extract display name from Apple credential (only provided on first sign-in).
    // Return it to caller instead of updating profile directly — the profile row
    // may not exist yet if handle_new_user trigger hasn't completed.
    let appleDisplayName: string | null = null;
    if (credential.fullName) {
      const name = [
        credential.fullName.givenName,
        credential.fullName.familyName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (name) {
        appleDisplayName = name;
      }
    }

    return { appleDisplayName };
  },

  /**
   * Sign in with Google (native)
   * Uses Google Sign-In SDK to get ID token, then exchanges with Supabase.
   * Profile is auto-created by database trigger for new users.
   *
   * PREREQUISITE: configureGoogleSignIn() must be called at app startup.
   */
  async signInWithGoogle(): Promise<void> {
    // Check if Google Play Services are available (Android only, always true on iOS)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Present native Google Sign-In dialog
    const response = await GoogleSignin.signIn();

    if (!response.data?.idToken) {
      throw new Error("No ID token received from Google");
    }

    // Exchange Google ID token with Supabase
    const { error } = await getSupabaseClient().auth.signInWithIdToken({
      provider: "google",
      token: response.data.idToken,
    });

    if (error) throw error;
  },
};

// =============================================================================
// GOOGLE SIGN-IN CONFIGURATION
// =============================================================================

/**
 * Configure Google Sign-In SDK.
 * Must be called once at app startup before any Google sign-in attempt.
 * Uses the Web Client ID for Supabase token exchange.
 */
export function configureGoogleSignIn(): void {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    console.warn(
      "[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set — Google Sign-In disabled",
    );
    return;
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
    scopes: ["email", "profile"],
  });
}
