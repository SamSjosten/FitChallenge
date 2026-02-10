// src/__tests__/integration/activities.integration.test.ts
// Integration tests for activity logging and aggregation RPC

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createTestChallenge,
  acceptChallengeInvite,
  inviteToChallenge,
  cleanupChallenge,
  generateTestUUID,
  createServiceClient,
  type TestUser,
} from "./setup";
import type { ActivityLog } from "@/types/database";

// Mock React Native modules and Supabase singleton
// The tests use injected clients from setup.ts, not the app's singleton
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

// Helper to assert non-null ID in tests
function requireId(id: string | null | undefined): string {
  if (!id) throw new Error("Expected non-null id in test");
  return id;
}

// Helper to create time bounds for active challenges
function getActiveTimeBounds() {
  const now = new Date();
  return {
    start_date: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // -1h
    end_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7d
  };
}

describe("Activity Integration Tests", () => {
  let user1: TestUser;
  let user2: TestUser;
  let testChallengeId: string | null = null;

  beforeAll(async () => {
    // Get test users
    user1 = await getTestUser1();
    user2 = await getTestUser2();

    // Create a challenge owned by user1 with proper time bounds for activity logging
    const timeBounds = getActiveTimeBounds();
    const challenge = await createTestChallenge(user1.client, {
      ...timeBounds,
    });
    testChallengeId = requireId(challenge.id);

    // User1 is automatically a participant as creator
    // Add user1 as accepted participant (creator auto-add)
    const { error: participantError } = await user1.client.from("challenge_participants").insert({
      challenge_id: testChallengeId,
      user_id: user1.id,
      invite_status: "accepted",
    });

    // Ignore error if already exists (from trigger)
    if (participantError && participantError.code !== "23505") {
      throw participantError;
    }
  }, 30000); // 30s timeout for setup

  afterAll(async () => {
    // Cleanup test data
    if (testChallengeId) {
      await cleanupChallenge(testChallengeId);
      testChallengeId = null;
    }
  });

  describe("log_activity RPC", () => {
    it("should log activity for accepted participant", async () => {
      const id = requireId(testChallengeId);
      const clientEventId = generateTestUUID();

      const { error } = await user1.client.rpc("log_activity", {
        p_challenge_id: id,
        p_activity_type: "steps",
        p_value: 5000,
        p_source: "manual",
        p_client_event_id: clientEventId,
      });

      expect(error).toBeNull();
    });

    it("should ignore client-provided recorded_at for manual logs (uses server time)", async () => {
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);

      try {
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });

        const clientEventId = generateTestUUID();
        // Malicious / untrusted timestamp (still within challenge bounds)
        // Pick something clearly distinct from "now" to ensure the override is observable.
        const maliciousRecordedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // -30m

        // Capture a tight window around the RPC call to sanity-check "server now".
        const before = Date.now();

        const { error } = await user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 1234,
          p_recorded_at: maliciousRecordedAt,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
        expect(error).toBeNull();

        const { data: logs, error: logsError } = await user1.client
          .from("activity_logs")
          .select("recorded_at, client_event_id")
          .eq("challenge_id", challengeId)
          .eq("client_event_id", clientEventId)
          .limit(1);

        expect(logsError).toBeNull();
        expect(logs?.length).toBe(1);

        const storedRecordedAt = logs?.[0]?.recorded_at as string;
        expect(storedRecordedAt).toBeDefined();

        // Stored recorded_at should NOT equal the malicious timestamp
        expect(storedRecordedAt).not.toBe(maliciousRecordedAt);

        // And it should be close to server "now"
        // (sanity window: within ~2 minutes of the test's execution window)
        const storedMs = new Date(storedRecordedAt).getTime();
        const after = Date.now();
        expect(storedMs).toBeGreaterThanOrEqual(before - 2 * 60 * 1000);
        expect(storedMs).toBeLessThanOrEqual(after + 2 * 60 * 1000);
      } finally {
        await cleanupChallenge(challengeId);
      }
    });

    it("should be idempotent - same client_event_id doesn't duplicate", async () => {
      // Create isolated challenge for this test to ensure exact counts
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);

      try {
        // Add user1 as participant
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });

        const clientEventId = generateTestUUID();

        // First call
        const { error: error1 } = await user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 1000,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
        expect(error1).toBeNull();

        // Second call with same client_event_id should be treated as idempotent success
        const { error: error2 } = await user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 1000,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });

        expect(error2).toBeNull();

        // Verify it did NOT double count
        const { data: summary, error: summaryError } = await user1.client.rpc(
          "get_activity_summary",
          { p_challenge_id: challengeId },
        );
        expect(summaryError).toBeNull();

        const row = Array.isArray(summary) ? summary[0] : summary;
        expect(Number(row?.count ?? 0)).toBe(1);
        expect(Number(row?.total_value ?? 0)).toBe(1000);
      } finally {
        await cleanupChallenge(challengeId);
      }
    });

    it("should reject activity for non-participant", async () => {
      const id = requireId(testChallengeId);

      // User2 is not a participant
      const { error } = await user2.client.rpc("log_activity", {
        p_challenge_id: id,
        p_activity_type: "steps",
        p_value: 1000,
        p_source: "manual",
        p_client_event_id: generateTestUUID(),
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/not_participant/i);
    });

    it("should reject activity for pending participant", async () => {
      // Create a new challenge and invite user2 (but don't accept)
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);

      try {
        await inviteToChallenge(user1.client, challengeId, user2.id);

        // User2 tries to log activity while still pending
        const { error } = await user2.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 1000,
          p_source: "manual",
          p_client_event_id: generateTestUUID(),
        });

        expect(error).not.toBeNull();
        expect(error?.message).toMatch(/not_participant/i);
      } finally {
        await cleanupChallenge(challengeId);
      }
    });

    it("should allow activity after accepting invitation", async () => {
      // Create a new challenge and invite user2
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);

      try {
        await inviteToChallenge(user1.client, challengeId, user2.id);
        await acceptChallengeInvite(user2.client, challengeId);

        // Now user2 should be able to log activity
        const { error } = await user2.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 2000,
          p_source: "manual",
          p_client_event_id: generateTestUUID(),
        });

        expect(error).toBeNull();
      } finally {
        await cleanupChallenge(challengeId);
      }
    });
  });

  describe("get_activity_summary RPC", () => {
    let summaryTestChallengeId: string | null = null;

    beforeAll(async () => {
      // Create a fresh challenge for summary tests with proper time bounds
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      summaryTestChallengeId = requireId(challenge.id);

      // Add user1 as participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: summaryTestChallengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // Add user2 as accepted participant (so they have access, but no logs)
      await inviteToChallenge(user1.client, summaryTestChallengeId, user2.id);
      await acceptChallengeInvite(user2.client, summaryTestChallengeId);

      // Log some activities for user1 only
      await user1.client.rpc("log_activity", {
        p_challenge_id: summaryTestChallengeId,
        p_activity_type: "steps",
        p_value: 1000,
        p_source: "manual",
        p_client_event_id: generateTestUUID(),
      });

      await user1.client.rpc("log_activity", {
        p_challenge_id: summaryTestChallengeId,
        p_activity_type: "steps",
        p_value: 2000,
        p_source: "manual",
        p_client_event_id: generateTestUUID(),
      });

      await user1.client.rpc("log_activity", {
        p_challenge_id: summaryTestChallengeId,
        p_activity_type: "steps",
        p_value: 3000,
        p_source: "manual",
        p_client_event_id: generateTestUUID(),
      });
    }, 30000);

    afterAll(async () => {
      if (summaryTestChallengeId) {
        await cleanupChallenge(summaryTestChallengeId);
        summaryTestChallengeId = null;
      }
    });

    it("should return aggregated activity summary", async () => {
      const id = requireId(summaryTestChallengeId);

      const { data, error } = await user1.client.rpc("get_activity_summary", {
        p_challenge_id: id,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Should be array with one row
      const row = Array.isArray(data) ? data[0] : data;

      expect(row).toBeDefined();
      expect(Number(row?.total_value)).toBe(6000); // 1000 + 2000 + 3000
      expect(Number(row?.count)).toBe(3);
      expect(row?.last_recorded_at).toBeDefined();
    });

    it("should return zero for accepted participant with no activities", async () => {
      const id = requireId(summaryTestChallengeId);

      // User2 is accepted but has no activities in this challenge
      const { data, error } = await user2.client.rpc("get_activity_summary", {
        p_challenge_id: id,
      });

      expect(error).toBeNull();

      const row = Array.isArray(data) ? data[0] : data;

      // Should return zeros
      expect(Number(row?.total_value ?? 0)).toBe(0);
      expect(Number(row?.count ?? 0)).toBe(0);
    });

    it("should only return current user's activities", async () => {
      // Create challenge where both users have activities
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);

      try {
        // Add both users
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });

        await inviteToChallenge(user1.client, challengeId, user2.id);
        await acceptChallengeInvite(user2.client, challengeId);

        // User1 logs 5000 steps
        await user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 5000,
          p_source: "manual",
          p_client_event_id: generateTestUUID(),
        });

        // User2 logs 3000 steps
        await user2.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 3000,
          p_source: "manual",
          p_client_event_id: generateTestUUID(),
        });

        // User1's summary should show only their activities
        const { data: user1Data } = await user1.client.rpc("get_activity_summary", {
          p_challenge_id: challengeId,
        });
        const user1Row = Array.isArray(user1Data) ? user1Data[0] : user1Data;
        expect(Number(user1Row?.total_value)).toBe(5000);

        // User2's summary should show only their activities
        const { data: user2Data } = await user2.client.rpc("get_activity_summary", {
          p_challenge_id: challengeId,
        });
        const user2Row = Array.isArray(user2Data) ? user2Data[0] : user2Data;
        expect(Number(user2Row?.total_value)).toBe(3000);
      } finally {
        await cleanupChallenge(challengeId);
      }
    });
  });

  describe("getRecentActivities pagination", () => {
    let paginationTestChallengeId: string | null = null;
    const createdAtValues: string[] = [];

    beforeAll(async () => {
      // Create a challenge for pagination tests
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      paginationTestChallengeId = requireId(challenge.id);

      // Add user1 as participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: paginationTestChallengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // Log 5 activities with slight delays to ensure distinct created_at values
      for (let i = 0; i < 5; i++) {
        const clientEventId = generateTestUUID();
        await user1.client.rpc("log_activity", {
          p_challenge_id: paginationTestChallengeId,
          p_activity_type: "steps",
          p_value: (i + 1) * 1000,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });

        // Fetch the created_at value
        const { data } = await user1.client
          .from("activity_logs")
          .select("created_at")
          .eq("client_event_id", clientEventId)
          .single();

        if (data?.created_at) {
          createdAtValues.push(data.created_at);
        }

        // Small delay to ensure distinct timestamps
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }, 60000);

    afterAll(async () => {
      if (paginationTestChallengeId) {
        await cleanupChallenge(paginationTestChallengeId);
        paginationTestChallengeId = null;
      }
    });

    it("should return activities with limit", async () => {
      const challengeId = requireId(paginationTestChallengeId);
      const { data, error } = await user1.client
        .from("activity_logs")
        .select("*")
        .eq("user_id", user1.id)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false })
        .limit(3);

      expect(error).toBeNull();
      expect(data?.length).toBe(3);
    });

    it("should return activities before cursor (cursor-based pagination)", async () => {
      const challengeId = requireId(paginationTestChallengeId);
      // Get all activities first
      const { data: allData } = await user1.client
        .from("activity_logs")
        .select("*")
        .eq("user_id", user1.id)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false });

      expect(allData?.length).toBeGreaterThanOrEqual(3);

      // Use the 3rd item's created_at as cursor
      const cursor = allData![2].created_at!;

      // Fetch items before the cursor
      const { data: pagedData, error } = await user1.client
        .from("activity_logs")
        .select("*")
        .eq("user_id", user1.id)
        .eq("challenge_id", challengeId)
        .lt("created_at", cursor)
        .order("created_at", { ascending: false });

      expect(error).toBeNull();
      // Should return items older than the cursor
      expect(pagedData?.length).toBeGreaterThanOrEqual(2);

      // All returned items should have created_at < cursor
      pagedData?.forEach((item) => {
        expect(new Date(item.created_at!).getTime()).toBeLessThan(new Date(cursor).getTime());
      });
    });

    it("should return empty array when cursor is before all activities", async () => {
      const challengeId = requireId(paginationTestChallengeId);
      // Use a very old timestamp as cursor
      const oldCursor = "2020-01-01T00:00:00.000Z";

      const { data, error } = await user1.client
        .from("activity_logs")
        .select("*")
        .eq("user_id", user1.id)
        .eq("challenge_id", challengeId)
        .lt("created_at", oldCursor)
        .order("created_at", { ascending: false });

      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });

    it("should combine limit and cursor correctly", async () => {
      const challengeId = requireId(paginationTestChallengeId);
      // Get all activities
      const { data: allData } = await user1.client
        .from("activity_logs")
        .select("*")
        .eq("user_id", user1.id)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false });

      expect(allData?.length).toBeGreaterThanOrEqual(4);

      // Use second item's created_at as cursor, limit to 2
      const cursor = allData![1].created_at!;

      const { data: pagedData, error } = await user1.client
        .from("activity_logs")
        .select("*")
        .eq("user_id", user1.id)
        .eq("challenge_id", challengeId)
        .lt("created_at", cursor)
        .order("created_at", { ascending: false })
        .limit(2);

      expect(error).toBeNull();
      expect(pagedData?.length).toBeLessThanOrEqual(2);

      // Should be deterministically ordered
      if (pagedData && pagedData.length > 1) {
        expect(new Date(pagedData[0].created_at!).getTime()).toBeGreaterThanOrEqual(
          new Date(pagedData[1].created_at!).getTime(),
        );
      }
    });
  });

  describe("Same-second pagination (cursor precision)", () => {
    // These tests verify that pagination with fractional-second timestamps works correctly.
    // Previously, cursors stripped fractional seconds which caused rows to be skipped
    // when multiple activities shared the same whole second.

    let sameSecondChallengeId: string | null = null;

    beforeAll(async () => {
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      sameSecondChallengeId = requireId(challenge.id);

      await user1.client.from("challenge_participants").insert({
        challenge_id: sameSecondChallengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
    }, 30000);

    afterAll(async () => {
      if (sameSecondChallengeId) {
        await cleanupChallenge(sameSecondChallengeId);
        sameSecondChallengeId = null;
      }
    });

    it("should not skip rows when multiple activities share the same second", async () => {
      const challengeId = requireId(sameSecondChallengeId);
      const activityCount = 5;
      const clientEventIds: string[] = [];

      // Create multiple activities as fast as possible (likely same second)
      // Using Promise.all to maximize chance of same-second timestamps
      const logPromises = Array.from({ length: activityCount }, (_, i) => {
        const clientEventId = generateTestUUID();
        clientEventIds.push(clientEventId);
        return user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: (i + 1) * 100, // 100, 200, 300, 400, 500
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
      });

      const results = await Promise.all(logPromises);
      results.forEach((r, i) => {
        expect(r.error).toBeNull();
      });

      // Fetch all activities for this challenge to get their IDs and timestamps
      const { data: allActivities, error: fetchError } = await user1.client
        .from("activity_logs")
        .select("id, recorded_at, value, client_event_id")
        .eq("challenge_id", challengeId)
        .in("client_event_id", clientEventIds)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false });

      expect(fetchError).toBeNull();
      expect(allActivities?.length).toBe(activityCount);

      // Now paginate through one at a time using composite cursor
      const seenIds = new Set<string>();
      let cursor: { beforeRecordedAt: string; beforeId: string } | null = null;
      let iterations = 0;
      const maxIterations = activityCount + 2; // Safety limit

      while (iterations < maxIterations) {
        iterations++;

        let query = user1.client
          .from("activity_logs")
          .select("id, recorded_at, value")
          .eq("challenge_id", challengeId)
          .in("client_event_id", clientEventIds)
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1);

        if (cursor) {
          // Apply composite cursor filter
          query = query.or(
            `recorded_at.lt.${cursor.beforeRecordedAt},and(recorded_at.eq.${cursor.beforeRecordedAt},id.lt.${cursor.beforeId})`,
          );
        }

        const { data, error } = await query;
        expect(error).toBeNull();

        if (!data || data.length === 0) {
          break; // No more results
        }

        const row = data[0];

        // Verify no duplicates
        expect(seenIds.has(row.id)).toBe(false);
        seenIds.add(row.id);

        // Update cursor for next iteration
        // IMPORTANT: Use timestamp directly from PostgreSQL to preserve microsecond precision
        // Do NOT round-trip through JavaScript Date (only millisecond precision)
        cursor = {
          beforeRecordedAt: row.recorded_at!,
          beforeId: row.id,
        };
      }

      // Verify we saw ALL activities (no skips)
      expect(seenIds.size).toBe(activityCount);

      // Verify the IDs match what we created
      const allIds = new Set(allActivities!.map((a) => a.id));
      seenIds.forEach((id) => {
        expect(allIds.has(id)).toBe(true);
      });
    });

    it("should handle pagination with fractional-second timestamps in .or() filter", async () => {
      const challengeId = requireId(sameSecondChallengeId);

      // Create 3 more activities quickly
      const clientEventIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const clientEventId = generateTestUUID();
        clientEventIds.push(clientEventId);
        await user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 1000 + i,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
      }

      // Fetch the middle activity to use as cursor
      const { data: activities } = await user1.client
        .from("activity_logs")
        .select("id, recorded_at")
        .eq("challenge_id", challengeId)
        .in("client_event_id", clientEventIds)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false });

      expect(activities?.length).toBe(3);

      const middleActivity = activities![1];
      // Use timestamp directly from PostgreSQL to preserve full precision
      const cursorTimestamp = middleActivity.recorded_at!;

      // Verify the timestamp has fractional seconds (most databases include them)
      // If not, the test still validates the query works
      const hasFractional = /\.\d+Z$/.test(cursorTimestamp);

      // Query using fractional-second timestamp in .or() filter
      const { data: beforeCursor, error } = await user1.client
        .from("activity_logs")
        .select("id, recorded_at")
        .eq("challenge_id", challengeId)
        .in("client_event_id", clientEventIds)
        .or(
          `recorded_at.lt.${cursorTimestamp},and(recorded_at.eq.${cursorTimestamp},id.lt.${middleActivity.id})`,
        )
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false });

      expect(error).toBeNull();

      // Should return exactly 1 activity (the one after middle in desc order)
      expect(beforeCursor?.length).toBe(1);

      // The returned activity should not be the cursor activity
      expect(beforeCursor![0].id).not.toBe(middleActivity.id);

      // Log for debugging if needed
      if (hasFractional) {
        console.log(`Verified .or() filter works with fractional timestamp: ${cursorTimestamp}`);
      }
    });

    it("should paginate correctly through activities using extractCursor pattern", async () => {
      const challengeId = requireId(sameSecondChallengeId);

      // Create 4 activities rapidly
      const clientEventIds: string[] = [];
      const createPromises = Array.from({ length: 4 }, () => {
        const clientEventId = generateTestUUID();
        clientEventIds.push(clientEventId);
        return user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 50,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
      });
      await Promise.all(createPromises);

      // Simulate the extractCursor pattern from activities service
      // IMPORTANT: Use timestamp directly to preserve PostgreSQL microsecond precision
      const extractCursor = (row: { id: string; recorded_at: string }) => ({
        beforeRecordedAt: row.recorded_at,
        beforeId: row.id,
      });

      // Page through 2 at a time
      const allFetchedIds: string[] = [];
      let cursor: { beforeRecordedAt: string; beforeId: string } | null = null;

      for (let page = 0; page < 3; page++) {
        let query = user1.client
          .from("activity_logs")
          .select("id, recorded_at")
          .eq("challenge_id", challengeId)
          .in("client_event_id", clientEventIds)
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(2);

        if (cursor) {
          query = query.or(
            `recorded_at.lt.${cursor.beforeRecordedAt},and(recorded_at.eq.${cursor.beforeRecordedAt},id.lt.${cursor.beforeId})`,
          );
        }

        const { data, error } = await query;
        expect(error).toBeNull();

        if (!data || data.length === 0) break;

        data.forEach((row) => {
          allFetchedIds.push(row.id);
        });

        // Extract cursor from last row
        const lastRow = data[data.length - 1];
        cursor = extractCursor(lastRow);
      }

      // Verify we got all 4 unique IDs
      const uniqueIds = new Set(allFetchedIds);
      expect(uniqueIds.size).toBe(4);
      expect(allFetchedIds.length).toBe(4); // No duplicates
    });
  });

  describe("Activity logs RLS", () => {
    it("should only allow user to see their own activity logs", async () => {
      // Create challenge with both users
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);

      try {
        await user1.client.from("challenge_participants").insert({
          challenge_id: challengeId,
          user_id: user1.id,
          invite_status: "accepted",
        });

        await inviteToChallenge(user1.client, challengeId, user2.id);
        await acceptChallengeInvite(user2.client, challengeId);

        // Both users log activity
        await user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 1000,
          p_source: "manual",
          p_client_event_id: generateTestUUID(),
        });

        await user2.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 2000,
          p_source: "manual",
          p_client_event_id: generateTestUUID(),
        });

        // User1 queries activity_logs - should only see their own
        const { data: user1Logs } = await user1.client
          .from("activity_logs")
          .select("*")
          .eq("challenge_id", challengeId);

        expect(user1Logs?.length).toBe(1);
        expect(user1Logs?.[0].user_id).toBe(user1.id);
        expect(user1Logs?.[0].value).toBe(1000);

        // User2 queries activity_logs - should only see their own
        const { data: user2Logs } = await user2.client
          .from("activity_logs")
          .select("*")
          .eq("challenge_id", challengeId);

        expect(user2Logs?.length).toBe(1);
        expect(user2Logs?.[0].user_id).toBe(user2.id);
        expect(user2Logs?.[0].value).toBe(2000);
      } finally {
        await cleanupChallenge(challengeId);
      }
    });
  });

  // =============================================================================
  // SERVICE API PAGINATION TESTS
  // =============================================================================
  // These tests call activityService.getRecentActivities() directly to validate
  // the service layer's pagination logic, not just raw Supabase queries.
  // =============================================================================

  describe("activityService.getRecentActivities API", () => {
    // Import service inline to avoid module resolution issues in test environment
    const { activityService } = require("@/services/activities");

    let serviceTestChallengeId: string | null = null;
    const serviceTestClientEventIds: string[] = [];

    beforeAll(async () => {
      // Create a challenge for service API tests
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      serviceTestChallengeId = requireId(challenge.id);

      // Add user1 as participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: serviceTestChallengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // Log 7 activities to have enough for pagination testing
      for (let i = 0; i < 7; i++) {
        const clientEventId = generateTestUUID();
        serviceTestClientEventIds.push(clientEventId);
        await user1.client.rpc("log_activity", {
          p_challenge_id: serviceTestChallengeId,
          p_activity_type: "steps",
          p_value: (i + 1) * 100,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
        // Small delay to help ensure distinct timestamps
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }, 60000);

    afterAll(async () => {
      if (serviceTestChallengeId) {
        await cleanupChallenge(serviceTestChallengeId);
        serviceTestChallengeId = null;
      }
    });

    it("should return activities via service API with injected client", async () => {
      const activities: ActivityLog[] = await activityService.getRecentActivities({
        limit: 5,
        client: user1.client,
      });

      expect(activities).toBeDefined();
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);
      expect(activities.length).toBeLessThanOrEqual(5);

      // All activities should belong to user1
      activities.forEach((activity) => {
        expect(activity.user_id).toBe(user1.id);
      });
    });

    it("should paginate using extractCursor with no duplicates", async () => {
      const seenIds = new Set<string>();
      const allFetchedActivities: ActivityLog[] = [];
      let cursor: { beforeRecordedAt: string; beforeId: string } | null = null;
      const pageSize = 2;
      let iterations = 0;
      const maxIterations = 10;

      // Paginate through all activities
      while (iterations < maxIterations) {
        iterations++;

        const activities: ActivityLog[] = await activityService.getRecentActivities({
          limit: pageSize,
          ...(cursor && {
            beforeRecordedAt: cursor.beforeRecordedAt,
            beforeId: cursor.beforeId,
          }),
          client: user1.client,
        });

        if (activities.length === 0) {
          break;
        }

        // Check for duplicates
        activities.forEach((activity) => {
          expect(seenIds.has(activity.id)).toBe(false);
          seenIds.add(activity.id);
          allFetchedActivities.push(activity);
        });

        // Extract cursor from last activity for next page
        const lastActivity: ActivityLog = activities[activities.length - 1];
        cursor = activityService.extractCursor(lastActivity);
      }

      // Should have fetched at least the 7 activities we created
      expect(allFetchedActivities.length).toBeGreaterThanOrEqual(7);

      // Verify our test activities are in the results
      const fetchedClientEventIds = new Set(
        allFetchedActivities
          .filter((a) => a.client_event_id !== null)
          .map((a) => a.client_event_id as string),
      );
      serviceTestClientEventIds.forEach((id) => {
        expect(fetchedClientEventIds.has(id)).toBe(true);
      });
    });

    it("should return results in descending order by recorded_at", async () => {
      const activities: ActivityLog[] = await activityService.getRecentActivities({
        limit: 10,
        client: user1.client,
      });

      expect(activities.length).toBeGreaterThan(1);

      // Verify descending order
      for (let i = 1; i < activities.length; i++) {
        const prevTime = new Date(activities[i - 1].recorded_at).getTime();
        const currTime = new Date(activities[i].recorded_at).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });

    it("should respect limit parameter", async () => {
      const activities3: ActivityLog[] = await activityService.getRecentActivities({
        limit: 3,
        client: user1.client,
      });
      expect(activities3.length).toBeLessThanOrEqual(3);

      const activities1: ActivityLog[] = await activityService.getRecentActivities({
        limit: 1,
        client: user1.client,
      });
      expect(activities1.length).toBeLessThanOrEqual(1);
    });
  });

  // =============================================================================
  // SAME-SECOND REGRESSION TEST (SERVICE API)
  // =============================================================================
  // Regression test: verifies that activities logged within the same second
  // are not skipped during pagination when using the service API.
  // =============================================================================

  describe("Same-second pagination regression (service API)", () => {
    const { activityService } = require("@/services/activities");

    let sameSecondChallengeId: string | null = null;
    const sameSecondClientEventIds: string[] = [];

    beforeAll(async () => {
      // Clean up any existing activities for user1 to ensure test isolation
      const serviceClient = createServiceClient();
      await serviceClient.from("activity_logs").delete().eq("user_id", user1.id);

      // Create a challenge
      const timeBounds = getActiveTimeBounds();
      const challenge = await createTestChallenge(user1.client, {
        ...timeBounds,
      });
      const challengeId = requireId(challenge.id);
      sameSecondChallengeId = challengeId;

      // Add user1 as participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      // Log 5 activities as fast as possible (likely same second)
      const createPromises = Array.from({ length: 5 }, () => {
        const clientEventId = generateTestUUID();
        sameSecondClientEventIds.push(clientEventId);
        return user1.client.rpc("log_activity", {
          p_challenge_id: challengeId,
          p_activity_type: "steps",
          p_value: 50,
          p_source: "manual",
          p_client_event_id: clientEventId,
        });
      });
      await Promise.all(createPromises);
    }, 60000);

    afterAll(async () => {
      if (sameSecondChallengeId) {
        await cleanupChallenge(sameSecondChallengeId);
        sameSecondChallengeId = null;
      }
    });

    it("should paginate through same-second activities without skipping (1 at a time)", async () => {
      const seenIds = new Set<string>();
      let cursor: { beforeRecordedAt: string; beforeId: string } | null = null;
      let iterations = 0;
      const maxIterations = 10; // Only need 5 + buffer since we filter by challenge

      // Paginate 1 activity at a time - most rigorous test for cursor precision
      while (iterations < maxIterations) {
        iterations++;

        const activities: ActivityLog[] = await activityService.getRecentActivities({
          limit: 1,
          challengeId: sameSecondChallengeId, // Filter to this challenge only
          ...(cursor && {
            beforeRecordedAt: cursor.beforeRecordedAt,
            beforeId: cursor.beforeId,
          }),
          client: user1.client,
        });

        if (activities.length === 0) {
          break;
        }

        const activity: ActivityLog = activities[0];

        // Verify no duplicates
        expect(seenIds.has(activity.id)).toBe(false);
        seenIds.add(activity.id);

        // Extract cursor for next page
        cursor = activityService.extractCursor(activity);
      }

      // Query to get IDs of our test activities
      const { data: ourActivities } = await user1.client
        .from("activity_logs")
        .select("id")
        .in("client_event_id", sameSecondClientEventIds);

      const ourActivityIds = new Set(ourActivities?.map((a) => a.id) || []);

      // All our test activities should have been seen
      ourActivityIds.forEach((id) => {
        expect(seenIds.has(id)).toBe(true);
      });

      // Should have found all 5
      expect(ourActivityIds.size).toBe(5);
    });

    it("should handle extractCursor with fractional-second timestamps", async () => {
      // Fetch an activity
      const activities: ActivityLog[] = await activityService.getRecentActivities({
        limit: 1,
        client: user1.client,
      });

      expect(activities.length).toBe(1);

      const cursor = activityService.extractCursor(activities[0]);

      // Cursor should be valid ISO format with up to 6 decimal places (PostgreSQL microseconds)
      // PostgreSQL uses +00:00 suffix; JS Date.toISOString() uses Z - accept both
      expect(cursor.beforeRecordedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|\+00:00)$/,
      );
      expect(cursor.beforeId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      // Using the cursor should not throw
      const nextPage: ActivityLog[] = await activityService.getRecentActivities({
        limit: 1,
        beforeRecordedAt: cursor.beforeRecordedAt,
        beforeId: cursor.beforeId,
        client: user1.client,
      });

      expect(Array.isArray(nextPage)).toBe(true);

      // Next page should not contain the same activity
      if (nextPage.length > 0) {
        expect(nextPage[0].id).not.toBe(activities[0].id);
      }
    });
  });
});
