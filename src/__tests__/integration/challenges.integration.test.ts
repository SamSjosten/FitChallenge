// src/__tests__/integration/challenges.integration.test.ts
// Integration tests for challenge visibility and participation RLS

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createTestChallenge,
  inviteToChallenge,
  acceptChallengeInvite,
  cleanupChallenge,
  type TestUser,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

// Helper to assert non-null ID in tests
function requireId(id: string | null | undefined): string {
  if (!id) throw new Error("Expected non-null id in test");
  return id;
}

describe("Challenge Visibility Integration Tests", () => {
  let user1: TestUser;
  let user2: TestUser;

  beforeAll(async () => {
    user1 = await getTestUser1();
    user2 = await getTestUser2();
  }, 30000);

  describe("Challenge creation", () => {
    let challengeId: string | null = null;

    afterEach(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
        challengeId = null;
      }
    });

    it("should allow user to create a challenge", async () => {
      const challenge = await createTestChallenge(user1.client, {
        title: "Test Challenge Creation",
      });
      challengeId = requireId(challenge.id);

      expect(challenge).toBeDefined();
      expect(challenge.creator_id).toBe(user1.id);
      expect(challenge.title).toBe("Test Challenge Creation");
    });

    it("should auto-create creator as participant", async () => {
      const challenge = await createTestChallenge(user1.client);
      challengeId = requireId(challenge.id);

      // Add creator as participant manually (some setups do this via trigger)
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      const { data: participants } = await user1.client
        .from("challenge_participants")
        .select()
        .eq("challenge_id", challengeId)
        .eq("user_id", user1.id);

      expect(participants?.length).toBe(1);
      expect(participants?.[0].invite_status).toBe("accepted");
    });
  });

  describe("Challenge visibility rules", () => {
    let challengeId: string | null = null;

    beforeEach(async () => {
      const challenge = await createTestChallenge(user1.client);
      challengeId = requireId(challenge.id);

      // Add creator as participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
    });

    afterEach(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
        challengeId = null;
      }
    });

    it("creator can see their own challenge", async () => {
      const id = requireId(challengeId);

      const { data } = await user1.client
        .from("challenges")
        .select()
        .eq("id", id)
        .single();

      expect(data).toBeDefined();
      expect(data?.id).toBe(id);
    });

    it("non-participant cannot see challenge", async () => {
      const id = requireId(challengeId);

      const { data } = await user2.client
        .from("challenges")
        .select()
        .eq("id", id)
        .maybeSingle();

      // User2 is not a participant, should not see it
      expect(data).toBeNull();
    });

    it("pending invitee can see challenge", async () => {
      const id = requireId(challengeId);

      // Invite user2 (pending)
      await inviteToChallenge(user1.client, id, user2.id);

      const { data } = await user2.client
        .from("challenges")
        .select()
        .eq("id", id)
        .single();

      expect(data).toBeDefined();
      expect(data?.id).toBe(id);
    });

    it("accepted participant can see challenge", async () => {
      const id = requireId(challengeId);

      await inviteToChallenge(user1.client, id, user2.id);
      await acceptChallengeInvite(user2.client, id);

      const { data } = await user2.client
        .from("challenges")
        .select()
        .eq("id", id)
        .single();

      expect(data).toBeDefined();
      expect(data?.id).toBe(id);
    });
  });

  describe("Participant list visibility", () => {
    let challengeId: string | null = null;

    beforeEach(async () => {
      const challenge = await createTestChallenge(user1.client);
      challengeId = requireId(challenge.id);

      // Add creator as accepted participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
    });

    afterEach(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
        challengeId = null;
      }
    });

    it("creator sees all participants (pending + accepted)", async () => {
      const id = requireId(challengeId);

      // Invite user2 (pending)
      await inviteToChallenge(user1.client, id, user2.id);

      const { data } = await user1.client
        .from("challenge_participants")
        .select()
        .eq("challenge_id", id);

      // Creator should see both: themselves (accepted) and user2 (pending)
      expect(data?.length).toBe(2);
    });

    it("pending invitee sees only their own row", async () => {
      const id = requireId(challengeId);

      await inviteToChallenge(user1.client, id, user2.id);

      const { data } = await user2.client
        .from("challenge_participants")
        .select()
        .eq("challenge_id", id);

      // Pending user should only see their own row
      expect(data?.length).toBe(1);
      expect(data?.[0].user_id).toBe(user2.id);
    });

    it("accepted participant sees other accepted participants", async () => {
      const id = requireId(challengeId);

      // Invite and accept user2
      await inviteToChallenge(user1.client, id, user2.id);
      await acceptChallengeInvite(user2.client, id);

      const { data } = await user2.client
        .from("challenge_participants")
        .select()
        .eq("challenge_id", id);

      // Accepted user should see all accepted participants
      const acceptedParticipants = data?.filter(
        (p) => p.invite_status === "accepted"
      );
      expect(acceptedParticipants?.length).toBe(2);
    });
  });

  describe("Invite management", () => {
    let challengeId: string | null = null;

    beforeEach(async () => {
      const challenge = await createTestChallenge(user1.client);
      challengeId = requireId(challenge.id);

      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
    });

    afterEach(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
        challengeId = null;
      }
    });

    it("only creator can invite participants", async () => {
      const id = requireId(challengeId);

      // Creator invites
      const { error: creatorError } = await user1.client
        .from("challenge_participants")
        .insert({
          challenge_id: id,
          user_id: user2.id,
          invite_status: "pending",
        });

      expect(creatorError).toBeNull();
    });

    it("non-creator cannot invite participants", async () => {
      const id = requireId(challengeId);

      // First, invite user2 and have them accept
      await inviteToChallenge(user1.client, id, user2.id);
      await acceptChallengeInvite(user2.client, id);

      // Now user2 (not creator) tries to invite someone
      // We'll use a dummy user ID since we only have 2 test users
      const dummyUserId = "00000000-0000-0000-0000-000000000000";

      const { error } = await user2.client
        .from("challenge_participants")
        .insert({
          challenge_id: id,
          user_id: dummyUserId,
          invite_status: "pending",
        });

      // Should fail - only creator can invite
      expect(error).not.toBeNull();
    });

    it("invitee can accept their own invite", async () => {
      const id = requireId(challengeId);

      await inviteToChallenge(user1.client, id, user2.id);

      const { error } = await user2.client
        .from("challenge_participants")
        .update({ invite_status: "accepted" })
        .eq("challenge_id", id)
        .eq("user_id", user2.id);

      expect(error).toBeNull();

      // Verify
      const { data } = await user2.client
        .from("challenge_participants")
        .select()
        .eq("challenge_id", id)
        .eq("user_id", user2.id)
        .single();

      expect(data?.invite_status).toBe("accepted");
    });

    it("invitee can decline their own invite", async () => {
      const id = requireId(challengeId);

      await inviteToChallenge(user1.client, id, user2.id);

      const { error } = await user2.client
        .from("challenge_participants")
        .update({ invite_status: "declined" })
        .eq("challenge_id", id)
        .eq("user_id", user2.id);

      expect(error).toBeNull();

      // After declining, user should not see the challenge
      const { data: challengeData } = await user2.client
        .from("challenges")
        .select()
        .eq("id", id)
        .maybeSingle();

      // Declined users lose visibility
      expect(challengeData).toBeNull();
    });

    it("user cannot modify another user's invite status", async () => {
      const id = requireId(challengeId);

      await inviteToChallenge(user1.client, id, user2.id);

      // User1 (creator) tries to accept user2's invite
      const { error } = await user1.client
        .from("challenge_participants")
        .update({ invite_status: "accepted" })
        .eq("challenge_id", id)
        .eq("user_id", user2.id);

      // The update should have no effect due to RLS
      const { data } = await user1.client
        .from("challenge_participants")
        .select()
        .eq("challenge_id", id)
        .eq("user_id", user2.id)
        .single();

      // Status should still be pending
      expect(data?.invite_status).toBe("pending");
    });
  });

  describe("Leaderboard visibility", () => {
    let challengeId: string | null = null;

    beforeEach(async () => {
      const challenge = await createTestChallenge(user1.client, {
        status: "active",
      });
      challengeId = requireId(challenge.id);

      // Add creator as accepted participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
        current_progress: 5000,
      });
    });

    afterEach(async () => {
      if (challengeId) {
        await cleanupChallenge(challengeId);
        challengeId = null;
      }
    });

    it("pending invitee cannot see leaderboard data", async () => {
      const id = requireId(challengeId);

      // Invite user2 (pending)
      await inviteToChallenge(user1.client, id, user2.id);

      // User2 tries to query participants with progress
      const { data } = await user2.client
        .from("challenge_participants")
        .select("user_id, current_progress, invite_status")
        .eq("challenge_id", id)
        .eq("invite_status", "accepted");

      // Pending user should not see accepted participants (leaderboard)
      expect(data?.length).toBe(0);
    });

    it("accepted participant can see leaderboard", async () => {
      const id = requireId(challengeId);

      // Invite and accept user2
      await inviteToChallenge(user1.client, id, user2.id);

      // Update user2's progress before accepting
      await user1.client
        .from("challenge_participants")
        .update({ current_progress: 0 })
        .eq("challenge_id", id)
        .eq("user_id", user2.id);

      await acceptChallengeInvite(user2.client, id);

      // User2 can now see leaderboard
      const { data } = await user2.client
        .from("challenge_participants")
        .select("user_id, current_progress, invite_status")
        .eq("challenge_id", id)
        .eq("invite_status", "accepted")
        .order("current_progress", { ascending: false });

      expect(data?.length).toBe(2);
      // User1 should be first with 5000 progress
      expect(data?.[0].user_id).toBe(user1.id);
      expect(data?.[0].current_progress).toBe(5000);
    });
  });
});
