// src/lib/__tests__/realtimeThrottle.test.ts
// Unit tests for realtime throttle utility

import {
  createThrottledInvalidator,
  logRealtimeStatus,
  getRealtimeStatus,
  subscribeToRealtimeStatus,
  updateRealtimeStatus,
  resetRealtimeStatus,
  type RealtimeConnectionState,
} from "../realtimeThrottle";

// =============================================================================
// MOCKS
// =============================================================================

// Mock QueryClient
const mockInvalidateQueries = jest.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
} as unknown as import("@tanstack/react-query").QueryClient;

// =============================================================================
// TESTS
// =============================================================================

describe("createThrottledInvalidator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not invalidate immediately", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const queryKey = ["test", "key"];

    throttledInvalidate(queryKey);

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("should invalidate after delay", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const queryKey = ["test", "key"];

    throttledInvalidate(queryKey);

    jest.advanceTimersByTime(500);

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("should batch rapid calls into single invalidation", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const queryKey = ["test", "key"];

    // Simulate burst of 5 changes in rapid succession
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(100);
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(100);
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(100);
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(100);
    throttledInvalidate(queryKey);

    // Should not have invalidated yet
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    // Advance past delay from last call
    jest.advanceTimersByTime(500);

    // Should have invalidated exactly once
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("should handle different query keys independently", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const keyA = ["friends", "all"];
    const keyB = ["notifications", "all"];

    throttledInvalidate(keyA);
    throttledInvalidate(keyB);

    jest.advanceTimersByTime(500);

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: keyA });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: keyB });
  });

  it("should reset timer on each call (trailing edge debounce)", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const queryKey = ["test", "key"];

    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(400);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    // Another call resets the timer
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(400);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    // Now wait full delay from last call
    jest.advanceTimersByTime(100);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("should use default delay of 500ms", () => {
    const throttledInvalidate = createThrottledInvalidator(mockQueryClient);
    const queryKey = ["test"];

    throttledInvalidate(queryKey);

    jest.advanceTimersByTime(499);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("should respect custom delay", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      1000,
    );
    const queryKey = ["test"];

    throttledInvalidate(queryKey);

    jest.advanceTimersByTime(999);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("should handle complex query keys", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const queryKey = ["challenges", "leaderboard", "uuid-123-456"];

    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(500);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("should allow multiple independent bursts", () => {
    const throttledInvalidate = createThrottledInvalidator(
      mockQueryClient,
      500,
    );
    const queryKey = ["test"];

    // First burst
    throttledInvalidate(queryKey);
    throttledInvalidate(queryKey);
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(500);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);

    // Gap between bursts
    jest.advanceTimersByTime(1000);

    // Second burst
    throttledInvalidate(queryKey);
    throttledInvalidate(queryKey);
    jest.advanceTimersByTime(500);
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
  });
});

describe("logRealtimeStatus", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("should log SUBSCRIBED status", () => {
    logRealtimeStatus("test-channel", "SUBSCRIBED");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Realtime] test-channel connected"),
    );
  });

  it("should warn on CHANNEL_ERROR status", () => {
    const error = new Error("Connection failed");
    logRealtimeStatus("test-channel", "CHANNEL_ERROR", error);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Realtime] test-channel error"),
      "Connection failed",
    );
  });

  it("should warn on TIMED_OUT status", () => {
    logRealtimeStatus("test-channel", "TIMED_OUT");

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Realtime] test-channel timed out"),
    );
  });

  it("should log CLOSED status", () => {
    logRealtimeStatus("test-channel", "CLOSED");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Realtime] test-channel closed"),
    );
  });

  it("should handle CHANNEL_ERROR without error object", () => {
    logRealtimeStatus("test-channel", "CHANNEL_ERROR");

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Realtime] test-channel error"),
      "Unknown error",
    );
  });
});

// =============================================================================
// REALTIME STATUS STORE TESTS
// =============================================================================

describe("Realtime Status Store", () => {
  beforeEach(() => {
    // Reset to initial state before each test
    resetRealtimeStatus();
  });

  describe("getRealtimeStatus", () => {
    it("should return initial disconnected state", () => {
      const state = getRealtimeStatus();

      expect(state.status).toBe("DISCONNECTED");
      expect(state.channelName).toBe("");
      expect(state.lastError).toBeNull();
    });

    it("should return a copy of the state (immutable)", () => {
      const state1 = getRealtimeStatus();
      const state2 = getRealtimeStatus();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe("updateRealtimeStatus", () => {
    it("should update status and channel name", () => {
      updateRealtimeStatus("test-channel", "SUBSCRIBED");

      const state = getRealtimeStatus();
      expect(state.status).toBe("SUBSCRIBED");
      expect(state.channelName).toBe("test-channel");
      expect(state.lastError).toBeNull();
      expect(state.lastUpdatedAt).toBeInstanceOf(Date);
    });

    it("should store error when provided", () => {
      const error = new Error("Test error");
      updateRealtimeStatus("test-channel", "CHANNEL_ERROR", error);

      const state = getRealtimeStatus();
      expect(state.status).toBe("CHANNEL_ERROR");
      expect(state.lastError).toBe(error);
    });

    it("should clear error when not provided", () => {
      const error = new Error("Test error");
      updateRealtimeStatus("test-channel", "CHANNEL_ERROR", error);
      updateRealtimeStatus("test-channel", "SUBSCRIBED");

      const state = getRealtimeStatus();
      expect(state.lastError).toBeNull();
    });

    it("should support CONNECTING status", () => {
      updateRealtimeStatus("test-channel", "CONNECTING");

      const state = getRealtimeStatus();
      expect(state.status).toBe("CONNECTING");
    });
  });

  describe("subscribeToRealtimeStatus", () => {
    it("should call listener with initial state on subscribe", () => {
      const listener = jest.fn();

      subscribeToRealtimeStatus(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: "DISCONNECTED" }),
      );
    });

    it("should call listener on status updates", () => {
      const listener = jest.fn();
      subscribeToRealtimeStatus(listener);
      listener.mockClear();

      updateRealtimeStatus("test-channel", "SUBSCRIBED");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUBSCRIBED",
          channelName: "test-channel",
        }),
      );
    });

    it("should return unsubscribe function", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeToRealtimeStatus(listener);
      listener.mockClear();

      unsubscribe();
      updateRealtimeStatus("test-channel", "SUBSCRIBED");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle multiple listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      subscribeToRealtimeStatus(listener1);
      subscribeToRealtimeStatus(listener2);
      listener1.mockClear();
      listener2.mockClear();

      updateRealtimeStatus("test-channel", "SUBSCRIBED");

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("should handle listener errors gracefully", () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const badListener = jest.fn(() => {
        throw new Error("Listener error");
      });
      const goodListener = jest.fn();

      // Both subscribe calls should not throw despite badListener
      subscribeToRealtimeStatus(badListener);
      subscribeToRealtimeStatus(goodListener);

      // Both listeners were called on subscribe
      expect(badListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);

      // Warning was logged for bad listener
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Realtime] Status listener error:",
        expect.any(Error),
      );

      consoleWarnSpy.mockClear();
      badListener.mockClear();
      goodListener.mockClear();

      // On update, both listeners are called again
      updateRealtimeStatus("test-channel", "SUBSCRIBED");

      // Good listener should still work
      expect(goodListener).toHaveBeenCalled();
      // Warning logged again for bad listener
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Realtime] Status listener error:",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("resetRealtimeStatus", () => {
    it("should reset to disconnected state", () => {
      updateRealtimeStatus("test-channel", "SUBSCRIBED");
      resetRealtimeStatus();

      const state = getRealtimeStatus();
      expect(state.status).toBe("DISCONNECTED");
      expect(state.channelName).toBe("");
    });

    it("should notify listeners on reset", () => {
      const listener = jest.fn();
      subscribeToRealtimeStatus(listener);
      listener.mockClear();

      resetRealtimeStatus();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: "DISCONNECTED" }),
      );
    });
  });

  describe("logRealtimeStatus integration", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it("should update status store when logging", () => {
      logRealtimeStatus("test-channel", "SUBSCRIBED");

      const state = getRealtimeStatus();
      expect(state.status).toBe("SUBSCRIBED");
      expect(state.channelName).toBe("test-channel");
    });
  });
});
