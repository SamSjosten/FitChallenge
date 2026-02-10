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

    it("should atomically create creator as participant via RPC", async () => {
      // Use the create_challenge_with_participant RPC directly
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

      const { data: challenge, error } = await user1.client.rpc(
        "create_challenge_with_participant",
        {
          // Required parameters
          p_title: "Atomic Creation Test",
          p_challenge_type: "steps",
          p_goal_value: 10000,
          p_goal_unit: "steps",
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
          // Optional parameters
          p_description: "Testing atomic challenge creation",
          p_custom_activity_name: null,
          p_win_condition: "highest_total",
          p_daily_target: null,
        },
      );

      if (error) throw error;
      expect(challenge).toBeDefined();
      challengeId = requireId(challenge.id);

      // Verify the challenge was created
      expect(challenge.creator_id).toBe(user1.id);
      expect(challenge.title).toBe("Atomic Creation Test");

      // Verify the creator was automatically added as an accepted participant
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

      const { data } = await user1.client.from("challenges").select().eq("id", id).single();

      expect(data).toBeDefined();
      expect(data?.id).toBe(id);
    });

    it("non-participant cannot see challenge", async () => {
      const id = requireId(challengeId);

      const { data } = await user2.client.from("challenges").select().eq("id", id).maybeSingle();

      // User2 is not a participant, should not see it
      expect(data).toBeNull();
    });

    it("pending invitee can see challenge", async () => {
      const id = requireId(challengeId);

      // Invite user2 (pending)
      await inviteToChallenge(user1.client, id, user2.id);

      const { data } = await user2.client.from("challenges").select().eq("id", id).single();

      expect(data).toBeDefined();
      expect(data?.id).toBe(id);
    });

    it("accepted participant can see challenge", async () => {
      const id = requireId(challengeId);

      await inviteToChallenge(user1.client, id, user2.id);
      await acceptChallengeInvite(user2.client, id);

      const { data } = await user2.client.from("challenges").select().eq("id", id).single();

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
      const acceptedParticipants = data?.filter((p) => p.invite_status === "accepted");
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
      const { error: creatorError } = await user1.client.from("challenge_participants").insert({
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

      const { error } = await user2.client.from("challenge_participants").insert({
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

  describe("Active challenge time filtering", () => {
    let upcomingChallengeId: string | null = null;
    let activeChallengeId: string | null = null;
    let endedChallengeId: string | null = null;

    beforeAll(async () => {
      const now = new Date();

      // Create upcoming challenge (starts tomorrow)
      const upcomingChallenge = await createTestChallenge(user1.client, {
        title: "Upcoming Challenge",
        start_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      upcomingChallengeId = requireId(upcomingChallenge.id);

      // Create active challenge (started 1 hour ago, ends in 7 days)
      const activeChallenge = await createTestChallenge(user1.client, {
        title: "Active Challenge",
        start_date: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      activeChallengeId = requireId(activeChallenge.id);

      // Create ended challenge (ended 1 hour ago)
      const endedChallenge = await createTestChallenge(user1.client, {
        title: "Ended Challenge",
        start_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      });
      endedChallengeId = requireId(endedChallenge.id);

      // Add user1 as accepted participant in all challenges
      for (const challengeId of [upcomingChallengeId, activeChallengeId, endedChallengeId]) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }
    }, 30000);

    afterAll(async () => {
      // Cleanup all challenges
      for (const challengeId of [upcomingChallengeId, activeChallengeId, endedChallengeId]) {
        if (challengeId) {
          await cleanupChallenge(challengeId);
        }
      }
    });

    it("excludes upcoming challenges from active query", async () => {
      const now = new Date().toISOString();

      // Query using same logic as getMyActiveChallenges
      const { data } = await user1.client
        .from("challenges")
        .select(`*, challenge_participants!inner (invite_status)`)
        .eq("challenge_participants.user_id", user1.id)
        .eq("challenge_participants.invite_status", "accepted")
        .lte("start_date", now)
        .gt("end_date", now)
        .not("status", "in", '("cancelled","archived")');

      const challengeIds = data?.map((c) => c.id) || [];

      // Upcoming challenge should NOT be included
      expect(challengeIds).not.toContain(upcomingChallengeId);
    });

    it("includes currently active challenges", async () => {
      const now = new Date().toISOString();

      const { data } = await user1.client
        .from("challenges")
        .select(`*, challenge_participants!inner (invite_status)`)
        .eq("challenge_participants.user_id", user1.id)
        .eq("challenge_participants.invite_status", "accepted")
        .lte("start_date", now)
        .gt("end_date", now)
        .not("status", "in", '("cancelled","archived")');

      const challengeIds = data?.map((c) => c.id) || [];

      // Active challenge SHOULD be included
      expect(challengeIds).toContain(activeChallengeId);
    });

    it("excludes ended challenges from active query", async () => {
      const now = new Date().toISOString();

      const { data } = await user1.client
        .from("challenges")
        .select(`*, challenge_participants!inner (invite_status)`)
        .eq("challenge_participants.user_id", user1.id)
        .eq("challenge_participants.invite_status", "accepted")
        .lte("start_date", now)
        .gt("end_date", now)
        .not("status", "in", '("cancelled","archived")');

      const challengeIds = data?.map((c) => c.id) || [];

      // Ended challenge should NOT be included
      expect(challengeIds).not.toContain(endedChallengeId);
    });

    it("respects half-open interval [start_date, end_date)", async () => {
      // Verify boundary conditions using a fixed timestamp to avoid drift:
      // - start_date == now  -> included  (start_date <= now)
      // - end_date == now    -> excluded  (end_date > now, not >=)

      const fixedNow = new Date().toISOString();

      const startsNow = await createTestChallenge(user1.client, {
        title: "Starts Now Boundary",
        start_date: fixedNow,
        end_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1 hour
      });
      const startsNowId = requireId(startsNow.id);

      const endsNow = await createTestChallenge(user1.client, {
        title: "Ends Now Boundary",
        start_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // -1 hour
        end_date: fixedNow,
      });
      const endsNowId = requireId(endsNow.id);

      // Add user1 as accepted participant in both boundary challenges
      for (const challengeId of [startsNowId, endsNowId]) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }

      const { data, error } = await user1.client
        .from("challenges")
        .select(`id, challenge_participants!inner (invite_status)`)
        .eq("challenge_participants.user_id", user1.id)
        .eq("challenge_participants.invite_status", "accepted")
        .lte("start_date", fixedNow) // inclusive
        .gt("end_date", fixedNow) // exclusive
        .not("status", "in", '("cancelled","archived")');

      if (error) throw error;

      const challengeIds = data?.map((c) => c.id) || [];

      // Boundary expectations
      expect(challengeIds).toContain(startsNowId);
      expect(challengeIds).not.toContain(endsNowId);

      // Also ensure our existing fixtures still behave
      expect(challengeIds).toContain(activeChallengeId);
      expect(challengeIds).not.toContain(upcomingChallengeId);
      expect(challengeIds).not.toContain(endedChallengeId);

      // Cleanup the boundary challenges created in this test
      await cleanupChallenge(startsNowId);
      await cleanupChallenge(endsNowId);
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

    it("produces deterministic ordering when progress is tied (P1-2)", async () => {
      const id = requireId(challengeId);

      // Set both users to the same progress (user1 is creator, can update)
      await user1.client
        .from("challenge_participants")
        .update({ current_progress: 1000 })
        .eq("challenge_id", id)
        .eq("user_id", user1.id);

      await user1.client
        .from("challenge_participants")
        .update({ current_progress: 1000 })
        .eq("challenge_id", id)
        .eq("user_id", user2.id);

      // Query multiple times with tie-breaker to verify stable ordering
      const results: string[][] = [];

      for (let i = 0; i < 5; i++) {
        const { data } = await user1.client
          .from("challenge_participants")
          .select("user_id, current_progress")
          .eq("challenge_id", id)
          .eq("invite_status", "accepted")
          .order("current_progress", { ascending: false })
          .order("user_id", { ascending: true }); // Tie-breaker

        results.push((data || []).map((d) => d.user_id));
      }

      // All results should be identical (deterministic) - this is what we care about
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
      expect(results[2]).toEqual(results[3]);
      expect(results[3]).toEqual(results[4]);

      // Verify ordering matches user_id ASC (smaller UUID first)
      const [firstUserId, secondUserId] = results[0];
      expect(firstUserId.localeCompare(secondUserId)).toBeLessThan(0);
    });
  });
});
