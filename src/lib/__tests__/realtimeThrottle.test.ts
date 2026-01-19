// src/lib/__tests__/realtimeThrottle.test.ts
// Unit tests for realtime throttle utility

import {
  createThrottledInvalidator,
  logRealtimeStatus,
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
