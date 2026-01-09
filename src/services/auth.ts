// src/services/auth.ts
// Authentication and profile management service

import { supabase, requireUserId, withAuth } from "@/lib/supabase";
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
   */
  async signUp(input: unknown): Promise<void> {
    // Validation applies .toLowerCase() transform to username
    const {
      email,
      password,
      username: validatedUsername,
    } = validate(signUpSchema, input);

    // Explicit normalization for defense-in-depth and clarity
    const username = normalizeUsername(validatedUsername);

    // Check username availability first
    const { data: existing } = await supabase
      .from("profiles_public")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      throw new Error("Username is already taken");
    }

    // Create auth user - profile created by trigger
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) throw error;
  },

  /**
   * Sign in an existing user
   */
  async signIn(input: unknown): Promise<void> {
    const { email, password } = validate(signInSchema, input);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current user's full profile (private data)
   * CONTRACT: Only returns self data via RLS
   */
  async getMyProfile(): Promise<Profile> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
    const { data } = await supabase
      .from("profiles_public")
      .select("id")
      .eq("username", normalized)
      .maybeSingle();

    return data === null;
  },

  /**
   * Get a user's public profile by ID
   * CONTRACT: Uses profiles_public, not profiles
   */
  async getPublicProfile(userId: string): Promise<ProfilePublic | null> {
    const { data, error } = await supabase
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

    const { data, error } = await supabase
      .from("profiles_public")
      .select("*")
      .ilike("username", `%${query}%`)
      .limit(20);

    if (error) throw error;
    return data || [];
  },
};
