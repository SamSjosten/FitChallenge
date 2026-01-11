// src/lib/__tests__/serverTime.test.ts

// Mock supabase before importing serverTime
jest.mock("../supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import {
  getServerNow,
  getOffsetMs,
  resetSyncState,
  setOffsetMs,
  needsResync,
  syncServerTime,
} from "../serverTime";
import { supabase } from "../supabase";

const mockRpc = supabase.rpc as jest.Mock;

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
});
