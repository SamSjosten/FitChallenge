// src/stores/__tests__/navigationStore.test.ts
// Unit tests for navigation coordination store
//
// Validates H2 fix: isNavigationLocked() must be a pure read (no set() calls)
// to prevent state mutation during React's render phase.
// clearStaleLock() is the separated mutation action.
//
// Why unit tests (not integration):
// The navigation store is a pure client-side Zustand state machine with zero
// Supabase interaction, zero network calls, and no service layer dependencies.
// Integration testing against a live database is not feasible here.

import { useNavigationStore } from "../navigationStore";

// Mock react-native AppState (platform module — can't run in Node.js)
jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Lock duration constant (mirrors navigationStore.ts)
const MAX_LOCK_DURATION_MS = 30_000;

describe("Navigation Store", () => {
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset store to initial state
    useNavigationStore.setState({
      authHandlingNavigation: false,
      lockSetAt: null,
    });
    // Restore Date.now if spied
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
    }
  });

  afterAll(() => {
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
    }
  });

  // ===========================================================================
  // GROUP 1: setAuthHandlingNavigation — lock lifecycle
  // ===========================================================================

  describe("setAuthHandlingNavigation", () => {
    it("acquires lock — sets authHandlingNavigation and records lockSetAt", () => {
      const beforeTime = Date.now();
      useNavigationStore.getState().setAuthHandlingNavigation(true);
      const state = useNavigationStore.getState();

      expect(state.authHandlingNavigation).toBe(true);
      expect(state.lockSetAt).not.toBeNull();
      expect(state.lockSetAt!).toBeGreaterThanOrEqual(beforeTime);
      expect(state.lockSetAt!).toBeLessThanOrEqual(Date.now());
    });

    it("releases lock — resets both fields", () => {
      useNavigationStore.getState().setAuthHandlingNavigation(true);
      useNavigationStore.getState().setAuthHandlingNavigation(false);
      const state = useNavigationStore.getState();

      expect(state.authHandlingNavigation).toBe(false);
      expect(state.lockSetAt).toBeNull();
    });

    it("ignores duplicate SET when already locked (idempotent)", () => {
      useNavigationStore.getState().setAuthHandlingNavigation(true);
      const firstLockSetAt = useNavigationStore.getState().lockSetAt;

      // Second SET should be ignored — lockSetAt should not change
      useNavigationStore.getState().setAuthHandlingNavigation(true);
      const state = useNavigationStore.getState();

      expect(state.authHandlingNavigation).toBe(true);
      expect(state.lockSetAt).toBe(firstLockSetAt);
    });

    it("ignores duplicate CLEAR when not locked (no-op)", () => {
      // Should not throw or change state
      useNavigationStore.getState().setAuthHandlingNavigation(false);
      const state = useNavigationStore.getState();

      expect(state.authHandlingNavigation).toBe(false);
      expect(state.lockSetAt).toBeNull();
    });

    it("full lifecycle: acquire → release → state is clean", () => {
      useNavigationStore.getState().setAuthHandlingNavigation(true);
      expect(useNavigationStore.getState().authHandlingNavigation).toBe(true);

      useNavigationStore.getState().setAuthHandlingNavigation(false);
      const state = useNavigationStore.getState();

      expect(state.authHandlingNavigation).toBe(false);
      expect(state.lockSetAt).toBeNull();
    });
  });

  // ===========================================================================
  // GROUP 2: isNavigationLocked — pure read, no side effects (H2 fix)
  // ===========================================================================

  describe("isNavigationLocked (pure read)", () => {
    it("returns false when no lock is held (default state)", () => {
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(false);
    });

    it("returns true when lock is fresh (< MAX_LOCK_DURATION_MS)", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);

      // Advance time but stay within threshold
      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS - 1);
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(true);
    });

    it("returns false when lock is stale (> MAX_LOCK_DURATION_MS)", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);

      // Advance time past threshold
      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS + 1);
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(false);
    });

    it("does NOT mutate state for stale locks (core H2 fix)", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);
      const lockSetAt = useNavigationStore.getState().lockSetAt;

      // Advance time past threshold
      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS + 5000);

      // isNavigationLocked returns false but MUST NOT mutate state
      const result = useNavigationStore.getState().isNavigationLocked();
      expect(result).toBe(false);

      // State should still show lock as held (not cleared by the read)
      const state = useNavigationStore.getState();
      expect(state.authHandlingNavigation).toBe(true);
      expect(state.lockSetAt).toBe(lockSetAt);
    });

    it("returns true at exactly MAX_LOCK_DURATION_MS boundary (not stale)", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);

      // Exactly at boundary — should still be valid
      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS);
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(true);
    });
  });

  // ===========================================================================
  // GROUP 3: clearStaleLock — mutation action
  // ===========================================================================

  describe("clearStaleLock (mutation action)", () => {
    it("returns false and no-ops when no lock is held", () => {
      const result = useNavigationStore.getState().clearStaleLock();
      expect(result).toBe(false);

      const state = useNavigationStore.getState();
      expect(state.authHandlingNavigation).toBe(false);
      expect(state.lockSetAt).toBeNull();
    });

    it("returns false when lock is fresh (does not clear valid lock)", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);

      // Advance time but stay within threshold
      dateNowSpy.mockReturnValue(now + 5000);
      const result = useNavigationStore.getState().clearStaleLock();
      expect(result).toBe(false);

      // Lock should still be held
      const state = useNavigationStore.getState();
      expect(state.authHandlingNavigation).toBe(true);
      expect(state.lockSetAt).toBe(now);
    });

    it("returns true and clears stale lock", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);

      // Advance time past threshold
      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS + 1);
      const result = useNavigationStore.getState().clearStaleLock();
      expect(result).toBe(true);

      // State should be fully reset
      const state = useNavigationStore.getState();
      expect(state.authHandlingNavigation).toBe(false);
      expect(state.lockSetAt).toBeNull();
    });

    it("state is fully clean after clearing — isNavigationLocked returns false", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      useNavigationStore.getState().setAuthHandlingNavigation(true);

      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS + 1);
      useNavigationStore.getState().clearStaleLock();

      // Both the state fields and the derived check should agree
      expect(useNavigationStore.getState().authHandlingNavigation).toBe(false);
      expect(useNavigationStore.getState().lockSetAt).toBeNull();
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(false);
    });
  });

  // ===========================================================================
  // GROUP 4: CQS contract — the bug fix regression test
  // ===========================================================================

  describe("CQS contract (H2 regression test)", () => {
    it("stale lock: isNavigationLocked reads without mutation, clearStaleLock mutates", () => {
      const now = 1000000;
      dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);

      // 1. Acquire lock
      useNavigationStore.getState().setAuthHandlingNavigation(true);
      expect(useNavigationStore.getState().authHandlingNavigation).toBe(true);

      // 2. Advance time past stale threshold
      dateNowSpy.mockReturnValue(now + MAX_LOCK_DURATION_MS + 10000);

      // 3. QUERY: isNavigationLocked returns false but does NOT clear state
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(false);
      expect(useNavigationStore.getState().authHandlingNavigation).toBe(true); // still set!
      expect(useNavigationStore.getState().lockSetAt).toBe(now); // still set!

      // 4. COMMAND: clearStaleLock actually clears the state
      const cleared = useNavigationStore.getState().clearStaleLock();
      expect(cleared).toBe(true);
      expect(useNavigationStore.getState().authHandlingNavigation).toBe(false); // now cleared
      expect(useNavigationStore.getState().lockSetAt).toBeNull(); // now cleared

      // 5. Both query and command now agree: no lock
      expect(useNavigationStore.getState().isNavigationLocked()).toBe(false);
      expect(useNavigationStore.getState().clearStaleLock()).toBe(false);
    });
  });
});
