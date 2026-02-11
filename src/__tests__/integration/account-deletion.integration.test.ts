// src/__tests__/integration/account-deletion.integration.test.ts
// Integration tests for account deletion — GDPR Article 17 compliance
//
// CONTRACT: Deleting a user removes all personal data via FK cascade
// CONTRACT: profiles, profiles_public, activity_logs, notifications,
//           push_tokens, friends, consent_records, challenge_participants
//           are all deleted when the user's auth record is removed
// CONTRACT: challenges.creator_id is SET NULL (challenge preserved for others)
// CONTRACT: audit_log.user_id is SET NULL (audit trail preserved)
//
// NOTE: These tests use ephemeral users created/destroyed per test to avoid
// corrupting the shared test users. Each test creates a fresh user, populates
// data, deletes the user, and verifies cascade results.

import {
  validateTestConfig,
  getTestUser1,
  createServiceClient,
  createEphemeralUser,
  generateTestUUID,
  type TestUser,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

describe("Account Deletion Integration Tests", () => {
  let permanentUser: TestUser;

  beforeAll(async () => {
    // A permanent user for cross-user relationship tests
    permanentUser = await getTestUser1();
  }, 30000);

  // Helper: full user deletion via admin API (mirrors production flow)
  async function deleteUserViaAdmin(userId: string): Promise<void> {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed to delete user via admin: ${error.message}`);
    }
  }

  // =========================================================================
  // CORE CASCADE BEHAVIOR
  // =========================================================================

  describe("profile cascade", () => {
    it("should delete user's profile after auth deletion", async () => {
      const user = await createEphemeralUser("del_profile");

      await deleteUserViaAdmin(user.id);

      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      expect(data).toBeNull();
    });

    it("should delete user's profiles_public after auth deletion", async () => {
      const user = await createEphemeralUser("del_pubprof");

      // Verify profiles_public exists before deletion
      const serviceClient = createServiceClient();
      const { data: before } = await serviceClient
        .from("profiles_public")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      expect(before).not.toBeNull();

      await deleteUserViaAdmin(user.id);

      const { data: after } = await serviceClient
        .from("profiles_public")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      expect(after).toBeNull();
    });
  });

  describe("activity_logs cascade", () => {
    it("should delete user's activity_logs after auth deletion", async () => {
      const user = await createEphemeralUser("del_activity");
      const serviceClient = createServiceClient();

      // Create a challenge and participant row for the ephemeral user
      const { data: challenge } = await serviceClient
        .from("challenges")
        .insert({
          creator_id: user.id,
          title: `Deletion Test ${Date.now()}`,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          start_date: new Date(Date.now() - 86400000).toISOString(),
          end_date: new Date(Date.now() + 86400000 * 7).toISOString(),
          status: "active",
        })
        .select("id")
        .single();

      await serviceClient.from("challenge_participants").insert({
        challenge_id: challenge!.id,
        user_id: user.id,
        invite_status: "accepted",
      });

      // Insert activity log via service client (bypasses RLS/RPC for test setup)
      await serviceClient.from("activity_logs").insert({
        user_id: user.id,
        challenge_id: challenge!.id,
        activity_type: "steps",
        value: 5000,
        unit: "steps",
        source: "manual",
        recorded_at: new Date().toISOString(),
        client_event_id: generateTestUUID(),
      });

      // Verify activity exists
      const { data: before } = await serviceClient
        .from("activity_logs")
        .select("id")
        .eq("user_id", user.id);

      expect(before?.length).toBeGreaterThan(0);

      await deleteUserViaAdmin(user.id);

      // Activity logs should be cascaded
      const { data: after } = await serviceClient
        .from("activity_logs")
        .select("id")
        .eq("user_id", user.id);

      expect(after?.length ?? 0).toBe(0);

      // Clean up the challenge (creator_id is now null due to SET NULL)
      await serviceClient.from("challenges").delete().eq("id", challenge!.id);
    });
  });

  describe("notifications cascade", () => {
    it("should delete user's notifications after auth deletion", async () => {
      const user = await createEphemeralUser("del_notif");
      const serviceClient = createServiceClient();

      // Create notification via service client
      await serviceClient.from("notifications").insert({
        user_id: user.id,
        type: "challenge_invite_received",
        title: "Test",
        body: "Test notification for deletion",
        data: {},
      });

      const { data: before } = await serviceClient
        .from("notifications")
        .select("id")
        .eq("user_id", user.id);

      expect(before?.length).toBeGreaterThan(0);

      await deleteUserViaAdmin(user.id);

      const { data: after } = await serviceClient
        .from("notifications")
        .select("id")
        .eq("user_id", user.id);

      expect(after?.length ?? 0).toBe(0);
    });
  });

  describe("push_tokens cascade", () => {
    it("should delete user's push_tokens after auth deletion", async () => {
      const user = await createEphemeralUser("del_token");
      const serviceClient = createServiceClient();

      await serviceClient.from("push_tokens").insert({
        user_id: user.id,
        token: `ExponentPushToken[del_test_${generateTestUUID().slice(0, 8)}]`,
        platform: "ios",
      });

      const { data: before } = await serviceClient
        .from("push_tokens")
        .select("id")
        .eq("user_id", user.id);

      expect(before?.length).toBeGreaterThan(0);

      await deleteUserViaAdmin(user.id);

      const { data: after } = await serviceClient
        .from("push_tokens")
        .select("id")
        .eq("user_id", user.id);

      expect(after?.length ?? 0).toBe(0);
    });
  });

  describe("friends cascade", () => {
    it("should delete user's friends rows after auth deletion", async () => {
      const user = await createEphemeralUser("del_friend");
      const serviceClient = createServiceClient();

      // Create friendship between ephemeral user and permanent user
      await serviceClient.from("friends").insert({
        requested_by: user.id,
        requested_to: permanentUser.id,
        status: "accepted",
      });

      const { data: before } = await serviceClient
        .from("friends")
        .select("id")
        .or(`requested_by.eq.${user.id},requested_to.eq.${user.id}`);

      expect(before?.length).toBeGreaterThan(0);

      await deleteUserViaAdmin(user.id);

      const { data: after } = await serviceClient
        .from("friends")
        .select("id")
        .or(`requested_by.eq.${user.id},requested_to.eq.${user.id}`);

      expect(after?.length ?? 0).toBe(0);
    });
  });

  describe("challenge_participants cascade", () => {
    it("should delete user's challenge_participants rows after auth deletion", async () => {
      const user = await createEphemeralUser("del_cp");
      const serviceClient = createServiceClient();

      // Create challenge owned by permanent user, invite ephemeral user
      const { data: challenge } = await serviceClient
        .from("challenges")
        .insert({
          creator_id: permanentUser.id,
          title: `CP Deletion Test ${Date.now()}`,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          start_date: new Date(Date.now() - 86400000).toISOString(),
          end_date: new Date(Date.now() + 86400000 * 7).toISOString(),
          status: "active",
        })
        .select("id")
        .single();

      await serviceClient.from("challenge_participants").insert({
        challenge_id: challenge!.id,
        user_id: user.id,
        invite_status: "accepted",
      });

      await deleteUserViaAdmin(user.id);

      // Participant row should be gone
      const { data: after } = await serviceClient
        .from("challenge_participants")
        .select("id")
        .eq("challenge_id", challenge!.id)
        .eq("user_id", user.id);

      expect(after?.length ?? 0).toBe(0);

      // Clean up challenge
      await serviceClient.from("challenge_participants").delete().eq("challenge_id", challenge!.id);
      await serviceClient.from("challenges").delete().eq("id", challenge!.id);
    });
  });

  // =========================================================================
  // CHALLENGE PRESERVATION (SET NULL on creator_id)
  // =========================================================================

  describe("challenge preservation for other participants", () => {
    it("should SET NULL on creator_id when creator is deleted", async () => {
      const creator = await createEphemeralUser("del_creator");
      const serviceClient = createServiceClient();

      // Creator makes a challenge
      const { data: challenge } = await serviceClient
        .from("challenges")
        .insert({
          creator_id: creator.id,
          title: `Orphan Test ${Date.now()}`,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          start_date: new Date(Date.now() - 86400000).toISOString(),
          end_date: new Date(Date.now() + 86400000 * 7).toISOString(),
          status: "active",
        })
        .select("id")
        .single();

      const challengeId = challenge!.id;

      // Add permanent user as participant
      await serviceClient.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: permanentUser.id,
        invite_status: "accepted",
      });

      // Delete the creator
      await deleteUserViaAdmin(creator.id);

      // Challenge should still exist with creator_id = null
      const { data: preserved } = await serviceClient
        .from("challenges")
        .select("id, creator_id, status")
        .eq("id", challengeId)
        .single();

      expect(preserved).not.toBeNull();
      expect(preserved?.creator_id).toBeNull();

      // Permanent user's participation should remain
      const { data: participant } = await serviceClient
        .from("challenge_participants")
        .select("id, invite_status")
        .eq("challenge_id", challengeId)
        .eq("user_id", permanentUser.id)
        .single();

      expect(participant).not.toBeNull();
      expect(participant?.invite_status).toBe("accepted");

      // Clean up
      await serviceClient.from("challenge_participants").delete().eq("challenge_id", challengeId);
      await serviceClient.from("challenges").delete().eq("id", challengeId);
    });

    it("should still allow remaining participants to see the challenge", async () => {
      const creator = await createEphemeralUser("del_vis");
      const serviceClient = createServiceClient();

      const { data: challenge } = await serviceClient
        .from("challenges")
        .insert({
          creator_id: creator.id,
          title: `Visibility After Deletion ${Date.now()}`,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          start_date: new Date(Date.now() - 86400000).toISOString(),
          end_date: new Date(Date.now() + 86400000 * 7).toISOString(),
          status: "active",
        })
        .select("id")
        .single();

      const challengeId = challenge!.id;

      // Add permanent user as accepted participant
      await serviceClient.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: permanentUser.id,
        invite_status: "accepted",
      });

      // Delete creator
      await deleteUserViaAdmin(creator.id);

      // Permanent user should still be able to see the challenge via RLS
      const { data: visible, error } = await permanentUser.client
        .from("challenges")
        .select("id, title")
        .eq("id", challengeId)
        .single();

      expect(error).toBeNull();
      expect(visible).not.toBeNull();
      expect(visible?.id).toBe(challengeId);

      // Clean up
      await serviceClient.from("challenge_participants").delete().eq("challenge_id", challengeId);
      await serviceClient.from("challenges").delete().eq("id", challengeId);
    });
  });

  // =========================================================================
  // AUDIT LOG PRESERVATION (SET NULL on user_id)
  // =========================================================================

  describe("audit log preservation", () => {
    it("should SET NULL on user_id in audit_log when user is deleted", async () => {
      const user = await createEphemeralUser("del_audit");
      const serviceClient = createServiceClient();

      // Create an audit entry
      const { data: audit } = await serviceClient
        .from("audit_log")
        .insert({
          user_id: user.id,
          action: "test_action",
          details: { reason: "deletion test" },
        })
        .select("id")
        .single();

      await deleteUserViaAdmin(user.id);

      // Audit entry should remain with user_id = null
      const { data: preserved } = await serviceClient
        .from("audit_log")
        .select("id, user_id, action")
        .eq("id", audit!.id)
        .single();

      expect(preserved).not.toBeNull();
      expect(preserved?.user_id).toBeNull();
      expect(preserved?.action).toBe("test_action");

      // Clean up
      await serviceClient.from("audit_log").delete().eq("id", audit!.id);
    });
  });
});
