// src/__tests__/integration/notification-rls.integration.test.ts
// Integration tests for notification RLS — server-created, immutable inbox
//
// CONTRACT: Users can SELECT their own notifications only
// CONTRACT: Users can UPDATE their own notifications only (mark read)
// CONTRACT: No client INSERT policy — notifications are server-created
// CONTRACT: No client DELETE policy — notifications are immutable
// CONTRACT: enqueue_challenge_invite_notification enforces creator authorization
// CONTRACT: Notification data payloads must not leak private data

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createServiceClient,
  createTestChallenge,
  cleanupChallenge,
  type TestUser,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

describe("Notification RLS Integration Tests", () => {
  let user1: TestUser;
  let user2: TestUser;

  // Track notifications created via service client for cleanup
  const createdNotificationIds: string[] = [];

  beforeAll(async () => {
    user1 = await getTestUser1();
    user2 = await getTestUser2();
  }, 30000);

  afterEach(async () => {
    // Clean up any notifications created during tests
    if (createdNotificationIds.length > 0) {
      const serviceClient = createServiceClient();
      await serviceClient.from("notifications").delete().in("id", createdNotificationIds);
      createdNotificationIds.length = 0;
    }
  });

  afterAll(async () => {
    // Final cleanup
    const serviceClient = createServiceClient();
    await serviceClient
      .from("notifications")
      .delete()
      .eq("user_id", user1.id)
      .like("title", "Test%");
    await serviceClient
      .from("notifications")
      .delete()
      .eq("user_id", user2.id)
      .like("title", "Test%");
  });

  // Helper: create a notification via service client (bypasses RLS)
  async function createTestNotification(
    userId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("notifications")
      .insert({
        user_id: userId,
        type: "challenge_invite_received",
        title: "Test Notification",
        body: "This is a test notification",
        data: { challenge_id: "00000000-0000-0000-0000-000000000000" },
        ...overrides,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Failed to create test notification: ${error.message}`);
    createdNotificationIds.push(data.id);
    return data.id;
  }

  // =========================================================================
  // SELECT — Self-only read
  // =========================================================================

  describe("SELECT (self-only)", () => {
    it("should allow user to SELECT their own notifications", async () => {
      const notifId = await createTestNotification(user1.id);

      const { data, error } = await user1.client
        .from("notifications")
        .select("*")
        .eq("id", notifId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(notifId);
      expect(data?.user_id).toBe(user1.id);
    });

    it("should NOT allow user to SELECT another user's notifications", async () => {
      const notifId = await createTestNotification(user2.id);

      const { data, error } = await user1.client
        .from("notifications")
        .select("*")
        .eq("id", notifId)
        .maybeSingle();

      // RLS filters it out — no error, no data
      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  // =========================================================================
  // UPDATE — Self-only (mark read)
  // =========================================================================

  describe("UPDATE (mark read, self-only)", () => {
    it("should allow user to mark their own notification as read", async () => {
      const notifId = await createTestNotification(user1.id);

      const { error } = await user1.client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notifId);

      expect(error).toBeNull();

      // Verify the update
      const { data } = await user1.client
        .from("notifications")
        .select("read_at")
        .eq("id", notifId)
        .single();

      expect(data?.read_at).not.toBeNull();
    });

    it("should NOT allow user to UPDATE another user's notification", async () => {
      const notifId = await createTestNotification(user2.id);

      // User1 tries to mark user2's notification as read
      await user1.client
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notifId);

      // Verify user2's notification is still unread
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("notifications")
        .select("read_at")
        .eq("id", notifId)
        .single();

      expect(data?.read_at).toBeNull();
    });
  });

  // =========================================================================
  // INSERT — No client INSERT policy
  // =========================================================================

  describe("INSERT (denied for clients)", () => {
    it("should NOT allow client to INSERT notifications", async () => {
      const { data, error } = await user1.client
        .from("notifications")
        .insert({
          user_id: user1.id,
          type: "challenge_invite_received",
          title: "Client-created notification",
          body: "This should be rejected",
        })
        .select("id")
        .maybeSingle();

      expect(error).not.toBeNull();
      // If insert somehow succeeds, track for cleanup
      if (data?.id) createdNotificationIds.push(data.id);
    });

    it("should NOT allow client to INSERT notifications for other users", async () => {
      const { data, error } = await user1.client
        .from("notifications")
        .insert({
          user_id: user2.id,
          type: "friend_request_received",
          title: "Spam notification",
          body: "Spamming another user",
        })
        .select("id")
        .maybeSingle();

      expect(error).not.toBeNull();
      if (data?.id) createdNotificationIds.push(data.id);
    });
  });

  // =========================================================================
  // DELETE — No client DELETE policy
  // =========================================================================

  describe("DELETE (denied for clients)", () => {
    it("should NOT allow client to DELETE their own notifications", async () => {
      const notifId = await createTestNotification(user1.id);

      // Attempt delete — RLS with no DELETE policy silently matches 0 rows
      // (PostgreSQL doesn't error; it just finds nothing to delete)
      await user1.client.from("notifications").delete().eq("id", notifId);

      // The real proof: notification must still exist
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("notifications")
        .select("id")
        .eq("id", notifId)
        .single();

      expect(data).not.toBeNull();
    });

    it("should NOT allow client to DELETE another user's notifications", async () => {
      const notifId = await createTestNotification(user2.id);

      // Attempt delete — RLS silently matches 0 rows (no DELETE policy + no SELECT visibility)
      await user1.client.from("notifications").delete().eq("id", notifId);

      // The real proof: notification must still exist
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("notifications")
        .select("id")
        .eq("id", notifId)
        .single();

      expect(data).not.toBeNull();
    });
  });

  // =========================================================================
  // ENQUEUE RPC — Server-side notification creation
  // =========================================================================

  describe("enqueue_challenge_invite_notification RPC", () => {
    let challengeId: string;

    beforeEach(async () => {
      // Create a challenge owned by user1 and add user1 as accepted participant
      const challenge = await createTestChallenge(user1.client);
      challengeId = challenge.id;
    });

    afterEach(async () => {
      // Clean up notifications created by RPC
      const serviceClient = createServiceClient();
      await serviceClient
        .from("notifications")
        .delete()
        .eq("type", "challenge_invite_received")
        .filter("data->>challenge_id", "eq", challengeId);

      await cleanupChallenge(challengeId);
    });

    it("should create notification for invited user when called by creator", async () => {
      const { error } = await user1.client.rpc("enqueue_challenge_invite_notification", {
        p_challenge_id: challengeId,
        p_invited_user_id: user2.id,
      });

      expect(error).toBeNull();

      // Verify notification was created for user2
      const { data } = await user2.client
        .from("notifications")
        .select("*")
        .eq("type", "challenge_invite_received")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      expect(data).toBeDefined();
      expect(data?.user_id).toBe(user2.id);
      expect(data?.type).toBe("challenge_invite_received");
    });

    it("should reject call from non-creator", async () => {
      // User2 is NOT the creator of this challenge
      const { error } = await user2.client.rpc("enqueue_challenge_invite_notification", {
        p_challenge_id: challengeId,
        p_invited_user_id: user1.id,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/not_creator/i);
    });

    it("should include only challenge_id in notification data (no private data)", async () => {
      await user1.client.rpc("enqueue_challenge_invite_notification", {
        p_challenge_id: challengeId,
        p_invited_user_id: user2.id,
      });

      const { data } = await user2.client
        .from("notifications")
        .select("data")
        .eq("type", "challenge_invite_received")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      expect(data?.data).toBeDefined();
      const payload = typeof data?.data === "string" ? JSON.parse(data.data) : data?.data;

      // Only challenge_id should be in the payload
      expect(payload).toHaveProperty("challenge_id");
      expect(payload.challenge_id).toBe(challengeId);

      // Must NOT contain private data
      expect(payload).not.toHaveProperty("participant_list");
      expect(payload).not.toHaveProperty("email");
      expect(payload).not.toHaveProperty("xp");
      expect(payload).not.toHaveProperty("streak");
    });
  });

  // =========================================================================
  // PUSH DELIVERY IDEMPOTENCY
  // =========================================================================

  describe("push_sent_at (delivery idempotency)", () => {
    it("should allow marking push_sent_at to prevent duplicate delivery", async () => {
      const notifId = await createTestNotification(user1.id);

      // Simulate delivery worker marking notification as sent (via service client)
      const serviceClient = createServiceClient();
      const { error } = await serviceClient
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notifId);

      expect(error).toBeNull();

      // Verify push_sent_at is set
      const { data } = await serviceClient
        .from("notifications")
        .select("push_sent_at")
        .eq("id", notifId)
        .single();

      expect(data?.push_sent_at).not.toBeNull();
    });

    it("should filter unsent notifications correctly", async () => {
      const unsentId = await createTestNotification(user1.id);
      const sentId = await createTestNotification(user1.id, {
        push_sent_at: new Date().toISOString(),
      });

      // Query pattern used by delivery worker
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("notifications")
        .select("id")
        .eq("user_id", user1.id)
        .is("push_sent_at", null)
        .in("id", [unsentId, sentId]);

      // Only the unsent notification should appear
      const ids = data?.map((n) => n.id) ?? [];
      expect(ids).toContain(unsentId);
      expect(ids).not.toContain(sentId);
    });
  });
});
