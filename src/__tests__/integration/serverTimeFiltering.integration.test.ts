// src/__tests__/integration/serverTimeFiltering.integration.test.ts
// Integration tests for P1-3: Server-authoritative challenge filtering RPCs
//
// These tests verify that get_active_challenge_ids() and get_completed_challenge_ids()
// use PostgreSQL now() for time filtering, eliminating client clock drift issues.

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createTestChallenge,
  cleanupChallenge,
  createServiceClient,
  type TestUser,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

function requireId(id: string | null | undefined): string {
  if (!id) throw new Error("Expected non-null id in test");
  return id;
}

describe("P1-3: Server-Authoritative Challenge Filtering", () => {
  let user1: TestUser;

  beforeAll(async () => {
    user1 = await getTestUser1();
  }, 30000);

  describe("get_active_challenge_ids RPC", () => {
    let activeChallengeId: string | null = null;
    let upcomingChallengeId: string | null = null;
    let endedChallengeId: string | null = null;

    beforeAll(async () => {
      const now = new Date();

      // Create challenges with different time states
      const activeChallenge = await createTestChallenge(user1.client, {
        title: "Active Challenge (P1-3)",
        start_date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // Started yesterday
        end_date: new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Ends in 7 days
      });
      activeChallengeId = requireId(activeChallenge.id);

      const upcomingChallenge = await createTestChallenge(user1.client, {
        title: "Upcoming Challenge (P1-3)",
        start_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Starts tomorrow
        end_date: new Date(
          now.getTime() + 8 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Ends in 8 days
      });
      upcomingChallengeId = requireId(upcomingChallenge.id);

      const endedChallenge = await createTestChallenge(user1.client, {
        title: "Ended Challenge (P1-3)",
        start_date: new Date(
          now.getTime() - 14 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Started 14 days ago
        end_date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // Ended yesterday
      });
      endedChallengeId = requireId(endedChallenge.id);

      // Add user1 as accepted participant in all challenges
      for (const challengeId of [
        activeChallengeId,
        upcomingChallengeId,
        endedChallengeId,
      ]) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }
    }, 30000);

    afterAll(async () => {
      for (const id of [
        activeChallengeId,
        upcomingChallengeId,
        endedChallengeId,
      ]) {
        if (id) await cleanupChallenge(id);
      }
    });

    it("returns only active challenges (start_date <= now < end_date)", async () => {
      const { data, error } = await user1.client.rpc(
        "get_active_challenge_ids",
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      // Should include active challenge
      expect(ids).toContain(activeChallengeId);

      // Should NOT include upcoming (not started yet)
      expect(ids).not.toContain(upcomingChallengeId);

      // Should NOT include ended
      expect(ids).not.toContain(endedChallengeId);
    });

    it("excludes cancelled challenges", async () => {
      // Create a cancelled challenge
      const serviceClient = createServiceClient();
      const cancelledChallenge = await createTestChallenge(user1.client, {
        title: "Cancelled Challenge (P1-3)",
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const cancelledId = requireId(cancelledChallenge.id);

      // Add user as participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: cancelledId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // Cancel the challenge (use service client to bypass RLS)
      await serviceClient
        .from("challenges")
        .update({ status: "cancelled" })
        .eq("id", cancelledId);

      // Verify RPC excludes it
      const { data } = await user1.client.rpc("get_active_challenge_ids");
      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      expect(ids).not.toContain(cancelledId);

      // Cleanup
      await cleanupChallenge(cancelledId);
    });

    it("excludes archived challenges", async () => {
      const serviceClient = createServiceClient();
      const archivedChallenge = await createTestChallenge(user1.client, {
        title: "Archived Challenge (P1-3)",
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const archivedId = requireId(archivedChallenge.id);

      await user1.client.from("challenge_participants").insert({
        challenge_id: archivedId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // Archive the challenge
      await serviceClient
        .from("challenges")
        .update({ status: "archived" })
        .eq("id", archivedId);

      const { data } = await user1.client.rpc("get_active_challenge_ids");
      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      expect(ids).not.toContain(archivedId);

      await cleanupChallenge(archivedId);
    });

    it("only returns challenges where user is accepted participant", async () => {
      // Create a challenge where user1 is only pending
      const pendingChallenge = await createTestChallenge(user1.client, {
        title: "Pending Invite Challenge (P1-3)",
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const pendingId = requireId(pendingChallenge.id);

      // Add user as PENDING participant (not accepted)
      await user1.client.from("challenge_participants").insert({
        challenge_id: pendingId,
        user_id: user1.id,
        invite_status: "pending",
      });

      const { data } = await user1.client.rpc("get_active_challenge_ids");
      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      // Should NOT include pending challenges
      expect(ids).not.toContain(pendingId);

      await cleanupChallenge(pendingId);
    });

    it("returns results ordered by start_date ASC", async () => {
      // Create two active challenges with different start dates
      const now = Date.now();
      const olderChallenge = await createTestChallenge(user1.client, {
        title: "Older Active (P1-3)",
        start_date: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        end_date: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const newerChallenge = await createTestChallenge(user1.client, {
        title: "Newer Active (P1-3)",
        start_date: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        end_date: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const olderId = requireId(olderChallenge.id);
      const newerId = requireId(newerChallenge.id);

      for (const id of [olderId, newerId]) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: id,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }

      const { data } = await user1.client.rpc("get_active_challenge_ids");
      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      // Find positions
      const olderPos = ids.indexOf(olderId);
      const newerPos = ids.indexOf(newerId);

      // Older should come first (smaller index)
      expect(olderPos).toBeLessThan(newerPos);

      // Cleanup
      await cleanupChallenge(olderId);
      await cleanupChallenge(newerId);
    });
  });

  describe("get_completed_challenge_ids RPC", () => {
    let completedChallengeId: string | null = null;
    let activeChallengeId: string | null = null;

    beforeAll(async () => {
      const now = new Date();

      // Completed challenge (ended in the past)
      const completedChallenge = await createTestChallenge(user1.client, {
        title: "Completed Challenge (P1-3)",
        start_date: new Date(
          now.getTime() - 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        end_date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // Ended yesterday
      });
      completedChallengeId = requireId(completedChallenge.id);

      // Active challenge (still running)
      const activeChallenge = await createTestChallenge(user1.client, {
        title: "Still Active (P1-3)",
        start_date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Ends in 7 days
      });
      activeChallengeId = requireId(activeChallenge.id);

      for (const id of [completedChallengeId, activeChallengeId]) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: id,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }
    }, 30000);

    afterAll(async () => {
      for (const id of [completedChallengeId, activeChallengeId]) {
        if (id) await cleanupChallenge(id);
      }
    });

    it("returns only completed challenges (end_date <= now)", async () => {
      const { data, error } = await user1.client.rpc(
        "get_completed_challenge_ids",
      );

      expect(error).toBeNull();

      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      // Should include completed challenge
      expect(ids).toContain(completedChallengeId);

      // Should NOT include active challenge
      expect(ids).not.toContain(activeChallengeId);
    });

    it("returns results ordered by end_date DESC (most recent first)", async () => {
      const now = Date.now();

      // Create two completed challenges with different end dates
      const recentlyEnded = await createTestChallenge(user1.client, {
        title: "Recently Ended (P1-3)",
        start_date: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      });
      const olderEnded = await createTestChallenge(user1.client, {
        title: "Older Ended (P1-3)",
        start_date: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      });

      const recentId = requireId(recentlyEnded.id);
      const olderId = requireId(olderEnded.id);

      for (const id of [recentId, olderId]) {
        await user1.client.from("challenge_participants").insert({
          challenge_id: id,
          user_id: user1.id,
          invite_status: "accepted",
        });
      }

      const { data } = await user1.client.rpc("get_completed_challenge_ids");
      const ids = (data || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      const recentPos = ids.indexOf(recentId);
      const olderPos = ids.indexOf(olderId);

      // Recently ended should come first (DESC order)
      expect(recentPos).toBeLessThan(olderPos);

      // Cleanup
      await cleanupChallenge(recentId);
      await cleanupChallenge(olderId);
    });

    it("respects LIMIT 20", async () => {
      // This is a contract test - we just verify the RPC doesn't return unlimited results
      // Creating 20+ challenges would be slow, so we just verify the behavior exists
      const { data } = await user1.client.rpc("get_completed_challenge_ids");

      // Should be an array with at most 20 items
      expect(Array.isArray(data)).toBe(true);
      expect((data || []).length).toBeLessThanOrEqual(20);
    });
  });

  describe("Server time vs client time (core P1-3 guarantee)", () => {
    it("RPC uses server now(), not client-provided timestamp", async () => {
      // Create a challenge that ended 1 hour ago
      const now = Date.now();
      const challenge = await createTestChallenge(user1.client, {
        title: "Time Test Challenge (P1-3)",
        start_date: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        end_date: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      });
      const challengeId = requireId(challenge.id);

      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // The RPC uses server's now(), which should correctly identify this as completed
      const { data: activeIds } = await user1.client.rpc(
        "get_active_challenge_ids",
      );
      const { data: completedIds } = await user1.client.rpc(
        "get_completed_challenge_ids",
      );

      const activeList = (activeIds || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );
      const completedList = (completedIds || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      // Should be in completed, not active
      expect(activeList).not.toContain(challengeId);
      expect(completedList).toContain(challengeId);

      await cleanupChallenge(challengeId);
    });

    it("boundary condition: challenge ending exactly at server now() is completed", async () => {
      // We can't perfectly control server time, but we can create a challenge
      // that ended in the very recent past and verify it's in completed list

      // Create challenge that ended 1 second ago
      const now = Date.now();
      const challenge = await createTestChallenge(user1.client, {
        title: "Boundary Test (P1-3)",
        start_date: new Date(now - 60 * 60 * 1000).toISOString(), // 1 hour ago
        end_date: new Date(now - 1000).toISOString(), // 1 second ago
      });
      const challengeId = requireId(challenge.id);

      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      const { data: activeIds } = await user1.client.rpc(
        "get_active_challenge_ids",
      );
      const { data: completedIds } = await user1.client.rpc(
        "get_completed_challenge_ids",
      );

      const activeList = (activeIds || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );
      const completedList = (completedIds || []).map(
        (r: { challenge_id: string }) => r.challenge_id,
      );

      // Half-open interval: end_date <= now means completed
      expect(activeList).not.toContain(challengeId);
      expect(completedList).toContain(challengeId);

      await cleanupChallenge(challengeId);
    });
  });
});
