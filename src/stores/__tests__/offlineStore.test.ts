// src/stores/__tests__/offlineStore.test.ts
// Unit tests for offline write queue

// =============================================================================
// MOCKS (must be before imports)
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
const mockRpc = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn(() => ({
  update: jest.fn(() => ({
    eq: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
  insert: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
  requireUserId: jest.fn().mockResolvedValue("test-user-123"),
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
      expect(mockRpc).toHaveBeenCalledWith(
        "log_activity",
        expect.objectContaining({
          p_challenge_id: "c1",
          p_value: 100,
          p_client_event_id: "e1",
        }),
      );
    });

    it("handles duplicate key errors as success (idempotent)", async () => {
      mockRpc.mockResolvedValueOnce({
        error: { message: "duplicate key", code: "23505" },
      });

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

      // Duplicate is treated as success
      expect(result.succeeded).toBe(1);
      expect(result.remaining).toBe(0);
    });

    it("increments retry count on failure", async () => {
      mockRpc.mockRejectedValueOnce(new Error("Network error"));

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

      mockRpc.mockRejectedValueOnce(new Error("Network error"));

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
      expect(mockRpc).not.toHaveBeenCalled();
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
});
