// src/__tests__/integration/push-tokens.integration.test.ts
// Integration tests for push token RLS — self-managed, no cross-user access
//
// CONTRACT: Users can INSERT their own push tokens
// CONTRACT: Users can SELECT their own push tokens
// CONTRACT: Users can DELETE their own push tokens
// CONTRACT: Users CANNOT access another user's push tokens
// CONTRACT: Duplicate (user_id, token) is rejected (unique constraint)

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createServiceClient,
  generateTestUUID,
  type TestUser,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

describe("Push Token RLS Integration Tests", () => {
  let user1: TestUser;
  let user2: TestUser;

  // Track tokens for cleanup
  const createdTokenIds: string[] = [];

  beforeAll(async () => {
    user1 = await getTestUser1();
    user2 = await getTestUser2();
  }, 30000);

  afterEach(async () => {
    // Clean up tokens created during tests
    if (createdTokenIds.length > 0) {
      const serviceClient = createServiceClient();
      await serviceClient
        .from("push_tokens")
        .delete()
        .in("id", createdTokenIds);
      createdTokenIds.length = 0;
    }
  });

  afterAll(async () => {
    // Final cleanup — remove any test tokens for both users
    const serviceClient = createServiceClient();
    await serviceClient
      .from("push_tokens")
      .delete()
      .eq("user_id", user1.id)
      .like("token", "ExponentPushToken[test_%");
    await serviceClient
      .from("push_tokens")
      .delete()
      .eq("user_id", user2.id)
      .like("token", "ExponentPushToken[test_%");
  });

  // Generate a unique test token
  function testToken(): string {
    return `ExponentPushToken[test_${generateTestUUID().slice(0, 12)}]`;
  }

  // =========================================================================
  // INSERT — Self-only
  // =========================================================================

  describe("INSERT (self-only)", () => {
    it("should allow user to INSERT their own push token", async () => {
      const token = testToken();

      const { data, error } = await user1.client
        .from("push_tokens")
        .insert({
          user_id: user1.id,
          token,
          platform: "ios",
        })
        .select("id, user_id, token, platform")
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.user_id).toBe(user1.id);
      expect(data?.token).toBe(token);
      expect(data?.platform).toBe("ios");

      if (data?.id) createdTokenIds.push(data.id);
    });

    it("should NOT allow user to INSERT a token for another user", async () => {
      const token = testToken();

      const { data, error } = await user1.client
        .from("push_tokens")
        .insert({
          user_id: user2.id, // Wrong! Should be user1.id
          token,
          platform: "ios",
        })
        .select("id")
        .maybeSingle();

      expect(error).not.toBeNull();
      if (data?.id) createdTokenIds.push(data.id);
    });
  });

  // =========================================================================
  // SELECT — Self-only
  // =========================================================================

  describe("SELECT (self-only)", () => {
    it("should allow user to SELECT their own push tokens", async () => {
      const token = testToken();

      // Create token via user1's client
      const { data: created } = await user1.client
        .from("push_tokens")
        .insert({ user_id: user1.id, token, platform: "ios" })
        .select("id")
        .single();

      if (created?.id) createdTokenIds.push(created.id);

      // User1 should see their token
      const { data, error } = await user1.client
        .from("push_tokens")
        .select("*")
        .eq("id", created!.id)
        .single();

      expect(error).toBeNull();
      expect(data?.token).toBe(token);
    });

    it("should NOT allow user to SELECT another user's push tokens", async () => {
      const token = testToken();

      // Create token for user2 via service client (bypasses RLS)
      const serviceClient = createServiceClient();
      const { data: created } = await serviceClient
        .from("push_tokens")
        .insert({ user_id: user2.id, token, platform: "android" })
        .select("id")
        .single();

      if (created?.id) createdTokenIds.push(created.id);

      // User1 tries to read user2's token
      const { data, error } = await user1.client
        .from("push_tokens")
        .select("*")
        .eq("id", created!.id)
        .maybeSingle();

      // RLS filters it out
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("should only return own tokens in unfiltered query", async () => {
      const token1 = testToken();
      const token2 = testToken();

      // Create a token for user1
      const { data: t1 } = await user1.client
        .from("push_tokens")
        .insert({ user_id: user1.id, token: token1, platform: "ios" })
        .select("id")
        .single();
      if (t1?.id) createdTokenIds.push(t1.id);

      // Create a token for user2 via service client
      const serviceClient = createServiceClient();
      const { data: t2 } = await serviceClient
        .from("push_tokens")
        .insert({ user_id: user2.id, token: token2, platform: "android" })
        .select("id")
        .single();
      if (t2?.id) createdTokenIds.push(t2.id);

      // User1 queries all tokens — should only see own
      const { data } = await user1.client.from("push_tokens").select("user_id");

      const userIds = data?.map((t) => t.user_id) ?? [];
      expect(userIds.every((id) => id === user1.id)).toBe(true);
    });
  });

  // =========================================================================
  // DELETE — Self-only
  // =========================================================================

  describe("DELETE (self-only)", () => {
    it("should allow user to DELETE their own push token", async () => {
      const token = testToken();

      const { data: created } = await user1.client
        .from("push_tokens")
        .insert({ user_id: user1.id, token, platform: "ios" })
        .select("id")
        .single();

      const tokenId = created!.id;

      const { error } = await user1.client
        .from("push_tokens")
        .delete()
        .eq("id", tokenId);

      expect(error).toBeNull();

      // Verify deleted
      const { data } = await user1.client
        .from("push_tokens")
        .select("id")
        .eq("id", tokenId)
        .maybeSingle();

      expect(data).toBeNull();
      // No need to track for cleanup — already deleted
    });

    it("should NOT allow user to DELETE another user's push token", async () => {
      const token = testToken();

      // Create token for user2
      const serviceClient = createServiceClient();
      const { data: created } = await serviceClient
        .from("push_tokens")
        .insert({ user_id: user2.id, token, platform: "ios" })
        .select("id")
        .single();

      if (created?.id) createdTokenIds.push(created.id);

      // User1 tries to delete user2's token
      await user1.client
        .from("push_tokens")
        .delete()
        .eq("id", created!.id);

      // Verify token still exists
      const { data } = await serviceClient
        .from("push_tokens")
        .select("id")
        .eq("id", created!.id)
        .single();

      expect(data).not.toBeNull();
    });
  });

  // =========================================================================
  // UNIQUE CONSTRAINT
  // =========================================================================

  describe("unique constraint (user_id, token)", () => {
    it("should reject duplicate (user_id, token) pair", async () => {
      const token = testToken();

      // First insert
      const { data: first } = await user1.client
        .from("push_tokens")
        .insert({ user_id: user1.id, token, platform: "ios" })
        .select("id")
        .single();

      if (first?.id) createdTokenIds.push(first.id);

      // Duplicate insert — same user, same token
      const { error } = await user1.client
        .from("push_tokens")
        .insert({ user_id: user1.id, token, platform: "ios" });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/duplicate|unique|already exists/i);
    });

    it("should allow same token for different users", async () => {
      const token = testToken();

      // User1 registers token
      const { data: t1 } = await user1.client
        .from("push_tokens")
        .insert({ user_id: user1.id, token, platform: "ios" })
        .select("id")
        .single();
      if (t1?.id) createdTokenIds.push(t1.id);

      // User2 registers same token (different device ownership)
      const { data: t2, error } = await user2.client
        .from("push_tokens")
        .insert({ user_id: user2.id, token, platform: "ios" })
        .select("id")
        .single();

      expect(error).toBeNull();
      if (t2?.id) createdTokenIds.push(t2.id);
    });
  });
});