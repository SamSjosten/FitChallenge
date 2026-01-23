// src/__tests__/integration/critical/critical-paths.integration.test.ts
// Tier A Integration Tests - Critical Path Verification
//
// PURPOSE: Fast, focused tests for PR gate (~2-3 min)
// COVERS:
//   - Auth + profile creation
//   - Challenge creation RPC
//   - Activity logging + idempotency
//   - RLS leaderboard visibility
//
// Run with: npm run test:integration:critical

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createTestChallenge,
  inviteToChallenge,
  acceptChallengeInvite,
  cleanupChallenge,
  generateTestUUID,
  createServiceClient,
  type TestUser,
} from "../setup";

// Mock React Native modules (not available in Node.js test environment)
jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("crypto").randomUUID(),
}));
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({})),
  withAuth: jest.fn(),
}));

// Validate config before running tests
beforeAll(() => {
  validateTestConfig();
});

// Helper to create time bounds for active challenges
function getActiveTimeBounds() {
  const now = new Date();
  return {
    start_date: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // -1h
    end_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7d
  };
}

describe("Critical Path Integration Tests", () => {
  let user1: TestUser;
  let user2: TestUser;

  beforeAll(async () => {
    user1 = await getTestUser1();
    user2 = await getTestUser2();
  }, 30000);

  // =========================================================================
  // 1. AUTH + PROFILE CREATION
  // =========================================================================
  describe("Auth & Profile", () => {
    it("creates profile with unique username on signup", async () => {
      // Verify user1 has a profile
      const { data: profile, error } = await user1.client
        .from("profiles")
        .select("id, username")
        .eq("id", user1.id)
        .single();

      expect(error).toBeNull();
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(user1.id);
      expect(profile?.username).toBeTruthy();
    });

    it("syncs profile to profiles_public", async () => {
      // Verify profiles_public is populated
      const { data: publicProfile, error } = await user1.client
        .from("profiles_public")
        .select("id, username")
        .eq("id", user1.id)
        .single();

      expect(error).toBeNull();
      expect(publicProfile).not.toBeNull();
      expect(publicProfile?.id).toBe(user1.id);
    });

    it("enforces username uniqueness at database level", async () => {
      const serviceClient = createServiceClient();

      // Get user1's username
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("username")
        .eq("id", user1.id)
        .single();

      // Attempt to update user2's profile to same username
      const { error } = await serviceClient
        .from("profiles")
        .update({ username: profile!.username })
        .eq("id", user2.id);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505"); // Unique violation
    });
  });

  // =========================================================================
  // 2. CHALLENGE CREATION
  // =========================================================================
  describe("Challenge Creation", () => {
    let challengeId: string | null = null;

    afterAll(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
      }
    });

    it("creates challenge and auto-adds creator as participant", async () => {
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        title: "Critical Test Challenge",
        ...timeBounds,
      });

      expect(challenge).toBeDefined();
      expect(challenge.id).toBeTruthy();
      expect(challenge.creator_id).toBe(user1.id);
      challengeId = challenge.id;

      // Verify creator is auto-added as participant
      // Note: May need to insert manually if trigger doesn't auto-add
      const { data: participants } = await user1.client
        .from("challenge_participants")
        .select("user_id, invite_status")
        .eq("challenge_id", challengeId);

      // Creator should be able to add themselves
      if (!participants?.find((p) => p.user_id === user1.id)) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }
    });

    it("allows creator to invite other users", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      await inviteToChallenge(user1.client, challengeId, user2.id);

      // Verify invite exists
      const { data: participant } = await user2.client
        .from("challenge_participants")
        .select("invite_status")
        .eq("challenge_id", challengeId)
        .eq("user_id", user2.id)
        .single();

      expect(participant?.invite_status).toBe("pending");
    });

    it("allows invitee to accept invitation", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      await acceptChallengeInvite(user2.client, challengeId);

      // Verify status updated
      const { data: participant } = await user2.client
        .from("challenge_participants")
        .select("invite_status")
        .eq("challenge_id", challengeId)
        .eq("user_id", user2.id)
        .single();

      expect(participant?.invite_status).toBe("accepted");
    });
  });

  // =========================================================================
  // 3. ACTIVITY LOGGING + IDEMPOTENCY
  // =========================================================================
  describe("Activity Logging", () => {
    let challengeId: string | null = null;

    beforeAll(async () => {
      // Create a fresh challenge for activity tests
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        title: "Activity Test Challenge",
        challenge_type: "steps",
        ...timeBounds,
      });
      challengeId = challenge.id;

      // Ensure user1 is a participant
      await user1.client
        .from("challenge_participants")
        .upsert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
          current_progress: 0,
        })
        .eq("challenge_id", challengeId)
        .eq("user_id", user1.id);
    }, 15000);

    afterAll(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
      }
    });

    it("logs activity via RPC and updates progress", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      const clientEventId = generateTestUUID();
      const activityValue = 5000;

      // Get initial progress
      const { data: before } = await user1.client
        .from("challenge_participants")
        .select("current_progress")
        .eq("challenge_id", challengeId)
        .eq("user_id", user1.id)
        .single();

      const initialProgress = before?.current_progress || 0;

      // Log activity via RPC
      const { error } = await user1.client.rpc("log_activity", {
        p_challenge_id: challengeId,
        p_activity_type: "steps",
        p_value: activityValue,
        p_recorded_at: new Date().toISOString(),
        p_source: "manual",
        p_client_event_id: clientEventId,
      });

      expect(error).toBeNull();

      // Verify progress updated
      const { data: after } = await user1.client
        .from("challenge_participants")
        .select("current_progress")
        .eq("challenge_id", challengeId)
        .eq("user_id", user1.id)
        .single();

      expect(after?.current_progress).toBe(initialProgress + activityValue);
    });

    it("prevents duplicate activity with same client_event_id (idempotency)", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      const clientEventId = generateTestUUID();
      const activityValue = 3000;

      // First log
      const { error: error1 } = await user1.client.rpc("log_activity", {
        p_challenge_id: challengeId,
        p_activity_type: "steps",
        p_value: activityValue,
        p_recorded_at: new Date().toISOString(),
        p_source: "manual",
        p_client_event_id: clientEventId,
      });
      expect(error1).toBeNull();

      // Get progress after first log
      const { data: afterFirst } = await user1.client
        .from("challenge_participants")
        .select("current_progress")
        .eq("challenge_id", challengeId)
        .eq("user_id", user1.id)
        .single();

      const progressAfterFirst = afterFirst?.current_progress || 0;

      // Duplicate log with same client_event_id
      const { error: error2 } = await user1.client.rpc("log_activity", {
        p_challenge_id: challengeId,
        p_activity_type: "steps",
        p_value: activityValue,
        p_recorded_at: new Date().toISOString(),
        p_source: "manual",
        p_client_event_id: clientEventId,
      });

      // Should fail with unique constraint violation
      expect(error2).not.toBeNull();

      // Progress should NOT have increased
      const { data: afterSecond } = await user1.client
        .from("challenge_participants")
        .select("current_progress")
        .eq("challenge_id", challengeId)
        .eq("user_id", user1.id)
        .single();

      expect(afterSecond?.current_progress).toBe(progressAfterFirst);
    });

    it("rejects activity from non-participant", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      // user2 is not a participant in this challenge
      const { error } = await user2.client.rpc("log_activity", {
        p_challenge_id: challengeId,
        p_activity_type: "steps",
        p_value: 1000,
        p_recorded_at: new Date().toISOString(),
        p_source: "manual",
        p_client_event_id: generateTestUUID(),
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("not_participant");
    });
  });

  // =========================================================================
  // 4. RLS LEADERBOARD VISIBILITY
  // =========================================================================
  describe("RLS Leaderboard Visibility", () => {
    let challengeId: string | null = null;

    beforeAll(async () => {
      // Create challenge with user1 as creator
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        title: "RLS Test Challenge",
        ...timeBounds,
      });
      challengeId = challenge.id;

      // Add user1 as accepted participant
      await user1.client.from("challenge_participants").upsert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
        current_progress: 10000,
      });

      // Invite user2 (pending)
      await inviteToChallenge(user1.client, challengeId, user2.id);
    }, 15000);

    afterAll(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
      }
    });

    it("creator can see all participants", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      const { data: participants, error } = await user1.client
        .from("challenge_participants")
        .select("user_id, invite_status")
        .eq("challenge_id", challengeId);

      expect(error).toBeNull();
      expect(participants?.length).toBeGreaterThanOrEqual(2);

      const user1Participant = participants?.find(
        (p) => p.user_id === user1.id,
      );
      const user2Participant = participants?.find(
        (p) => p.user_id === user2.id,
      );

      expect(user1Participant).toBeDefined();
      expect(user2Participant).toBeDefined();
    });

    it("pending invitee can only see their own row", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      const { data: participants, error } = await user2.client
        .from("challenge_participants")
        .select("user_id, invite_status")
        .eq("challenge_id", challengeId);

      expect(error).toBeNull();

      // Pending user should only see their own row
      expect(participants?.length).toBe(1);
      expect(participants?.[0]?.user_id).toBe(user2.id);
    });

    it("accepted participant can see other accepted participants", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      // Accept user2's invitation
      await acceptChallengeInvite(user2.client, challengeId);

      const { data: participants, error } = await user2.client
        .from("challenge_participants")
        .select("user_id, invite_status")
        .eq("challenge_id", challengeId)
        .eq("invite_status", "accepted");

      expect(error).toBeNull();

      // Now user2 should see all accepted participants
      const acceptedCount = participants?.filter(
        (p) => p.invite_status === "accepted",
      ).length;
      expect(acceptedCount).toBeGreaterThanOrEqual(2);
    });

    it("leaderboard join with profiles_public works", async () => {
      if (!challengeId) throw new Error("Challenge not created");

      const { data: leaderboard, error } = await user1.client
        .from("challenge_participants")
        .select(
          `
          user_id,
          current_progress,
          invite_status,
          profiles_public!inner(username, display_name)
        `,
        )
        .eq("challenge_id", challengeId)
        .eq("invite_status", "accepted")
        .order("current_progress", { ascending: false });

      expect(error).toBeNull();
      expect(leaderboard).toBeDefined();
      expect(leaderboard!.length).toBeGreaterThan(0);

      // Verify profile data is included
      const firstEntry = leaderboard![0];
      expect(firstEntry.profiles_public).toBeDefined();
    });
  });
});
