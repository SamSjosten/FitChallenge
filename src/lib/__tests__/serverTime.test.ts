// src/lib/__tests__/serverTime.test.ts

// Mock supabase before importing serverTime
const mockRpc = jest.fn();
jest.mock("../supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: mockRpc,
  })),
}));

import {
  getServerNow,
  getOffsetMs,
  resetSyncState,
  setOffsetMs,
  needsResync,
  syncServerTime,
  getSyncStatus,
  subscribeToSyncStatus,
  RESYNC_INTERVAL_MS,
  type ServerTimeSyncStatus,
} from "../serverTime";
import { getSupabaseClient } from "../supabase";
import { getEffectiveStatus } from "../challengeStatus";

// Fixed timestamp for deterministic tests
const FIXED_NOW = 1_700_000_000_000;

describe("serverTime", () => {
  beforeEach(() => {
    resetSyncState();
    mockRpc.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // =============================================================================
  // getServerNow
  // =============================================================================
  describe("getServerNow", () => {
    test("returns device time when no sync has occurred", () => {
      expect(getServerNow().getTime()).toBe(FIXED_NOW);
    });

    test("applies positive offset (server ahead of device)", () => {
      const offsetMs = 60 * 1000; // Server is 1 minute ahead
      setOffsetMs(offsetMs);

      expect(getServerNow().getTime()).toBe(FIXED_NOW + offsetMs);
    });

    test("applies negative offset (server behind device)", () => {
      const offsetMs = -60 * 1000; // Server is 1 minute behind
      setOffsetMs(offsetMs);

      expect(getServerNow().getTime()).toBe(FIXED_NOW + offsetMs);
    });
  });

  // =============================================================================
  // getOffsetMs
  // =============================================================================
  describe("getOffsetMs", () => {
    test("returns null before sync", () => {
      expect(getOffsetMs()).toBeNull();
    });

    test("returns offset after setOffsetMs", () => {
      setOffsetMs(5000);
      expect(getOffsetMs()).toBe(5000);
    });
  });

  // =============================================================================
  // needsResync
  // =============================================================================
  describe("needsResync", () => {
    test("returns true before any sync", () => {
      expect(needsResync()).toBe(true);
    });

    test("returns false immediately after sync", () => {
      setOffsetMs(0); // This also sets lastSyncAt
      expect(needsResync()).toBe(false);
    });
  });

  // =============================================================================
  // resetSyncState
  // =============================================================================
  describe("resetSyncState", () => {
    test("clears cached offset", () => {
      setOffsetMs(5000);
      expect(getOffsetMs()).toBe(5000);

      resetSyncState();
      expect(getOffsetMs()).toBeNull();
    });

    test("makes needsResync return true", () => {
      setOffsetMs(0);
      expect(needsResync()).toBe(false);

      resetSyncState();
      expect(needsResync()).toBe(true);
    });
  });

  // =============================================================================
  // syncServerTime
  // =============================================================================
  describe("syncServerTime", () => {
    test("returns true and sets offset on successful sync", async () => {
      // Server time is exactly 10 seconds ahead of FIXED_NOW
      // Since we don't advance timers, before == after == FIXED_NOW
      // So midpoint == FIXED_NOW and offset == 10_000 exactly
      const serverTime = new Date(FIXED_NOW + 10_000).toISOString();
      mockRpc.mockResolvedValue({ data: serverTime, error: null });

      const result = await syncServerTime({ force: true });

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("get_server_time");
      expect(getOffsetMs()).toBe(10_000);
    });

    test("sets offset using midpoint of before/after device time", async () => {
      // Server returns time 2000ms ahead of FIXED_NOW
      const serverTime = new Date(FIXED_NOW + 2_000).toISOString();

      // Mock RPC to advance time by 100ms during the call
      mockRpc.mockImplementation(async () => {
        jest.advanceTimersByTime(100);
        return { data: serverTime, error: null };
      });

      const ok = await syncServerTime({ force: true });
      await Promise.resolve(); // Flush microtasks

      expect(ok).toBe(true);

      // before = FIXED_NOW, after = FIXED_NOW + 100
      // midpoint = FIXED_NOW + 50ms
      // offset = serverTime - midpoint = (FIXED_NOW + 2000) - (FIXED_NOW + 50) = 1950
      expect(getOffsetMs()).toBe(1_950);

      // getServerNow() = Date.now() + offset = (FIXED_NOW + 100) + 1950
      expect(getServerNow().getTime()).toBe(FIXED_NOW + 100 + 1_950);
    });

    test("returns false on RPC error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "Network error" },
      });

      const result = await syncServerTime({ force: true });

      expect(result).toBe(false);
      expect(getOffsetMs()).toBeNull();
    });

    test("returns false when data is null", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await syncServerTime({ force: true });

      expect(result).toBe(false);
    });

    test("skips sync if cache is fresh and force is false", async () => {
      // First sync to populate cache
      const serverTime = new Date(FIXED_NOW).toISOString();
      mockRpc.mockResolvedValue({ data: serverTime, error: null });
      await syncServerTime({ force: true });

      mockRpc.mockClear();

      // Second sync without force should skip
      const result = await syncServerTime();

      expect(result).toBe(true);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    test("force: true syncs even if cache is fresh", async () => {
      // First sync to populate cache
      const serverTime = new Date(FIXED_NOW).toISOString();
      mockRpc.mockResolvedValue({ data: serverTime, error: null });
      await syncServerTime({ force: true });

      mockRpc.mockClear();

      // Second sync with force should call RPC
      mockRpc.mockResolvedValue({ data: serverTime, error: null });
      const result = await syncServerTime({ force: true });

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("get_server_time");
    });

    // =========================================================================
    // Payload parsing
    // =========================================================================
    describe("payload parsing", () => {
      test("handles plain string response", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("handles array with string response", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({ data: [serverTime], error: null });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("handles array with object payload (PostgREST style)", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({
          data: [{ server_time: serverTime }],
          error: null,
        });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("handles array with get_server_time key (alternate PostgREST)", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({
          data: [{ get_server_time: serverTime }],
          error: null,
        });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("handles object with server_time key", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({
          data: { server_time: serverTime },
          error: null,
        });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("handles object with get_server_time key", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({
          data: { get_server_time: serverTime },
          error: null,
        });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("handles object with now key", async () => {
        const serverTime = new Date(FIXED_NOW + 1_000).toISOString();
        mockRpc.mockResolvedValue({ data: { now: serverTime }, error: null });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(true);
        expect(getOffsetMs()).toBe(1_000);
      });

      test("returns false for unexpected payload shape", async () => {
        mockRpc.mockResolvedValue({
          data: { unexpected: "format" },
          error: null,
        });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(false);
      });

      test("returns false for invalid timestamp string", async () => {
        mockRpc.mockResolvedValue({ data: "not-a-valid-date", error: null });

        const result = await syncServerTime({ force: true });

        expect(result).toBe(false);
      });
    });
  });

  // =============================================================================
  // Integration with challengeStatus
  // =============================================================================
  describe("integration with challenge status determination", () => {
    // Import getEffectiveStatus lazily to allow mocking
    const { getEffectiveStatus } = require("../challengeStatus");

    describe("device clock skew scenarios", () => {
      test("simulates device clock 2 hours behind server - challenge appears upcoming on device but active on server", () => {
        // Scenario: Device clock is 2 hours behind server
        // Server says 14:00, device says 12:00
        const serverAheadMs = 2 * 60 * 60 * 1000; // 2 hours
        setOffsetMs(serverAheadMs);

        // Challenge starts at 13:00 server time
        // Device time (FIXED_NOW) = 12:00
        // Server time = 14:00 (FIXED_NOW + offset)
        const challenge = {
          status: "pending",
          start_date: new Date(FIXED_NOW + 60 * 60 * 1000).toISOString(), // 13:00 server
          end_date: new Date(FIXED_NOW + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        // Using raw device time: 12:00 < 13:00 start → upcoming
        const deviceTime = new Date(FIXED_NOW);
        expect(getEffectiveStatus(challenge, deviceTime)).toBe("upcoming");

        // Using server-adjusted time: 14:00 > 13:00 start → active
        const serverTime = getServerNow();
        expect(getEffectiveStatus(challenge, serverTime)).toBe("active");
      });

      test("simulates device clock 2 hours ahead of server - challenge appears active on device but upcoming on server", () => {
        // Scenario: Device clock is 2 hours ahead of server
        // Server says 12:00, device says 14:00
        const serverBehindMs = -2 * 60 * 60 * 1000; // -2 hours
        setOffsetMs(serverBehindMs);

        // Challenge starts at 13:00 server time
        // Device time = 14:00 (would say active)
        // Server time = 12:00 (FIXED_NOW + offset, says upcoming)
        const challenge = {
          status: "pending",
          start_date: new Date(FIXED_NOW + 60 * 60 * 1000).toISOString(), // 13:00
          end_date: new Date(FIXED_NOW + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        // Device at 14:00 thinks it's active (14:00 > 13:00)
        const deviceAhead = new Date(FIXED_NOW + 2 * 60 * 60 * 1000);
        expect(getEffectiveStatus(challenge, deviceAhead)).toBe("active");

        // Server-adjusted time at 12:00 says upcoming (12:00 < 13:00)
        const serverTime = getServerNow();
        expect(getEffectiveStatus(challenge, serverTime)).toBe("upcoming");
      });

      test("challenge service query simulation with server time", () => {
        // Simulates what challengeService.getMyActiveChallenges does
        // It uses getServerNow().toISOString() for time comparisons

        const serverAheadMs = 30 * 60 * 1000; // Server 30 min ahead
        setOffsetMs(serverAheadMs);

        const now = getServerNow(); // Server-adjusted time

        // Challenge that just started (per server time)
        const challenge = {
          id: "test-1",
          start_date: new Date(FIXED_NOW + 15 * 60 * 1000).toISOString(), // 15 min after FIXED_NOW
          end_date: new Date(FIXED_NOW + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
        };

        // Filter logic from getMyActiveChallenges:
        // .lte("start_date", now) -> start_date <= now
        // .gt("end_date", now) -> end_date > now
        const startDate = new Date(challenge.start_date);
        const endDate = new Date(challenge.end_date);

        const isActive = startDate <= now && endDate > now;

        // With server time (30 min ahead of FIXED_NOW):
        // now = FIXED_NOW + 30min
        // start_date = FIXED_NOW + 15min
        // start_date (15min) <= now (30min) ✓
        // end_date (7 days) > now ✓
        // → Challenge IS active
        expect(isActive).toBe(true);

        // But with device time (FIXED_NOW), challenge wouldn't be active yet:
        const deviceNow = new Date(FIXED_NOW);
        const isActiveByDevice = startDate <= deviceNow && endDate > deviceNow;
        // start_date (15min) <= device (0min) ✗
        expect(isActiveByDevice).toBe(false);
      });
    });
  });

  // =============================================================================
  // Sync Status Tracking
  // =============================================================================
  describe("sync status tracking", () => {
    describe("getSyncStatus", () => {
      test("returns correct initial state (never synced)", () => {
        const status = getSyncStatus();

        expect(status.hasSynced).toBe(false);
        expect(status.lastSyncAt).toBeNull();
        expect(status.lastError).toBeNull();
        expect(status.isStale).toBe(true); // Never synced = stale
      });

      test("returns correct state after successful sync", async () => {
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });

        await syncServerTime({ force: true });
        const status = getSyncStatus();

        expect(status.hasSynced).toBe(true);
        expect(status.lastSyncAt).toBe(FIXED_NOW);
        expect(status.lastError).toBeNull();
        expect(status.isStale).toBe(false);
      });

      test("returns correct state after failed sync (never synced)", async () => {
        mockRpc.mockResolvedValue({
          data: null,
          error: { message: "Network error" },
        });

        await syncServerTime({ force: true });
        const status = getSyncStatus();

        expect(status.hasSynced).toBe(false);
        expect(status.lastSyncAt).toBeNull();
        expect(status.lastError).toBe("Network error");
        expect(status.isStale).toBe(true);
      });

      test("preserves hasSynced after subsequent failure", async () => {
        // First: successful sync
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        // Advance time past resync interval
        jest.advanceTimersByTime(RESYNC_INTERVAL_MS + 1000);

        // Second: failed sync
        mockRpc.mockResolvedValue({
          data: null,
          error: { message: "Connection lost" },
        });
        await syncServerTime({ force: true });

        const status = getSyncStatus();

        // hasSynced should still be true (we had a successful sync earlier)
        expect(status.hasSynced).toBe(true);
        expect(status.lastSyncAt).toBe(FIXED_NOW); // Original sync time
        expect(status.lastError).toBe("Connection lost");
        expect(status.isStale).toBe(true); // Stale because time has passed
      });

      test("clears lastError on successful sync after failure", async () => {
        // First: failed sync
        mockRpc.mockResolvedValue({
          data: null,
          error: { message: "Network error" },
        });
        await syncServerTime({ force: true });

        expect(getSyncStatus().lastError).toBe("Network error");

        // Second: successful sync
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        expect(getSyncStatus().lastError).toBeNull();
      });

      test("isStale becomes true after RESYNC_INTERVAL_MS", async () => {
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        expect(getSyncStatus().isStale).toBe(false);

        // Advance time just past the resync interval
        jest.advanceTimersByTime(RESYNC_INTERVAL_MS + 1);

        expect(getSyncStatus().isStale).toBe(true);
      });
    });

    describe("subscribeToSyncStatus", () => {
      test("notifies listener on successful sync", async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeToSyncStatus(listener);

        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            hasSynced: true,
            lastError: null,
          }),
        );

        unsubscribe();
      });

      test("notifies listener on failed sync", async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeToSyncStatus(listener);

        mockRpc.mockResolvedValue({
          data: null,
          error: { message: "Network error" },
        });
        await syncServerTime({ force: true });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            hasSynced: false,
            lastError: "Network error",
          }),
        );

        unsubscribe();
      });

      test("unsubscribe stops notifications", async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeToSyncStatus(listener);

        // First sync - should notify
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });
        expect(listener).toHaveBeenCalledTimes(1);

        // Unsubscribe
        unsubscribe();

        // Advance past resync interval
        jest.advanceTimersByTime(RESYNC_INTERVAL_MS + 1000);

        // Second sync - should NOT notify
        await syncServerTime({ force: true });
        expect(listener).toHaveBeenCalledTimes(1); // Still 1
      });

      test("multiple listeners all receive notifications", async () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        const unsubscribe1 = subscribeToSyncStatus(listener1);
        const unsubscribe2 = subscribeToSyncStatus(listener2);

        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);

        unsubscribe1();
        unsubscribe2();
      });

      test("listener errors do not affect other listeners", async () => {
        const badListener = jest.fn(() => {
          throw new Error("Listener error");
        });
        const goodListener = jest.fn();

        const unsubscribe1 = subscribeToSyncStatus(badListener);
        const unsubscribe2 = subscribeToSyncStatus(goodListener);

        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });

        // Should not throw, and good listener should still be called
        await syncServerTime({ force: true });

        expect(badListener).toHaveBeenCalledTimes(1);
        expect(goodListener).toHaveBeenCalledTimes(1);

        unsubscribe1();
        unsubscribe2();
      });
    });

    describe("resetSyncState", () => {
      test("clears all status state", async () => {
        // First: successful sync
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        // Add a listener to ensure it's cleared
        const listener = jest.fn();
        subscribeToSyncStatus(listener);

        // Reset
        resetSyncState();

        const status = getSyncStatus();
        expect(status.hasSynced).toBe(false);
        expect(status.lastSyncAt).toBeNull();
        expect(status.lastError).toBeNull();
        expect(status.isStale).toBe(true);
      });

      test("clears all listeners", async () => {
        const listener = jest.fn();
        subscribeToSyncStatus(listener);

        resetSyncState();

        // Sync should not notify cleared listeners
        const serverTime = new Date(FIXED_NOW).toISOString();
        mockRpc.mockResolvedValue({ data: serverTime, error: null });
        await syncServerTime({ force: true });

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("setOffsetMs", () => {
      test("sets hasSynced to true", () => {
        expect(getSyncStatus().hasSynced).toBe(false);

        setOffsetMs(1000);

        expect(getSyncStatus().hasSynced).toBe(true);
      });

      test("clears lastError", async () => {
        // First: create an error state
        mockRpc.mockResolvedValue({
          data: null,
          error: { message: "Error" },
        });
        await syncServerTime({ force: true });
        expect(getSyncStatus().lastError).toBe("Error");

        // setOffsetMs should clear the error
        setOffsetMs(1000);
        expect(getSyncStatus().lastError).toBeNull();
      });
    });
  });
});
