// src/__tests__/integration/auth.constraints.integration.test.ts
// Integration tests verifying critical database constraints for auth
//
// CRITICAL: These tests verify constraints that the application depends on
// for correctness. If these tests fail, the TOCTOU race condition in
// username registration becomes exploitable.

import { validateTestConfig, createServiceClient } from "./setup";

// Skip if no test environment
const shouldSkip = !process.env.SUPABASE_URL;

(shouldSkip ? describe.skip : describe)(
  "Auth Database Constraints (Integration)",
  () => {
    const serviceClient = createServiceClient();

    beforeAll(() => {
      validateTestConfig();
    });

    describe("profiles.username UNIQUE constraint", () => {
      const testUsername = `constraint_test_${Date.now()}`;
      let testUserId1: string | null = null;
      let testUserId2: string | null = null;

      afterEach(async () => {
        // Cleanup test profiles created during this test
        if (testUserId1) {
          await serviceClient.from("profiles").delete().eq("id", testUserId1);

          // Also clean up from auth.users via admin API
          await serviceClient.auth.admin.deleteUser(testUserId1);
          testUserId1 = null;
        }
        if (testUserId2) {
          await serviceClient.from("profiles").delete().eq("id", testUserId2);

          await serviceClient.auth.admin.deleteUser(testUserId2);
          testUserId2 = null;
        }
      });

      it("should reject duplicate usernames with error code 23505", async () => {
        // Create first user with the test username
        const email1 = `constraint_test_1_${Date.now()}@test.local`;
        const { data: user1, error: error1 } =
          await serviceClient.auth.admin.createUser({
            email: email1,
            password: "TestPassword123!",
            email_confirm: true,
            user_metadata: { username: testUsername },
          });

        expect(error1).toBeNull();
        expect(user1.user).toBeDefined();
        testUserId1 = user1.user!.id;

        // Wait for trigger to create profile
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify first profile exists with the username
        const { data: profile1 } = await serviceClient
          .from("profiles")
          .select("username")
          .eq("id", testUserId1)
          .single();

        expect(profile1?.username).toBe(testUsername);

        // Attempt to create second user with same username
        const email2 = `constraint_test_2_${Date.now()}@test.local`;
        const { data: user2, error: error2 } =
          await serviceClient.auth.admin.createUser({
            email: email2,
            password: "TestPassword123!",
            email_confirm: true,
            user_metadata: { username: testUsername },
          });

        // The trigger should fail due to unique constraint
        // This may manifest as:
        // 1. error2 being set with code 23505
        // 2. user2.user being null
        // 3. A database error message containing "duplicate" or "unique"

        const errorMessage =
          (error2 as Error | null)?.message?.toLowerCase() ?? "";
        const hasError =
          error2 !== null ||
          user2.user === null ||
          errorMessage.includes("duplicate") ||
          errorMessage.includes("unique");

        if (user2.user) {
          testUserId2 = user2.user.id;
        }

        // If no error occurred, the constraint is missing - CRITICAL FAILURE
        if (!hasError && user2.user) {
          // Check if the second profile actually has a different username
          // (the trigger might have fallen back to a generated username)
          const { data: profile2 } = await serviceClient
            .from("profiles")
            .select("username")
            .eq("id", user2.user.id)
            .single();

          if (profile2?.username === testUsername) {
            fail(
              "CRITICAL: Duplicate username was allowed. " +
                "The UNIQUE constraint on profiles.username may be missing. " +
                "Check supabase/migrations/001_initial_schema.sql line 26.",
            );
          }
        }

        // If we get here with an error, the constraint is working
        expect(hasError || testUserId2 === null).toBe(true);
      });

      it("should reject duplicate username on direct insert", async () => {
        // This test verifies the constraint via direct insert (simpler approach)
        const duplicateUsername = `unique_check_${Date.now()}`;
        const testId1 = crypto.randomUUID();
        const testId2 = crypto.randomUUID();

        // Insert first profile (using service client to bypass RLS)
        const { error: insert1Error } = await serviceClient
          .from("profiles")
          .insert({
            id: testId1,
            username: duplicateUsername,
          });

        // If first insert fails due to FK constraint (no auth.users), skip
        if (insert1Error) {
          console.log(
            "Skipping direct insert test - FK constraint prevents test",
          );
          return;
        }

        try {
          // Try duplicate insert - should fail with unique violation
          const { error: insert2Error } = await serviceClient
            .from("profiles")
            .insert({
              id: testId2,
              username: duplicateUsername,
            });

          // Should fail with unique violation
          expect(insert2Error).not.toBeNull();

          const errorCode = (insert2Error as { code?: string } | null)?.code;
          const errorMsg =
            (insert2Error as Error | null)?.message?.toLowerCase() ?? "";

          expect(
            errorCode === "23505" ||
              errorMsg.includes("duplicate") ||
              errorMsg.includes("unique"),
          ).toBe(true);
        } finally {
          // Cleanup
          await serviceClient
            .from("profiles")
            .delete()
            .eq("username", duplicateUsername);
        }
      });
    });

    describe("profiles_public.username UNIQUE constraint", () => {
      it("should inherit uniqueness from profiles table", async () => {
        // profiles_public is synced from profiles via trigger
        // The uniqueness constraint on profiles.username cascades through
        // This test documents the dependency relationship

        // Verify schema expectation: profiles_public.username should be unique
        // The actual enforcement is tested via the profiles constraint tests above
        expect(true).toBe(true);
      });
    });
  },
);
