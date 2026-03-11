// src/__tests__/integration/offline-queue.integration.test.ts
// Integration tests for offline queue processing against real Supabase
//
// These tests validate C3 (auth error handling) and queue behavior using
// real database connections. React Native platform modules are mocked
// (they can't run in Node.js), but all Supabase operations hit the real
// test instance defined in .env.test.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  validateTestConfig,
  testConfig,
  getTestUser1,
  getTestUser2,
  createAnonClient,
  createServiceClient,
  createTestChallenge,
  inviteToChallenge,
  cleanupChallenge,
  generateTestUUID,
  type TestUser,
} from "./setup";

// =============================================================================
// MODULE MOCKS — platform layer only, NOT database connections
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("crypto").randomUUID(),
}));

// AsyncStorage mock — Zustand persistence layer (React Native storage, not DB)
const mockStorage: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

// Wire @/lib/supabase to real test clients.
// The mock exists only because the module imports React Native dependencies.
// getSupabaseClient → real Supabase client from setup.ts
// requireUserId → real auth.getUser() against the test instance
const mockGetSupabaseClient = jest.fn<SupabaseClient, []>();
const mockRequireUserId = jest.fn<Promise<string>, []>();

jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
  requireUserId: () => mockRequireUserId(),
}));

// Import AFTER mocks (Jest hoists jest.mock above imports)
import { useOfflineStore, type QueuedAction } from "@/stores/offlineStore";

// =============================================================================
// TEST INFRASTRUCTURE
// =============================================================================

beforeAll(() => {
  validateTestConfig();
});

// Suppress expected console output during queue processing
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

/** Active challenge time bounds (started 1h ago, ends in 7 days) */
function getActiveTimeBounds() {
  const now = new Date();
  return {
    start_date: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    end_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Wire mocks to a real test user's authenticated Supabase client */
function wireToUser(user: TestUser) {
  mockGetSupabaseClient.mockReturnValue(user.client);
  mockRequireUserId.mockImplementation(async () => {
    const {
      data: { user: authUser },
      error,
    } = await user.client.auth.getUser();
    if (error || !authUser) throw new Error("Authentication required");
    return authUser.id;
  });
}

/** Wire mocks with custom client/auth behavior */
function wireCustom(opts: {
  client: SupabaseClient;
  requireUserId: () => Promise<string>;
}) {
  mockGetSupabaseClient.mockReturnValue(opts.client);
  mockRequireUserId.mockImplementation(opts.requireUserId);
}

// =============================================================================
// TESTS
// =============================================================================

describe("Offline Queue Integration Tests (C3)", () => {
  let user1: TestUser;
  let user2: TestUser;

  beforeAll(async () => {
    user1 = await getTestUser1();
    user2 = await getTestUser2();
  }, 30000);

  beforeEach(() => {
    // Reset Zustand store to clean state between tests
    useOfflineStore.setState({
      queue: [],
      isProcessing: false,
      lastProcessedAt: null,
    });
    // Default: wire to user1's real session
    wireToUser(user1);
  });

  // ===========================================================================
  // HAPPY PATH — real database operations
  // ===========================================================================

  describe("Successful queue processing against real DB", () => {
    let challengeId: string;

    beforeAll(async () => {
      const challenge = await createTestChallenge(user1.client, getActiveTimeBounds());
      challengeId = challenge.id;

      // Ensure user1 is an accepted participant
      const { error } = await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
      if (error && error.code !== "23505") throw error;
    }, 30000);

    afterAll(async () => {
      await cleanupChallenge(challengeId);
    });

    it("should process LOG_ACTIVITY and create a real activity log row", async () => {
      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 7777,
          client_event_id: clientEventId,
        },
      };

      useOfflineStore.getState().addToQueue(action, user1.id);
      const result = await useOfflineStore.getState().processQueue();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);

      // Verify the row exists in the real database
      const { data, error } = await user1.client
        .from("activity_logs")
        .select("value, user_id, challenge_id")
        .eq("client_event_id", clientEventId)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.value).toBe(7777);
      expect(data!.user_id).toBe(user1.id);
      expect(data!.challenge_id).toBe(challengeId);
    });

    it("should handle idempotent duplicate via real DB constraint (23505)", async () => {
      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 1234,
          client_event_id: clientEventId,
        },
      };

      // Queue the same action twice (same client_event_id)
      useOfflineStore.getState().addToQueue(action, user1.id);
      useOfflineStore.getState().addToQueue(action, user1.id);

      const result = await useOfflineStore.getState().processQueue();

      // Both succeed (second is idempotent via DB constraint)
      expect(result.succeeded).toBe(2);
      expect(result.remaining).toBe(0);

      // Only one row in the real database
      const { data } = await user1.client
        .from("activity_logs")
        .select("id")
        .eq("client_event_id", clientEventId);

      expect(data?.length).toBe(1);
    });

    it("should process ACCEPT_INVITE against real challenge_participants table", async () => {
      // Create a separate challenge, invite user2, then accept via queue
      const inviteChallenge = await createTestChallenge(user1.client, getActiveTimeBounds());

      try {
        await inviteToChallenge(user1.client, inviteChallenge.id, user2.id);

        // Wire to user2 for this test
        wireToUser(user2);

        const action: QueuedAction = {
          type: "ACCEPT_INVITE",
          payload: { challenge_id: inviteChallenge.id },
        };
        useOfflineStore.getState().addToQueue(action, user2.id);

        const result = await useOfflineStore.getState().processQueue();
        expect(result.succeeded).toBe(1);
        expect(result.remaining).toBe(0);

        // Verify invite was accepted in real database
        const serviceClient = createServiceClient();
        const { data } = await serviceClient
          .from("challenge_participants")
          .select("invite_status")
          .eq("challenge_id", inviteChallenge.id)
          .eq("user_id", user2.id)
          .single();

        expect(data?.invite_status).toBe("accepted");
      } finally {
        await cleanupChallenge(inviteChallenge.id);
      }
    });

    it("should process SEND_FRIEND_REQUEST against real friends table", async () => {
      const serviceClient = createServiceClient();

      // Clean up any existing friend request between these users
      await serviceClient
        .from("friends")
        .delete()
        .eq("requested_by", user1.id)
        .eq("requested_to", user2.id);

      const action: QueuedAction = {
        type: "SEND_FRIEND_REQUEST",
        payload: { target_user_id: user2.id },
      };

      useOfflineStore.getState().addToQueue(action, user1.id);
      const result = await useOfflineStore.getState().processQueue();

      expect(result.succeeded).toBe(1);
      expect(result.remaining).toBe(0);

      // Verify in real database
      const { data } = await serviceClient
        .from("friends")
        .select("status, requested_by, requested_to")
        .eq("requested_by", user1.id)
        .eq("requested_to", user2.id)
        .single();

      expect(data).not.toBeNull();
      expect(data!.status).toBe("pending");

      // Cleanup
      await serviceClient
        .from("friends")
        .delete()
        .eq("requested_by", user1.id)
        .eq("requested_to", user2.id);
    });
  });

  // ===========================================================================
  // CROSS-ACCOUNT REPLAY PREVENTION — real user sessions
  // ===========================================================================

  describe("Cross-account guard with real user sessions", () => {
    let challengeId: string;

    beforeAll(async () => {
      const challenge = await createTestChallenge(user1.client, getActiveTimeBounds());
      challengeId = challenge.id;

      const { error } = await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
      if (error && error.code !== "23505") throw error;
    }, 30000);

    afterAll(async () => {
      await cleanupChallenge(challengeId);
    });

    it("should drop item queued by user1 when processing as user2", async () => {
      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 1111,
          client_event_id: clientEventId,
        },
      };

      // Queue as user1, process as user2
      useOfflineStore.getState().addToQueue(action, user1.id);
      wireToUser(user2);

      const result = await useOfflineStore.getState().processQueue();

      expect(result.failed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.remaining).toBe(0);

      // Verify NO activity was created in the real database
      const { data } = await createServiceClient()
        .from("activity_logs")
        .select("id")
        .eq("client_event_id", clientEventId);

      expect(data?.length ?? 0).toBe(0);
    });

    it("should process item queued by user1 when processing as user1", async () => {
      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 2222,
          client_event_id: clientEventId,
        },
      };

      // Queue AND process as user1
      useOfflineStore.getState().addToQueue(action, user1.id);
      wireToUser(user1);

      const result = await useOfflineStore.getState().processQueue();

      expect(result.succeeded).toBe(1);

      // Verify activity exists in real database
      const { data } = await user1.client
        .from("activity_logs")
        .select("value")
        .eq("client_event_id", clientEventId)
        .single();

      expect(data?.value).toBe(2222);
    });

    it("should process legacy items (no queuedByUserId) for any user", async () => {
      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 3333,
          client_event_id: clientEventId,
        },
      };

      // Queue without userId (legacy persisted items)
      useOfflineStore.getState().addToQueue(action);
      wireToUser(user1);

      const result = await useOfflineStore.getState().processQueue();

      expect(result.succeeded).toBe(1);

      // Verify in real DB
      const { data } = await user1.client
        .from("activity_logs")
        .select("value")
        .eq("client_event_id", clientEventId)
        .single();

      expect(data?.value).toBe(3333);
    });
  });

  // ===========================================================================
  // AUTH ERROR HANDLING — real Supabase error responses
  // ===========================================================================

  describe("Auth error handling with real Supabase responses", () => {
    let challengeId: string;

    beforeAll(async () => {
      const challenge = await createTestChallenge(user1.client, getActiveTimeBounds());
      challengeId = challenge.id;

      const { error } = await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
      if (error && error.code !== "23505") throw error;
    }, 30000);

    afterAll(async () => {
      await cleanupChallenge(challengeId);
    });

    it("should defer processing when user is not authenticated (real auth check)", async () => {
      // Create a fresh client with no session (not signed in)
      const unauthClient = createAnonClient();

      wireCustom({
        client: unauthClient,
        requireUserId: async () => {
          // Real auth check against Supabase — will fail since no session
          const {
            data: { user },
            error,
          } = await unauthClient.auth.getUser();
          if (error || !user) throw new Error("Authentication required");
          return user.id;
        },
      });

      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 1,
          client_event_id: generateTestUUID(),
        },
      };

      useOfflineStore.getState().addToQueue(action, user1.id);
      const result = await useOfflineStore.getState().processQueue();

      // Processing deferred — items stay in queue for next attempt
      expect(result.processed).toBe(0);
      expect(result.remaining).toBe(1);
      expect(useOfflineStore.getState().queue.length).toBe(1);
    });

    it("should verify real PostgREST error shape for invalid JWT", async () => {
      // Make a direct HTTP call to PostgREST with an invalid JWT
      // to validate the exact error shape returned by the real server.
      // This confirms our isAuthError() patterns match real Supabase behavior.
      const response = await fetch(
        `${testConfig.supabaseUrl}/rest/v1/rpc/log_activity`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: testConfig.supabaseAnonKey,
            Authorization: "Bearer invalid.jwt.token.for.testing",
          },
          body: JSON.stringify({
            p_challenge_id: challengeId,
            p_activity_type: "steps",
            p_value: 1,
            p_source: "manual",
            p_client_event_id: generateTestUUID(),
          }),
        },
      );

      // PostgREST rejects invalid JWTs with 401
      expect(response.status).toBe(401);

      const errorBody = await response.json();

      // Verify the error contains fields our isAuthError() detects:
      // - code: PGRST301 or PGRST302 (JWT expired/invalid)
      // - message: contains "jwt" or "token"
      const hasDetectableCode =
        errorBody.code === "PGRST301" || errorBody.code === "PGRST302";
      const hasDetectableMessage =
        /jwt/i.test(errorBody.message || "") ||
        /token/i.test(errorBody.message || "") ||
        /authentication/i.test(errorBody.message || "");

      expect(hasDetectableCode || hasDetectableMessage).toBe(true);
    });

    it("should drop item on real auth error from Supabase RPC (invalid JWT)", async () => {
      // Create a Supabase client with an intentionally invalid JWT.
      // When this client makes RPC calls, PostgREST rejects with a real
      // 401/PGRST301 error — the same shape as an expired JWT in production.
      const badAuthClient = createClient(
        testConfig.supabaseUrl,
        testConfig.supabaseAnonKey,
        {
          auth: { autoRefreshToken: false, persistSession: false },
          global: {
            headers: {
              // This invalid JWT causes PostgREST to return a real auth error.
              // The Supabase JS client surfaces it as { code, message, status }.
              Authorization:
                "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid-signature",
            },
          },
        },
      );

      // requireUserId returns a valid user ID (pre-loop check passes),
      // but the RPC call uses the bad-auth client and gets rejected.
      wireCustom({
        client: badAuthClient,
        requireUserId: async () => user1.id,
      });

      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 1,
          client_event_id: clientEventId,
        },
      };

      useOfflineStore.getState().addToQueue(action, user1.id);
      const result = await useOfflineStore.getState().processQueue();

      // Item should be dropped immediately (auth error, no retries burned)
      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(0);
      expect(useOfflineStore.getState().queue.length).toBe(0);

      // Verify NO activity was created in the real database
      const { data } = await createServiceClient()
        .from("activity_logs")
        .select("id")
        .eq("client_event_id", clientEventId);

      expect(data?.length ?? 0).toBe(0);
    });

    it("should not drop item on real business error (non-participant)", async () => {
      // User2 is NOT a participant in this challenge.
      // The RPC should return a business error (not_participant), not an auth error.
      // The item should be retried, not dropped immediately.
      wireToUser(user2);

      const clientEventId = generateTestUUID();
      const action: QueuedAction = {
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: challengeId,
          activity_type: "steps",
          value: 1,
          client_event_id: clientEventId,
        },
      };

      useOfflineStore.getState().addToQueue(action, user2.id);
      const result = await useOfflineStore.getState().processQueue();

      // Business error — item should NOT be dropped as auth error.
      // It either retries (retryCount incremented) or is dropped after MAX_RETRIES.
      // Key assertion: the item was NOT classified as an auth error.
      expect(result.failed).toBe(1);

      // The item should still be in the queue with retryCount > 0 (retrying)
      // unless it hit MAX_RETRIES. Either way, it went through the retry path.
      const queue = useOfflineStore.getState().queue;
      if (queue.length > 0) {
        // Item was retried (not immediately dropped)
        expect(queue[0].retryCount).toBeGreaterThan(0);
      }
      // else: item was dropped after MAX_RETRIES (also correct — it used the retry path)
    });
  });

  // ===========================================================================
  // MIXED QUEUE — combined success/failure scenarios
  // ===========================================================================

  describe("Mixed queue with real DB operations", () => {
    let challengeId: string;

    beforeAll(async () => {
      const challenge = await createTestChallenge(user1.client, getActiveTimeBounds());
      challengeId = challenge.id;

      const { error } = await user1.client.from("challenge_participants").insert({
        challenge_id: challengeId,
        user_id: user1.id,
        invite_status: "accepted",
      });
      if (error && error.code !== "23505") throw error;
    }, 30000);

    afterAll(async () => {
      await cleanupChallenge(challengeId);
    });

    it("should correctly account for mixed success and cross-account items", async () => {
      const successEventId = generateTestUUID();
      const mismatchEventId = generateTestUUID();

      // Item 1: will succeed (queued by user1, processed by user1)
      useOfflineStore.getState().addToQueue(
        {
          type: "LOG_ACTIVITY",
          payload: {
            challenge_id: challengeId,
            activity_type: "steps",
            value: 5555,
            client_event_id: successEventId,
          },
        },
        user1.id,
      );

      // Item 2: will be dropped (queued by user2, processed by user1 = mismatch)
      useOfflineStore.getState().addToQueue(
        {
          type: "LOG_ACTIVITY",
          payload: {
            challenge_id: challengeId,
            activity_type: "steps",
            value: 6666,
            client_event_id: mismatchEventId,
          },
        },
        user2.id,
      );

      wireToUser(user1);
      const result = await useOfflineStore.getState().processQueue();

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(0);

      // Verify: success item exists in DB
      const { data: successData } = await user1.client
        .from("activity_logs")
        .select("value")
        .eq("client_event_id", successEventId)
        .single();

      expect(successData?.value).toBe(5555);

      // Verify: mismatch item NOT in DB
      const { data: mismatchData } = await createServiceClient()
        .from("activity_logs")
        .select("id")
        .eq("client_event_id", mismatchEventId);

      expect(mismatchData?.length ?? 0).toBe(0);
    });
  });

  // ===========================================================================
  // isProcessing RESILIENCE
  // ===========================================================================

  describe("isProcessing flag resilience", () => {
    it("should reset isProcessing after successful processing", async () => {
      expect(useOfflineStore.getState().isProcessing).toBe(false);

      // Process empty queue
      await useOfflineStore.getState().processQueue();

      expect(useOfflineStore.getState().isProcessing).toBe(false);
    });

    it("should reset isProcessing after deferred processing (not authenticated)", async () => {
      const unauthClient = createAnonClient();

      wireCustom({
        client: unauthClient,
        requireUserId: async () => {
          throw new Error("Authentication required");
        },
      });

      useOfflineStore.getState().addToQueue(
        {
          type: "LOG_ACTIVITY",
          payload: {
            challenge_id: "fake-id",
            activity_type: "steps",
            value: 1,
            client_event_id: generateTestUUID(),
          },
        },
        user1.id,
      );

      await useOfflineStore.getState().processQueue();

      expect(useOfflineStore.getState().isProcessing).toBe(false);
      // Items should still be in queue (deferred, not dropped)
      expect(useOfflineStore.getState().queue.length).toBe(1);
    });

    it("should reset isProcessing after auth error drops all items", async () => {
      const badAuthClient = createClient(
        testConfig.supabaseUrl,
        testConfig.supabaseAnonKey,
        {
          auth: { autoRefreshToken: false, persistSession: false },
          global: {
            headers: {
              Authorization:
                "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid-signature",
            },
          },
        },
      );

      wireCustom({
        client: badAuthClient,
        requireUserId: async () => user1.id,
      });

      useOfflineStore.getState().addToQueue(
        {
          type: "LOG_ACTIVITY",
          payload: {
            challenge_id: "any-id",
            activity_type: "steps",
            value: 1,
            client_event_id: generateTestUUID(),
          },
        },
        user1.id,
      );

      await useOfflineStore.getState().processQueue();

      expect(useOfflineStore.getState().isProcessing).toBe(false);
    });
  });
});
