// src/__tests__/integration/setup.ts
// Integration test setup - Node.js compatible Supabase client

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import type { Database } from "@/types/database";

// Load test environment variables
config({ path: resolve(__dirname, "../../../.env.test") });

// =============================================================================
// CONFIGURATION
// =============================================================================

export const testConfig = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  testUser: {
    email: process.env.TEST_USER_EMAIL || "testuser1@example.com",
    password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
  },
  testUser2: {
    email: process.env.TEST_USER2_EMAIL || "testuser2@example.com",
    password: process.env.TEST_USER2_PASSWORD || "TestPassword123!",
  },
};

// Validate configuration
export function validateTestConfig(): void {
  if (!testConfig.supabaseUrl) {
    throw new Error("SUPABASE_URL is required in .env.test");
  }
  if (!testConfig.supabaseAnonKey) {
    throw new Error("SUPABASE_ANON_KEY is required in .env.test");
  }
  if (!testConfig.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in .env.test");
  }
}

// =============================================================================
// SUPABASE CLIENTS
// =============================================================================

/**
 * Anon client - simulates regular app user
 * RLS policies are enforced
 */
export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    testConfig.supabaseUrl,
    testConfig.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Service role client - bypasses RLS
 * Use for test setup/cleanup only
 */
export function createServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    testConfig.supabaseUrl,
    testConfig.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// =============================================================================
// TEST USER MANAGEMENT
// =============================================================================

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
}

// Cache to prevent race conditions when multiple test files run in parallel
let cachedUser1: TestUser | null = null;
let cachedUser2: TestUser | null = null;
let user1Promise: Promise<TestUser> | null = null;
let user2Promise: Promise<TestUser> | null = null;

/**
 * Sign in as a test user, creating them if they don't exist
 */
async function getTestUser(email: string, password: string): Promise<TestUser> {
  const client = createAnonClient();

  // Try to sign in
  const { data: signInData, error: signInError } =
    await client.auth.signInWithPassword({
      email,
      password,
    });

  if (signInData.user) {
    return {
      id: signInData.user.id,
      email: signInData.user.email!,
      client,
    };
  }

  // If sign in failed, try to create the user
  if (signInError?.message?.includes("Invalid login credentials")) {
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: email.split("@")[0].replace(/[^a-z0-9_]/gi, "_"),
        },
      },
    });

    if (signUpError) {
      // If database error (likely race condition), wait and retry sign in
      if (
        signUpError.message?.includes("Database error") ||
        signUpError.message?.includes("already registered")
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const { data: retrySignIn, error: retryError } =
          await client.auth.signInWithPassword({ email, password });

        if (retrySignIn.user) {
          return {
            id: retrySignIn.user.id,
            email: retrySignIn.user.email!,
            client,
          };
        }
        throw new Error(
          `Failed to create test user: ${signUpError.message}. Retry failed: ${retryError?.message}`
        );
      }
      throw new Error(`Failed to create test user: ${signUpError.message}`);
    }

    if (!signUpData.user) {
      throw new Error("Failed to create test user: no user returned");
    }

    // Sign in with the new user
    const { data: newSignIn, error: newSignInError } =
      await client.auth.signInWithPassword({
        email,
        password,
      });

    if (newSignInError || !newSignIn.user) {
      throw new Error(
        `Failed to sign in after creating user: ${newSignInError?.message}`
      );
    }

    return {
      id: newSignIn.user.id,
      email: newSignIn.user.email!,
      client,
    };
  }

  throw new Error(`Failed to sign in test user: ${signInError?.message}`);
}

/**
 * Get the primary test user (cached to prevent race conditions)
 */
export async function getTestUser1(): Promise<TestUser> {
  if (cachedUser1) return cachedUser1;

  if (!user1Promise) {
    user1Promise = getTestUser(
      testConfig.testUser.email,
      testConfig.testUser.password
    );
  }

  cachedUser1 = await user1Promise;
  return cachedUser1;
}

/**
 * Get the secondary test user (cached to prevent race conditions)
 */
export async function getTestUser2(): Promise<TestUser> {
  if (cachedUser2) return cachedUser2;

  if (!user2Promise) {
    user2Promise = getTestUser(
      testConfig.testUser2.email,
      testConfig.testUser2.password
    );
  }

  cachedUser2 = await user2Promise;
  return cachedUser2;
}

// =============================================================================
// TEST DATA HELPERS
// =============================================================================

/**
 * Create a test challenge owned by the given user
 */
export async function createTestChallenge(
  client: SupabaseClient<Database>,
  overrides: Partial<Database["public"]["Tables"]["challenges"]["Insert"]> = {}
): Promise<Database["public"]["Tables"]["challenges"]["Row"]> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Must be authenticated to create challenge");

  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday (default: active)
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  const { data, error } = await client
    .from("challenges")
    .insert({
      creator_id: user.id,
      title: `Test Challenge ${Date.now()}`,
      challenge_type: "steps",
      goal_value: 10000,
      goal_unit: "steps",
      win_condition: "highest_total",
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: "active", // NOTE: time-derived status is determined by start/end; this value is only used for override states
      ...overrides,
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create test challenge: ${error.message}`);
  return data;
}

/**
 * Add a participant to a challenge (as creator inviting)
 */
export async function inviteToChallenge(
  creatorClient: SupabaseClient<Database>,
  challengeId: string,
  inviteeUserId: string
): Promise<void> {
  const { error } = await creatorClient.from("challenge_participants").insert({
    challenge_id: challengeId,
    user_id: inviteeUserId,
    invite_status: "pending",
  });

  if (error) throw new Error(`Failed to invite to challenge: ${error.message}`);
}

/**
 * Accept a challenge invitation
 */
export async function acceptChallengeInvite(
  client: SupabaseClient<Database>,
  challengeId: string
): Promise<void> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Must be authenticated");

  const { error } = await client
    .from("challenge_participants")
    .update({ invite_status: "accepted" })
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id);

  if (error) throw new Error(`Failed to accept invite: ${error.message}`);
}

// =============================================================================
// CLEANUP HELPERS
// =============================================================================

/**
 * Delete all test data created by a user
 * Uses service client to bypass RLS
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  const serviceClient = createServiceClient();

  // Delete in order to respect foreign keys
  // 1. Activity logs
  await serviceClient.from("activity_logs").delete().eq("user_id", userId);

  // 2. Challenge participants
  await serviceClient
    .from("challenge_participants")
    .delete()
    .eq("user_id", userId);

  // 3. Challenges created by user
  await serviceClient.from("challenges").delete().eq("creator_id", userId);

  // 4. Friends
  await serviceClient
    .from("friends")
    .delete()
    .or(`requested_by.eq.${userId},requested_to.eq.${userId}`);

  // 5. Notifications
  await serviceClient.from("notifications").delete().eq("user_id", userId);

  // Note: We don't delete the profile/user - they can be reused
}

/**
 * Delete a specific challenge and all related data
 */
export async function cleanupChallenge(challengeId: string): Promise<void> {
  const serviceClient = createServiceClient();

  // Delete in order
  await serviceClient
    .from("activity_logs")
    .delete()
    .eq("challenge_id", challengeId);
  await serviceClient
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId);
  await serviceClient.from("challenges").delete().eq("id", challengeId);
}

// =============================================================================
// UUID HELPER
// =============================================================================

/**
 * Generate a UUID for idempotency keys
 */
export function generateTestUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
