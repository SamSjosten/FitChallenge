// src/stores/__tests__/offlineStore.test.ts
// Unit tests for offline write queue

// =============================================================================
// MOCKS (must be before imports — jest.mock calls are hoisted)
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});

// Mock AsyncStorage
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

// Mock supabase
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ error: null }),
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        })),
      })),
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
  requireUserId: jest.fn().mockResolvedValue("test-user-123"),
}));

// Mock activity execution helpers (imported by offlineStore)
// These pull in useNetworkStatus → NetInfo which isn't available in Jest
const mockExecuteLogActivity = jest.fn().mockResolvedValue(undefined);
const mockExecuteLogWorkout = jest.fn().mockResolvedValue(0);
jest.mock("@/services/activities", () => ({
  executeLogActivity: mockExecuteLogActivity,
  executeLogWorkout: mockExecuteLogWorkout,
}));

// Mock challenge and friends services (imported by offlineStore)
jest.mock("@/services/challenges", () => ({
  challengeService: {
    respondToInvite: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/services/friends", () => ({
  friendsService: {
    sendFriendRequest: jest.fn().mockResolvedValue(undefined),
  },
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { useOfflineStore, offlineStoreSelectors } from "../offlineStore";

describe("Offline Store", () => {
  beforeEach(() => {
    // Reset store state
    useOfflineStore.setState({
      queue: [],
      isProcessing: false,
      lastProcessedAt: null,
    });
    jest.clearAllMocks();
    // Reset default mock behavior
    mockExecuteLogActivity.mockResolvedValue(undefined);
    mockExecuteLogWorkout.mockResolvedValue(0);
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  describe("addToQueue", () => {
    it("adds LOG_ACTIVITY action to queue", () => {
      const { addToQueue } = useOfflineStore.getState();

      const id = addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "challenge-1",
          activity_type: "steps",
          value: 5000,
          client_event_id: "event-123",
        },
      });

      const { queue } = useOfflineStore.getState();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(id);
      expect(queue[0].action.type).toBe("LOG_ACTIVITY");
      expect(queue[0].retryCount).toBe(0);
    });

    it("adds ACCEPT_INVITE action to queue", () => {
      const { addToQueue } = useOfflineStore.getState();

      addToQueue({
        type: "ACCEPT_INVITE",
        payload: { challenge_id: "challenge-2" },
      });

      const { queue } = useOfflineStore.getState();
      expect(queue).toHaveLength(1);
      expect(queue[0].action.type).toBe("ACCEPT_INVITE");
    });

    it("adds SEND_FRIEND_REQUEST action to queue", () => {
      const { addToQueue } = useOfflineStore.getState();

      addToQueue({
        type: "SEND_FRIEND_REQUEST",
        payload: { target_user_id: "user-456" },
      });

      const { queue } = useOfflineStore.getState();
      expect(queue).toHaveLength(1);
      expect(queue[0].action.type).toBe("SEND_FRIEND_REQUEST");
    });

    it("maintains FIFO order", () => {
      const { addToQueue } = useOfflineStore.getState();

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });
      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c2",
          activity_type: "steps",
          value: 200,
          client_event_id: "e2",
        },
      });

      const { queue } = useOfflineStore.getState();
      expect(queue[0].action.payload).toMatchObject({ challenge_id: "c1" });
      expect(queue[1].action.payload).toMatchObject({ challenge_id: "c2" });
    });
  });

  describe("removeFromQueue", () => {
    it("removes item by id", () => {
      const { addToQueue, removeFromQueue } = useOfflineStore.getState();

      const id = addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });

      expect(useOfflineStore.getState().queue).toHaveLength(1);

      removeFromQueue(id);

      expect(useOfflineStore.getState().queue).toHaveLength(0);
    });
  });

  describe("processQueue", () => {
    it("processes LOG_ACTIVITY action successfully", async () => {
      const { addToQueue, processQueue } = useOfflineStore.getState();

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });

      const result = await processQueue();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
      expect(mockExecuteLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: "c1",
          value: 100,
          client_event_id: "e1",
        }),
      );
    });

    it("handles duplicate key errors as success (idempotent)", async () => {
      // executeLogActivity handles duplicates internally and resolves normally
      mockExecuteLogActivity.mockResolvedValueOnce(undefined);

      const { addToQueue, processQueue } = useOfflineStore.getState();

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });

      const result = await processQueue();

      // Duplicate is treated as success (handled inside executeLogActivity)
      expect(result.succeeded).toBe(1);
      expect(result.remaining).toBe(0);
    });

    it("increments retry count on failure", async () => {
      mockExecuteLogActivity.mockRejectedValueOnce(new Error("Network error"));

      const { addToQueue, processQueue } = useOfflineStore.getState();

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });

      await processQueue();

      const { queue } = useOfflineStore.getState();
      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(1);
    });

    it("removes item after max retries (5)", async () => {
      // Set up an item with 4 retries already
      useOfflineStore.setState({
        queue: [
          {
            id: "test-id",
            action: {
              type: "LOG_ACTIVITY",
              payload: {
                challenge_id: "c1",
                activity_type: "steps",
                value: 100,
                client_event_id: "e1",
              },
            },
            createdAt: Date.now(),
            retryCount: 4, // Next failure will be the 5th attempt
          },
        ],
      });

      mockExecuteLogActivity.mockRejectedValueOnce(new Error("Network error"));

      const { processQueue } = useOfflineStore.getState();
      const result = await processQueue();

      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(0);
    });

    it("does not process if already processing", async () => {
      useOfflineStore.setState({ isProcessing: true });

      const { addToQueue, processQueue } = useOfflineStore.getState();

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });

      const result = await processQueue();

      expect(result.processed).toBe(0);
      expect(mockExecuteLogActivity).not.toHaveBeenCalled();
    });

    it("returns empty result for empty queue", async () => {
      const { processQueue } = useOfflineStore.getState();
      const result = await processQueue();

      expect(result).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        remaining: 0,
      });
    });
  });

  describe("clearQueue", () => {
    it("removes all items from queue", () => {
      const { addToQueue, clearQueue } = useOfflineStore.getState();

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });
      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c2",
          activity_type: "steps",
          value: 200,
          client_event_id: "e2",
        },
      });

      expect(useOfflineStore.getState().queue).toHaveLength(2);

      clearQueue();

      expect(useOfflineStore.getState().queue).toHaveLength(0);
    });
  });

  describe("selectors", () => {
    it("getQueueLength returns current queue length", () => {
      const { addToQueue } = useOfflineStore.getState();

      expect(offlineStoreSelectors.getQueueLength()).toBe(0);

      addToQueue({
        type: "LOG_ACTIVITY",
        payload: {
          challenge_id: "c1",
          activity_type: "steps",
          value: 100,
          client_event_id: "e1",
        },
      });

      expect(offlineStoreSelectors.getQueueLength()).toBe(1);
    });

    it("isProcessing returns processing state", () => {
      expect(offlineStoreSelectors.isProcessing()).toBe(false);

      useOfflineStore.setState({ isProcessing: true });

      expect(offlineStoreSelectors.isProcessing()).toBe(true);
    });
  });

  // ===========================================================================
  // C3: Auth error handling + cross-account guard
  // ===========================================================================

  describe("auth error handling (C3)", () => {
    const LOG_ACTIVITY_ACTION = {
      type: "LOG_ACTIVITY" as const,
      payload: {
        challenge_id: "c1",
        activity_type: "steps",
        value: 100,
        client_event_id: "e1",
      },
    };

    // Helper to get the mocked requireUserId
    const getMockRequireUserId = () => {
      const { requireUserId } = jest.requireMock("@/lib/supabase");
      return requireUserId as jest.Mock;
    };

    describe("auth error classification (via processQueue behavior)", () => {
      it("drops item immediately on 'Authentication required' from requireUserId", async () => {
        getMockRequireUserId().mockRejectedValue(
          new Error("Authentication required"),
        );

        useOfflineStore.setState({
          queue: [
            {
              id: "auth-item",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "test-user-123",
            },
          ],
        });

        // requireUserId fails in the pre-loop check → processing deferred
        const result = await useOfflineStore.getState().processQueue();

        expect(result.processed).toBe(0);
        expect(result.remaining).toBe(1);
        // Item stays in queue — not authenticated, defer entirely
        expect(useOfflineStore.getState().queue).toHaveLength(1);
      });

      it("drops item immediately on JWT expired error from executor", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce({
          status: 401,
          code: "PGRST301",
          message: "JWT expired",
        });

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        const result = await processQueue();

        expect(result.failed).toBe(1);
        expect(result.remaining).toBe(0);
        expect(useOfflineStore.getState().queue).toHaveLength(0);
      });

      it("drops item immediately on JWT invalid error (PGRST302)", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce({
          code: "PGRST302",
          message: "JWT invalid",
        });

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        const result = await processQueue();

        expect(result.failed).toBe(1);
        expect(result.remaining).toBe(0);
      });

      it("drops item immediately on HTTP 403 (permission denied)", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce({
          status: 403,
          message: "permission denied for table challenge_participants",
        });

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        const result = await processQueue();

        expect(result.failed).toBe(1);
        expect(result.remaining).toBe(0);
      });

      it("drops item on first auth failure regardless of retryCount", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce({
          status: 401,
          message: "JWT expired",
        });

        // Item already has 2 retries — should still be dropped immediately
        useOfflineStore.setState({
          queue: [
            {
              id: "retried-item",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 2,
              queuedByUserId: "test-user-123",
            },
          ],
        });

        const result = await useOfflineStore.getState().processQueue();

        expect(result.failed).toBe(1);
        expect(result.remaining).toBe(0);
        // Confirm item was removed — not retried further
        expect(useOfflineStore.getState().queue).toHaveLength(0);
      });

      it("retries network errors normally (not classified as auth)", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce(new Error("ETIMEDOUT"));

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        await processQueue();

        const { queue } = useOfflineStore.getState();
        expect(queue).toHaveLength(1);
        expect(queue[0].retryCount).toBe(1);
      });

      it("retries server 500 errors normally (not classified as auth)", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce({
          status: 500,
          message: "internal server error",
        });

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        await processQueue();

        const { queue } = useOfflineStore.getState();
        expect(queue).toHaveLength(1);
        expect(queue[0].retryCount).toBe(1);
      });
    });

    describe("cross-account guard", () => {
      it("drops item queued by different user", async () => {
        getMockRequireUserId().mockResolvedValue("user-B");

        useOfflineStore.setState({
          queue: [
            {
              id: "cross-account-item",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "user-A",
            },
          ],
        });

        const result = await useOfflineStore.getState().processQueue();

        expect(result.failed).toBe(1);
        expect(result.remaining).toBe(0);
        // Confirm no executor was called
        expect(mockExecuteLogActivity).not.toHaveBeenCalled();
      });

      it("processes item queued by same user", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        const result = await processQueue();

        expect(result.succeeded).toBe(1);
        expect(result.remaining).toBe(0);
        expect(mockExecuteLogActivity).toHaveBeenCalled();
      });

      it("skips cross-account check for legacy items (no queuedByUserId)", async () => {
        getMockRequireUserId().mockResolvedValue("any-user");

        useOfflineStore.setState({
          queue: [
            {
              id: "legacy-item",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 0,
              // No queuedByUserId — legacy persisted item
            },
          ],
        });

        const result = await useOfflineStore.getState().processQueue();

        expect(result.succeeded).toBe(1);
        expect(result.remaining).toBe(0);
        expect(mockExecuteLogActivity).toHaveBeenCalled();
      });

      it("stores queuedByUserId when provided to addToQueue", () => {
        const { addToQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "user-abc-123");

        const { queue } = useOfflineStore.getState();
        expect(queue[0].queuedByUserId).toBe("user-abc-123");
      });

      it("omits queuedByUserId when not provided", () => {
        const { addToQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION);

        const { queue } = useOfflineStore.getState();
        expect(queue[0].queuedByUserId).toBeUndefined();
      });
    });

    describe("mixed queue with auth + network + mismatch errors", () => {
      it("correctly accounts for mixed failure types in one run", async () => {
        getMockRequireUserId().mockResolvedValue("current-user");

        // Item 1: succeeds (same user, executor works)
        // Item 2: cross-account mismatch → dropped (no executor call)
        // Item 3: auth error from executor → dropped
        // Item 4: network error → retried
        // Executor call order: item 1 (success), item 3 (auth), item 4 (network)
        mockExecuteLogActivity
          .mockResolvedValueOnce(undefined) // item 1 succeeds
          .mockRejectedValueOnce({ status: 401, message: "JWT expired" }) // item 3 auth error
          .mockRejectedValueOnce(new Error("Network error")); // item 4 network error

        useOfflineStore.setState({
          queue: [
            {
              id: "item-1",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "current-user",
            },
            {
              id: "item-2",
              action: {
                type: "LOG_ACTIVITY",
                payload: {
                  challenge_id: "c-mismatch",
                  activity_type: "steps",
                  value: 50,
                  client_event_id: "e-mismatch",
                },
              },
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "other-user", // mismatch → skipped before executor
            },
            {
              id: "item-3",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "current-user",
            },
            {
              id: "item-4",
              action: {
                type: "LOG_ACTIVITY",
                payload: {
                  challenge_id: "c-network",
                  activity_type: "steps",
                  value: 75,
                  client_event_id: "e-network",
                },
              },
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "current-user",
            },
          ],
        });

        const result = await useOfflineStore.getState().processQueue();

        expect(result.succeeded).toBe(1); // item 1
        expect(result.failed).toBe(3); // items 2 (mismatch) + 3 (auth) + 4 (network)
        expect(result.processed).toBe(4);
        expect(result.remaining).toBe(1); // only item 4 stays for retry

        const { queue } = useOfflineStore.getState();
        expect(queue).toHaveLength(1);
        expect(queue[0].id).toBe("item-4");
        expect(queue[0].retryCount).toBe(1);
      });
    });

    describe("isProcessing hardening", () => {
      it("resets isProcessing even if not authenticated (deferred processing)", async () => {
        getMockRequireUserId().mockRejectedValue(
          new Error("Authentication required"),
        );

        useOfflineStore.setState({
          queue: [
            {
              id: "item-1",
              action: LOG_ACTIVITY_ACTION,
              createdAt: Date.now(),
              retryCount: 0,
              queuedByUserId: "test-user-123",
            },
          ],
        });

        await useOfflineStore.getState().processQueue();

        // isProcessing must be false after processing completes
        expect(useOfflineStore.getState().isProcessing).toBe(false);
      });

      it("resets isProcessing after normal processing", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        await processQueue();

        expect(useOfflineStore.getState().isProcessing).toBe(false);
      });

      it("resets isProcessing after auth error drop", async () => {
        getMockRequireUserId().mockResolvedValue("test-user-123");
        mockExecuteLogActivity.mockRejectedValueOnce({
          status: 401,
          message: "Unauthorized",
        });

        const { addToQueue, processQueue } = useOfflineStore.getState();
        addToQueue(LOG_ACTIVITY_ACTION, "test-user-123");

        await processQueue();

        expect(useOfflineStore.getState().isProcessing).toBe(false);
      });
    });
  });
});
