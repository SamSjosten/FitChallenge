// src/stores/__tests__/securityStore.test.ts
// Unit tests for security store (biometric authentication state)
//
// Validates C1 fix: reset() must clear all persisted state on sign-out
// to prevent cross-account biometric preference leakage.

import {
  useSecurityStore,
  BIOMETRIC_TIMEOUT_OPTIONS,
  formatTimeout,
} from "../securityStore";

// Mock AsyncStorage (required by persist middleware)
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

describe("Security Store", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSecurityStore.setState({
      biometricsEnabled: false,
      biometricTimeout: BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
      lastAuthenticatedAt: null,
      isLocked: false,
    });
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  // ===========================================================================
  // CORE BUG FIX: C1 — reset() clears all state on sign-out
  // ===========================================================================

  describe("reset (C1 fix validation)", () => {
    it("clears biometricsEnabled back to false", () => {
      useSecurityStore.getState().enableBiometrics();
      expect(useSecurityStore.getState().biometricsEnabled).toBe(true);

      useSecurityStore.getState().reset();
      expect(useSecurityStore.getState().biometricsEnabled).toBe(false);
    });

    it("resets biometricTimeout to default (15 minutes)", () => {
      useSecurityStore
        .getState()
        .setBiometricTimeout(BIOMETRIC_TIMEOUT_OPTIONS.FIVE_MINUTES);
      expect(useSecurityStore.getState().biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.FIVE_MINUTES,
      );

      useSecurityStore.getState().reset();
      expect(useSecurityStore.getState().biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
      );
    });

    it("clears lastAuthenticatedAt", () => {
      useSecurityStore.getState().recordAuthentication();
      expect(useSecurityStore.getState().lastAuthenticatedAt).not.toBeNull();

      useSecurityStore.getState().reset();
      expect(useSecurityStore.getState().lastAuthenticatedAt).toBeNull();
    });

    it("clears isLocked", () => {
      useSecurityStore.getState().lock();
      expect(useSecurityStore.getState().isLocked).toBe(true);

      useSecurityStore.getState().reset();
      expect(useSecurityStore.getState().isLocked).toBe(false);
    });

    it("resets ALL fields in a single call (cross-account isolation)", () => {
      // Simulate User A's fully configured state
      const store = useSecurityStore.getState();
      store.enableBiometrics();
      store.setBiometricTimeout(BIOMETRIC_TIMEOUT_OPTIONS.THIRTY_MINUTES);
      store.recordAuthentication();

      // Verify User A's state is applied
      const before = useSecurityStore.getState();
      expect(before.biometricsEnabled).toBe(true);
      expect(before.biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.THIRTY_MINUTES,
      );
      expect(before.lastAuthenticatedAt).not.toBeNull();
      expect(before.isLocked).toBe(false);

      // Sign-out: reset
      useSecurityStore.getState().reset();

      // Verify clean state for User B
      const after = useSecurityStore.getState();
      expect(after.biometricsEnabled).toBe(false);
      expect(after.biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
      );
      expect(after.lastAuthenticatedAt).toBeNull();
      expect(after.isLocked).toBe(false);
    });

    it("is idempotent — calling reset twice has no adverse effect", () => {
      useSecurityStore.getState().enableBiometrics();
      useSecurityStore.getState().reset();
      useSecurityStore.getState().reset();

      const state = useSecurityStore.getState();
      expect(state.biometricsEnabled).toBe(false);
      expect(state.biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
      );
    });
  });

  // ===========================================================================
  // Enable / Disable biometrics
  // ===========================================================================

  describe("enableBiometrics", () => {
    it("sets biometricsEnabled to true", () => {
      useSecurityStore.getState().enableBiometrics();
      expect(useSecurityStore.getState().biometricsEnabled).toBe(true);
    });

    it("records authentication timestamp", () => {
      const before = Date.now();
      useSecurityStore.getState().enableBiometrics();
      const after = Date.now();

      const ts = useSecurityStore.getState().lastAuthenticatedAt!;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("sets isLocked to false", () => {
      useSecurityStore.setState({ isLocked: true });
      useSecurityStore.getState().enableBiometrics();
      expect(useSecurityStore.getState().isLocked).toBe(false);
    });
  });

  describe("disableBiometrics", () => {
    it("sets biometricsEnabled to false", () => {
      useSecurityStore.getState().enableBiometrics();
      useSecurityStore.getState().disableBiometrics();
      expect(useSecurityStore.getState().biometricsEnabled).toBe(false);
    });

    it("clears lastAuthenticatedAt", () => {
      useSecurityStore.getState().enableBiometrics();
      useSecurityStore.getState().disableBiometrics();
      expect(useSecurityStore.getState().lastAuthenticatedAt).toBeNull();
    });

    it("sets isLocked to false", () => {
      useSecurityStore.setState({ isLocked: true });
      useSecurityStore.getState().disableBiometrics();
      expect(useSecurityStore.getState().isLocked).toBe(false);
    });
  });

  // ===========================================================================
  // Timeout configuration
  // ===========================================================================

  describe("setBiometricTimeout", () => {
    it("updates timeout value", () => {
      useSecurityStore
        .getState()
        .setBiometricTimeout(BIOMETRIC_TIMEOUT_OPTIONS.FIVE_MINUTES);
      expect(useSecurityStore.getState().biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.FIVE_MINUTES,
      );
    });

    it("accepts IMMEDIATELY (0ms) timeout", () => {
      useSecurityStore
        .getState()
        .setBiometricTimeout(BIOMETRIC_TIMEOUT_OPTIONS.IMMEDIATELY);
      expect(useSecurityStore.getState().biometricTimeout).toBe(0);
    });
  });

  // ===========================================================================
  // Lock / Unlock
  // ===========================================================================

  describe("lock", () => {
    it("sets isLocked to true", () => {
      useSecurityStore.getState().lock();
      expect(useSecurityStore.getState().isLocked).toBe(true);
    });
  });

  describe("unlock", () => {
    it("sets isLocked to false", () => {
      useSecurityStore.getState().lock();
      useSecurityStore.getState().unlock();
      expect(useSecurityStore.getState().isLocked).toBe(false);
    });

    it("records authentication timestamp", () => {
      const before = Date.now();
      useSecurityStore.getState().unlock();
      const after = Date.now();

      const ts = useSecurityStore.getState().lastAuthenticatedAt!;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  // ===========================================================================
  // checkIfLocked — timeout-based lock evaluation
  // ===========================================================================

  describe("checkIfLocked", () => {
    it("returns false when biometrics are disabled", () => {
      expect(useSecurityStore.getState().checkIfLocked()).toBe(false);
    });

    it("returns true when biometrics enabled but never authenticated", () => {
      useSecurityStore.setState({ biometricsEnabled: true });
      expect(useSecurityStore.getState().checkIfLocked()).toBe(true);
    });

    it("returns true when timeout is IMMEDIATELY (0ms)", () => {
      useSecurityStore.setState({
        biometricsEnabled: true,
        biometricTimeout: BIOMETRIC_TIMEOUT_OPTIONS.IMMEDIATELY,
        lastAuthenticatedAt: Date.now(),
      });
      expect(useSecurityStore.getState().checkIfLocked()).toBe(true);
    });

    it("returns false when within timeout window", () => {
      useSecurityStore.setState({
        biometricsEnabled: true,
        biometricTimeout: BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
        lastAuthenticatedAt: Date.now(),
      });
      expect(useSecurityStore.getState().checkIfLocked()).toBe(false);
    });

    it("returns true when timeout has elapsed", () => {
      const fifteenMinutesAgo =
        Date.now() - BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES - 1;
      useSecurityStore.setState({
        biometricsEnabled: true,
        biometricTimeout: BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
        lastAuthenticatedAt: fifteenMinutesAgo,
      });
      expect(useSecurityStore.getState().checkIfLocked()).toBe(true);
    });
  });

  // ===========================================================================
  // formatTimeout utility
  // ===========================================================================

  describe("formatTimeout", () => {
    it('formats 0 as "Immediately"', () => {
      expect(formatTimeout(0)).toBe("Immediately");
    });

    it("formats seconds correctly", () => {
      expect(formatTimeout(30 * 1000)).toBe("30 seconds");
    });

    it("formats minutes correctly", () => {
      expect(formatTimeout(5 * 60 * 1000)).toBe("5 minutes");
      expect(formatTimeout(15 * 60 * 1000)).toBe("15 minutes");
    });

    it("formats hours correctly", () => {
      expect(formatTimeout(60 * 60 * 1000)).toBe("1 hours");
    });
  });
});
