/**
 * Stale Notification Triggers Integration Tests
 *
 * Tests that database triggers automatically mark notifications as read
 * when underlying state changes. This verifies the database-first approach
 * to preventing stale notifications.
 *
 * CONTRACT: Notifications are immutable (no DELETE), only read_at is set.
 * CONTRACT: Database enforces staleness rules, not application code.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

// Test environment setup
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Service client for setup/teardown (bypasses RLS)
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

// Helper: Create test user
async function createTestUser(name: string): Promise<TestUser> {
  const email = `${name}-${uuidv4().slice(0, 8)}@test.fitchallenge.local`;
  const password = "TestPassword123!";

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`);
  }

  // Create client authenticated as this user
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  await client.auth.signInWithPassword({ email, password });

  return { id: data.user.id, email, client };
}

// Helper: Cleanup test user
async function cleanupTestUser(userId: string): Promise<void> {
  await serviceClient.from("notifications").delete().eq("user_id", userId);
  await serviceClient
    .from("challenge_participants")
    .delete()
    .eq("user_id", userId);
  await serviceClient
    .from("friends")
    .delete()
    .or(`requested_by.eq.${userId},requested_to.eq.${userId}`);
  await serviceClient.from("challenges").delete().eq("creator_id", userId);
  await serviceClient.from("profiles").delete().eq("id", userId);
  await serviceClient.auth.admin.deleteUser(userId);
}

// Helper: Get notification by type and data
async function getNotification(
  userId: string,
  type: string,
  dataKey: string,
  dataValue: string,
): Promise<{ id: string; read_at: string | null } | null> {
  const { data } = await serviceClient
    .from("notifications")
    .select("id, read_at")
    .eq("user_id", userId)
    .eq("type", type)
    .filter(`data->>${dataKey}`, "eq", dataValue)
    .maybeSingle();

  return data;
}

describe("Stale Notification Triggers", () => {
  let creator: TestUser;
  let invitee: TestUser;

  beforeAll(async () => {
    creator = await createTestUser("creator");
    invitee = await createTestUser("invitee");
  }, 30000);

  afterAll(async () => {
    await cleanupTestUser(invitee.id);
    await cleanupTestUser(creator.id);
  }, 30000);

  describe("Challenge Invite Notifications", () => {
    let challengeId: string;

    beforeEach(async () => {
      // Create a challenge as creator
      const { data: challenge, error } = await creator.client
        .from("challenges")
        .insert({
          creator_id: creator.id,
          title: `Test Challenge ${uuidv4().slice(0, 8)}`,
          challenge_type: "steps",
          goal_value: 10000,
          goal_unit: "steps",
          win_condition: "highest_total",
          start_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          end_date: new Date(Date.now() + 86400000 * 7).toISOString(), // Week from now
          status: "pending",
        })
        .select()
        .single();

      if (error || !challenge) {
        throw new Error(`Failed to create challenge: ${error?.message}`);
      }

      challengeId = challenge.id;

      // Creator auto-joins
      await creator.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: creator.id,
        invite_status: "accepted",
      });
    });

    afterEach(async () => {
      // Cleanup challenge and related data
      await serviceClient
        .from("notifications")
        .delete()
        .eq("data->challenge_id", challengeId);
      await serviceClient
        .from("challenge_participants")
        .delete()
        .eq("challenge_id", challengeId);
      await serviceClient.from("challenges").delete().eq("id", challengeId);
    });

    test("declining invite marks notification as read", async () => {
      // 1. Invite user (as creator)
      await creator.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: invitee.id,
        invite_status: "pending",
      });

      // 2. Create notification (simulating what enqueue_challenge_invite_notification does)
      await serviceClient.from("notifications").insert({
        user_id: invitee.id,
        type: "challenge_invite_received",
        title: "New challenge invite",
        body: "You've been invited to a challenge",
        data: { challenge_id: challengeId },
      });

      // 3. Verify notification is unread
      let notification = await getNotification(
        invitee.id,
        "challenge_invite_received",
        "challenge_id",
        challengeId,
      );
      expect(notification).not.toBeNull();
      expect(notification!.read_at).toBeNull();

      // 4. Decline invite (as invitee)
      const { error } = await invitee.client.rpc(
        "respond_to_challenge_invite",
        {
          p_challenge_id: challengeId,
          p_response: "declined",
        },
      );
      expect(error).toBeNull();

      // 5. Verify notification is now marked as read
      notification = await getNotification(
        invitee.id,
        "challenge_invite_received",
        "challenge_id",
        challengeId,
      );
      expect(notification).not.toBeNull();
      expect(notification!.read_at).not.toBeNull();
    });

    test("accepting invite marks notification as read", async () => {
      // 1. Invite user
      await creator.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: invitee.id,
        invite_status: "pending",
      });

      // 2. Create notification
      await serviceClient.from("notifications").insert({
        user_id: invitee.id,
        type: "challenge_invite_received",
        title: "New challenge invite",
        body: "You've been invited to a challenge",
        data: { challenge_id: challengeId },
      });

      // 3. Accept invite
      const { error } = await invitee.client.rpc(
        "respond_to_challenge_invite",
        {
          p_challenge_id: challengeId,
          p_response: "accepted",
        },
      );
      expect(error).toBeNull();

      // 4. Verify notification is marked as read
      const notification = await getNotification(
        invitee.id,
        "challenge_invite_received",
        "challenge_id",
        challengeId,
      );
      expect(notification).not.toBeNull();
      expect(notification!.read_at).not.toBeNull();
    });

    test("cancelling challenge marks all invite notifications as read", async () => {
      // 1. Invite user
      await creator.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: invitee.id,
        invite_status: "pending",
      });

      // 2. Create notification
      await serviceClient.from("notifications").insert({
        user_id: invitee.id,
        type: "challenge_invite_received",
        title: "New challenge invite",
        body: "You've been invited to a challenge",
        data: { challenge_id: challengeId },
      });

      // 3. Verify notification is unread
      let notification = await getNotification(
        invitee.id,
        "challenge_invite_received",
        "challenge_id",
        challengeId,
      );
      expect(notification!.read_at).toBeNull();

      // 4. Cancel challenge (as creator)
      const { error } = await creator.client
        .from("challenges")
        .update({ status: "cancelled" })
        .eq("id", challengeId);
      expect(error).toBeNull();

      // 5. Verify notification is marked as read
      notification = await getNotification(
        invitee.id,
        "challenge_invite_received",
        "challenge_id",
        challengeId,
      );
      expect(notification!.read_at).not.toBeNull();
    });
  });

  describe("Friend Request Notifications", () => {
    afterEach(async () => {
      // Cleanup friendships between test users
      await serviceClient
        .from("friends")
        .delete()
        .or(
          `and(requested_by.eq.${creator.id},requested_to.eq.${invitee.id}),and(requested_by.eq.${invitee.id},requested_to.eq.${creator.id})`,
        );

      await serviceClient
        .from("notifications")
        .delete()
        .eq("user_id", invitee.id)
        .eq("type", "friend_request_received");
    });

    test("accepting friend request marks notification as read", async () => {
      // 1. Send friend request (as creator -> invitee)
      const { error: friendError } = await creator.client
        .from("friends")
        .insert({
          requested_by: creator.id,
          requested_to: invitee.id,
          status: "pending",
        });
      expect(friendError).toBeNull();

      // 2. Create notification (simulating enqueue_friend_request_notification)
      await serviceClient.from("notifications").insert({
        user_id: invitee.id,
        type: "friend_request_received",
        title: "New friend request",
        body: "Someone wants to be your friend",
        data: { requester_id: creator.id },
      });

      // 3. Verify notification is unread
      let notification = await getNotification(
        invitee.id,
        "friend_request_received",
        "requester_id",
        creator.id,
      );
      expect(notification).not.toBeNull();
      expect(notification!.read_at).toBeNull();

      // 4. Accept friend request (as invitee)
      const { error } = await invitee.client
        .from("friends")
        .update({ status: "accepted" })
        .eq("requested_by", creator.id)
        .eq("requested_to", invitee.id);
      expect(error).toBeNull();

      // 5. Verify notification is marked as read
      notification = await getNotification(
        invitee.id,
        "friend_request_received",
        "requester_id",
        creator.id,
      );
      expect(notification!.read_at).not.toBeNull();
    });

    test("blocking friend request marks notification as read", async () => {
      // 1. Send friend request
      await creator.client.from("friends").insert({
        requested_by: creator.id,
        requested_to: invitee.id,
        status: "pending",
      });

      // 2. Create notification
      await serviceClient.from("notifications").insert({
        user_id: invitee.id,
        type: "friend_request_received",
        title: "New friend request",
        body: "Someone wants to be your friend",
        data: { requester_id: creator.id },
      });

      // 3. Block (as invitee)
      const { error } = await invitee.client
        .from("friends")
        .update({ status: "blocked" })
        .eq("requested_by", creator.id)
        .eq("requested_to", invitee.id);
      expect(error).toBeNull();

      // 4. Verify notification is marked as read
      const notification = await getNotification(
        invitee.id,
        "friend_request_received",
        "requester_id",
        creator.id,
      );
      expect(notification!.read_at).not.toBeNull();
    });

    test("deleting pending friend request marks notification as read", async () => {
      // 1. Send friend request
      await creator.client.from("friends").insert({
        requested_by: creator.id,
        requested_to: invitee.id,
        status: "pending",
      });

      // 2. Create notification
      await serviceClient.from("notifications").insert({
        user_id: invitee.id,
        type: "friend_request_received",
        title: "New friend request",
        body: "Someone wants to be your friend",
        data: { requester_id: creator.id },
      });

      // 3. Delete friendship (withdraw request, as creator)
      const { error } = await creator.client
        .from("friends")
        .delete()
        .eq("requested_by", creator.id)
        .eq("requested_to", invitee.id);
      expect(error).toBeNull();

      // 4. Verify notification is marked as read
      const notification = await getNotification(
        invitee.id,
        "friend_request_received",
        "requester_id",
        creator.id,
      );
      expect(notification!.read_at).not.toBeNull();
    });
  });
});
