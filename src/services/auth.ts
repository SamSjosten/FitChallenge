// src/services/auth.ts
// Authentication and profile management service

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
import type { Profile, ProfilePublic } from "@/types/database";

// Re-export normalizeUsername for backward compatibility
// (callers can import from '@/services/auth' or '@/lib/username')
export { normalizeUsername };

export const authService = {
  /**
   * Sign up a new user
   * Profile is auto-created by database trigger
   * Returns session info to determine if email confirmation is required
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

    // Check username availability first
    const { data: existing, error: usernameCheckError } =
      await getSupabaseClient()
        .from("profiles_public")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    if (usernameCheckError) {
      throw new Error(
        "Unable to verify username availability. Please try again.",
      );
    }

    if (existing) {
      throw new Error("Username is already taken");
    }

    // Create auth user - profile created by trigger
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) throw error;

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
   */
  async signOut(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current user's full profile (private data)
   * CONTRACT: Only returns self data via RLS
   */
  async getMyProfile(): Promise<Profile> {
    return withAuth(async (userId) => {
      const { data, error } = await getSupabaseClient()
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Profile not found");
      return data;
    });
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
   * Check if a username is available
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
