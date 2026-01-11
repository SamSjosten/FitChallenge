// src/__tests__/integration/activity.server-time.integration.test.ts
// Patch 2 tests: server-time enforcement in log_activity

import {
  validateTestConfig,
  getTestUser1,
  createTestChallenge,
  cleanupChallenge,
  generateTestUUID,
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

describe("Activity logging - server time enforcement", () => {
  let user1: TestUser;

  beforeAll(async () => {
    user1 = await getTestUser1();
  }, 30000);

  it("allows RPC calls without p_recorded_at (server applies time)", async () => {
    const challenge = await createTestChallenge(user1.client, {
      title: "Server Time - No recorded_at param",
      // Ensure active window
      start_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // -1h
      end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +24h
    });
    const challengeId = requireId(challenge.id);

    try {
      // Add user1 as accepted participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      const clientEventId = generateTestUUID();

      // p_recorded_at intentionally omitted
      const { error } = await user1.client.rpc("log_activity", {
        p_challenge_id: challengeId,
        p_activity_type: "steps",
        p_value: 111,
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
      expect(logs?.[0]?.recorded_at).toBeTruthy();
    } finally {
      await cleanupChallenge(challengeId);
    }
  });

  it("ignores client-provided recorded_at for manual logs (uses server time now())", async () => {
    const challenge = await createTestChallenge(user1.client, {
      title: "Server Time - Ignore manual recorded_at",
      // Ensure active window
      start_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // -1h
      end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +24h
    });
    const challengeId = requireId(challenge.id);

    try {
      // Add user1 as accepted participant
      await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });

      const clientEventId = generateTestUUID();

      // "Malicious" timestamp. Keep it within challenge bounds to avoid bounds failures.
      // We choose 30 minutes ago (still inside active window), but the server should override to now().
      const maliciousRecordedAt = new Date(
        Date.now() - 30 * 60 * 1000
      ).toISOString();

      const beforeMs = Date.now();

      const { error } = await user1.client.rpc("log_activity", {
        p_challenge_id: challengeId,
        p_activity_type: "steps",
        p_value: 222,
        p_recorded_at: maliciousRecordedAt, // should be ignored for manual
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
      expect(storedRecordedAt).toBeTruthy();

      // Must not equal the client-supplied timestamp
      expect(storedRecordedAt).not.toBe(maliciousRecordedAt);

      // Should be close to server "now" at test execution time (allow a small window)
      const storedMs = new Date(storedRecordedAt).getTime();
      const afterMs = Date.now();
      expect(storedMs).toBeGreaterThanOrEqual(beforeMs - 2 * 60 * 1000);
      expect(storedMs).toBeLessThanOrEqual(afterMs + 2 * 60 * 1000);
    } finally {
      await cleanupChallenge(challengeId);
    }
  });
});
