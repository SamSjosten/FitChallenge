// src/__tests__/integration/profile-privacy.integration.test.ts
// Integration tests for profile privacy split — profiles (private) vs profiles_public (public)
//
// CONTRACT: profiles is self-only (auth.uid() = id)
// CONTRACT: profiles_public is globally readable, no client writes
// CONTRACT: Trigger syncs username, display_name, avatar_url from profiles → profiles_public

import {
  validateTestConfig,
  getTestUser1,
  getTestUser2,
  createServiceClient,
  type TestUser,
} from "./setup";

beforeAll(() => {
  validateTestConfig();
});

describe("Profile Privacy RLS Integration Tests", () => {
  let user1: TestUser;
  let user2: TestUser;

  beforeAll(async () => {
    user1 = await getTestUser1();
    user2 = await getTestUser2();
  }, 30000);

  // =========================================================================
  // PROFILES (PRIVATE) — Self-only access
  // =========================================================================

  describe("profiles table (private, self-only)", () => {
    it("should allow user to SELECT their own full profile", async () => {
      const { data, error } = await user1.client
        .from("profiles")
        .select("*")
        .eq("id", user1.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(user1.id);
      // Private fields must be present for self
      expect(data).toHaveProperty("xp_total");
      expect(data).toHaveProperty("current_streak");
      expect(data).toHaveProperty("longest_streak");
      expect(data).toHaveProperty("is_premium");
      expect(data).toHaveProperty("timezone");
    });

    it("should NOT return another user's profile via direct ID query", async () => {
      const { data, error } = await user1.client
        .from("profiles")
        .select("*")
        .eq("id", user2.id)
        .maybeSingle();

      // RLS should filter this out — no error, but no data
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it("should NOT return other users' profiles in unfiltered SELECT", async () => {
      const { data, error } = await user1.client.from("profiles").select("id");

      expect(error).toBeNull();
      // Should only return the authenticated user's own profile
      expect(data?.length).toBe(1);
      expect(data?.[0]?.id).toBe(user1.id);
    });

    it("should allow user to UPDATE their own profile", async () => {
      const originalName = `TestUser_${user1.id.slice(0, 8)}`;
      const testName = `Updated_${Date.now()}`;

      const { error: updateError } = await user1.client
        .from("profiles")
        .update({ display_name: testName })
        .eq("id", user1.id);

      expect(updateError).toBeNull();

      // Verify the update applied
      const { data } = await user1.client
        .from("profiles")
        .select("display_name")
        .eq("id", user1.id)
        .single();

      expect(data?.display_name).toBe(testName);

      // Restore
      await user1.client
        .from("profiles")
        .update({ display_name: originalName })
        .eq("id", user1.id);
    });

    it("should NOT allow user to UPDATE another user's profile", async () => {
      const { data } = await user2.client
        .from("profiles")
        .select("display_name")
        .eq("id", user2.id)
        .single();

      const originalName = data?.display_name;

      // User1 tries to update user2's profile
      await user1.client
        .from("profiles")
        .update({ display_name: "HACKED" })
        .eq("id", user2.id);

      // Verify user2's profile is unchanged (use service client to bypass RLS)
      const serviceClient = createServiceClient();
      const { data: check } = await serviceClient
        .from("profiles")
        .select("display_name")
        .eq("id", user2.id)
        .single();

      expect(check?.display_name).toBe(originalName);
    });
  });

  // =========================================================================
  // PROFILES_PUBLIC — Global read, no client write
  // =========================================================================

  describe("profiles_public table (global read, no client write)", () => {
    it("should allow any authenticated user to SELECT any public profile", async () => {
      const { data, error } = await user1.client
        .from("profiles_public")
        .select("*")
        .eq("id", user2.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(user2.id);
    });

    it("should contain ONLY safe fields (username, display_name, avatar_url)", async () => {
      const { data } = await user1.client
        .from("profiles_public")
        .select("*")
        .eq("id", user2.id)
        .single();

      expect(data).toBeDefined();
      const keys = Object.keys(data!);

      // Only these fields should exist in profiles_public
      const allowedFields = [
        "id",
        "username",
        "display_name",
        "avatar_url",
        "updated_at",
      ];

      for (const key of keys) {
        expect(allowedFields).toContain(key);
      }

      // Private fields must NOT exist
      expect(data).not.toHaveProperty("xp_total");
      expect(data).not.toHaveProperty("current_streak");
      expect(data).not.toHaveProperty("longest_streak");
      expect(data).not.toHaveProperty("is_premium");
      expect(data).not.toHaveProperty("timezone");
      expect(data).not.toHaveProperty("last_activity_date");
    });

    it("should NOT allow client to INSERT into profiles_public", async () => {
      const { error } = await user1.client.from("profiles_public").insert({
        id: user1.id,
        username: "injected_user",
      });

      expect(error).not.toBeNull();
    });

    it("should NOT allow client to UPDATE profiles_public directly", async () => {
      const { data: before } = await user1.client
        .from("profiles_public")
        .select("display_name")
        .eq("id", user1.id)
        .single();

      await user1.client
        .from("profiles_public")
        .update({ display_name: "DIRECT_WRITE" })
        .eq("id", user1.id);

      // Verify unchanged (use service client)
      const serviceClient = createServiceClient();
      const { data: after } = await serviceClient
        .from("profiles_public")
        .select("display_name")
        .eq("id", user1.id)
        .single();

      expect(after?.display_name).toBe(before?.display_name);
    });

    it("should NOT allow client to DELETE from profiles_public", async () => {
      // Attempt delete — RLS with no DELETE policy silently matches 0 rows
      await user1.client
        .from("profiles_public")
        .delete()
        .eq("id", user1.id);

      // The real proof: row must still exist
      const serviceClient = createServiceClient();
      const { data } = await serviceClient
        .from("profiles_public")
        .select("id")
        .eq("id", user1.id)
        .single();

      expect(data).not.toBeNull();
    });
  });

  // =========================================================================
  // SYNC TRIGGER — profiles → profiles_public
  // =========================================================================

  describe("sync trigger (profiles → profiles_public)", () => {
    afterEach(async () => {
      // Restore user1's profile to a clean state
      await user1.client
        .from("profiles")
        .update({
          display_name: null,
          avatar_url: null,
        })
        .eq("id", user1.id);
    });

    it("should sync display_name update to profiles_public", async () => {
      const testName = `SyncTest_${Date.now()}`;

      // Update private profile
      const { error } = await user1.client
        .from("profiles")
        .update({ display_name: testName })
        .eq("id", user1.id);

      expect(error).toBeNull();

      // Verify synced to public profile
      const { data } = await user2.client
        .from("profiles_public")
        .select("display_name")
        .eq("id", user1.id)
        .single();

      expect(data?.display_name).toBe(testName);
    });

    it("should sync avatar_url update to profiles_public", async () => {
      const testAvatar = `https://example.com/avatar_${Date.now()}.png`;

      const { error } = await user1.client
        .from("profiles")
        .update({ avatar_url: testAvatar })
        .eq("id", user1.id);

      expect(error).toBeNull();

      const { data } = await user2.client
        .from("profiles_public")
        .select("avatar_url")
        .eq("id", user1.id)
        .single();

      expect(data?.avatar_url).toBe(testAvatar);
    });

    it("should NOT sync private fields to profiles_public", async () => {
      // Update a private field
      await user1.client
        .from("profiles")
        .update({ timezone: "America/New_York" })
        .eq("id", user1.id);

      // profiles_public should not have timezone
      const { data } = await user2.client
        .from("profiles_public")
        .select("*")
        .eq("id", user1.id)
        .single();

      expect(data).not.toHaveProperty("timezone");
    });
  });
});