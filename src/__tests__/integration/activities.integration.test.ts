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
  type TestUser,
} from "./setup";

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
    const { error: participantError } = await user1.client
      .from("challenge_participants")
      .insert({
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
        const maliciousRecordedAt = new Date(
          Date.now() - 30 * 60 * 1000
        ).toISOString(); // -30m

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
          { p_challenge_id: challengeId }
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
        const { data: user1Data } = await user1.client.rpc(
          "get_activity_summary",
          { p_challenge_id: challengeId }
        );
        const user1Row = Array.isArray(user1Data) ? user1Data[0] : user1Data;
        expect(Number(user1Row?.total_value)).toBe(5000);

        // User2's summary should show only their activities
        const { data: user2Data } = await user2.client.rpc(
          "get_activity_summary",
          { p_challenge_id: challengeId }
        );
        const user2Row = Array.isArray(user2Data) ? user2Data[0] : user2Data;
        expect(Number(user2Row?.total_value)).toBe(3000);
      } finally {
        await cleanupChallenge(challengeId);
      }
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
});
