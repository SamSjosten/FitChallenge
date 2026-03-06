# C1: Security Store Not Reset on Sign-Out

**Bug ID:** C1
**Severity:** CRITICAL
**Status:** Proposed Fix
**Date:** 2026-03-06
**Cross-ref:** Bug Review Plan — `eager-puzzling-frog.md`

---

## 1. Problem Statement

When a user signs out, the `securityStore` (Zustand + AsyncStorage persistence) is never reset. The store persists `biometricsEnabled` and `biometricTimeout` to AsyncStorage under the key `fitchallenge-security`. When a different user signs in on the same device, they inherit the previous user's biometric configuration.

### Impact

- **Cross-account data leak:** User B sees User A's biometric preferences (enabled/disabled, timeout duration).
- **Security violation:** If User A had biometrics disabled and User B expects biometrics, the app is unprotected.
- **Confusing UX:** New user sees biometric settings they never configured.

### Affected Devices

Any device where multiple accounts are used (shared family devices, QA testing, demo scenarios).

---

## 2. Root Cause Analysis

### Sign-out flow (current):

```
AuthProvider.signOut()
  1. pushTokenService.disableCurrentToken()   // ✅ Clears push token
  2. authService.signOut()                     // ✅ Clears Supabase session
     └─ clearPersistedQueryCache()            // ✅ Clears React Query cache
  3. Listener fires SIGNED_OUT event           // ✅ Clears auth state
     └─ setState({ session: null, ... })      // ✅ Clears React state
```

**What's missing:** No call to `useSecurityStore.getState().reset()` anywhere in this chain.

### Persistence mechanism:

```typescript
// src/stores/securityStore.ts lines 133-141
persist(
  (set, get) => ({ ... }),
  {
    name: "fitchallenge-security",       // AsyncStorage key
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({
      biometricsEnabled: state.biometricsEnabled,  // ← Persisted across sign-out
      biometricTimeout: state.biometricTimeout,     // ← Persisted across sign-out
    }),
  },
)
```

Because `partialize` saves `biometricsEnabled` and `biometricTimeout`, and nothing clears this on sign-out, the values survive across account switches.

### The `reset()` method exists but is never called:

```typescript
// src/stores/securityStore.ts lines 124-131
reset: () => {
  set({
    biometricsEnabled: false,
    biometricTimeout: DEFAULT_TIMEOUT,
    lastAuthenticatedAt: null,
    isLocked: false,
  });
},
```

This method correctly resets all fields including the persisted ones. It simply needs to be called during sign-out.

---

## 3. Proposed Fix

### 3a. Code change — `src/providers/AuthProvider.tsx`

**Location:** `signOut` callback, line 499-511.

**Before:**

```typescript
const signOut = useCallback(async () => {
  console.log(`[AuthProvider] signOut() called`);
  try {
    // Disable push token before signing out (needs auth context)
    await pushTokenService.disableCurrentToken();
    await authService.signOut();
    console.log(`[AuthProvider] signOut() complete`);
    // Listener handles SIGNED_OUT -> clears state
  } catch (err) {
    setState((prev) => ({ ...prev, error: err as Error }));
    throw err;
  }
}, []);
```

**After:**

```typescript
const signOut = useCallback(async () => {
  console.log(`[AuthProvider] signOut() called`);
  try {
    // Disable push token before signing out (needs auth context)
    await pushTokenService.disableCurrentToken();

    // Reset security store BEFORE signing out.
    // This clears persisted biometric preferences so the next
    // account on this device starts with a clean security state.
    useSecurityStore.getState().reset();

    await authService.signOut();
    console.log(`[AuthProvider] signOut() complete`);
    // Listener handles SIGNED_OUT -> clears state
  } catch (err) {
    setState((prev) => ({ ...prev, error: err as Error }));
    throw err;
  }
}, []);
```

**New import required at top of file:**

```typescript
import { useSecurityStore } from "@/stores/securityStore";
```

### 3b. Placement rationale

The reset is placed **after** `disableCurrentToken()` but **before** `authService.signOut()` because:

1. `disableCurrentToken()` needs auth context (session must still be valid).
2. `useSecurityStore.reset()` is synchronous Zustand state — doesn't need auth.
3. If `authService.signOut()` throws, biometric state was already cleared. This is the safe default: better to lose biometric preferences than to leak them to another user.

---

## 4. Why This Fix Is Correct

| Concern | Analysis |
|---------|----------|
| **Does reset() clear persisted state?** | Yes. `set()` updates the Zustand store, which triggers the `persist` middleware to write the new (default) values to AsyncStorage under `fitchallenge-security`. |
| **Does it affect runtime state?** | Yes. `isLocked` and `lastAuthenticatedAt` are also reset to defaults (`false` and `null`). |
| **Is it idempotent?** | Yes. Calling `reset()` multiple times is harmless. |
| **Can it throw?** | No. `set()` is synchronous and cannot throw. |
| **Does it need auth context?** | No. It's a local-only state reset. |
| **Thread safety?** | Zustand state updates are synchronous and atomic within the JS thread. |

---

## 5. Test Plan

### 5a. New unit test — `src/stores/__tests__/securityStore.test.ts`

This is a new file. The security store has no existing tests. Tests are non-mocked direct Zustand store tests (the store has no external dependencies at the unit level — AsyncStorage is only used via the persist middleware which we can test by verifying store state).

```typescript
// src/stores/__tests__/securityStore.test.ts
// Unit tests for security store (biometric authentication state)

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
      useSecurityStore.getState().setBiometricTimeout(
        BIOMETRIC_TIMEOUT_OPTIONS.FIVE_MINUTES,
      );
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
      // Simulate User A's configured state
      const store = useSecurityStore.getState();
      store.enableBiometrics();
      store.setBiometricTimeout(BIOMETRIC_TIMEOUT_OPTIONS.THIRTY_MINUTES);
      store.recordAuthentication();

      // Verify User A's state is applied
      const stateBeforeReset = useSecurityStore.getState();
      expect(stateBeforeReset.biometricsEnabled).toBe(true);
      expect(stateBeforeReset.biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.THIRTY_MINUTES,
      );
      expect(stateBeforeReset.lastAuthenticatedAt).not.toBeNull();
      expect(stateBeforeReset.isLocked).toBe(false);

      // Sign-out: reset
      useSecurityStore.getState().reset();

      // Verify clean state for User B
      const stateAfterReset = useSecurityStore.getState();
      expect(stateAfterReset.biometricsEnabled).toBe(false);
      expect(stateAfterReset.biometricTimeout).toBe(
        BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES,
      );
      expect(stateAfterReset.lastAuthenticatedAt).toBeNull();
      expect(stateAfterReset.isLocked).toBe(false);
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
```

### 5b. Manual verification steps

1. **Sign in as User A** → Settings → Enable biometrics → Set timeout to 5 minutes
2. **Sign out**
3. **Sign in as User B** (different account)
4. **Verify:** Settings → Biometrics should be OFF, timeout should be "15 minutes" (default)
5. **Verify:** No biometric prompt on app foreground (since biometrics are disabled for User B)

---

## 6. Files Changed

| File | Change | Lines |
|------|--------|-------|
| `src/providers/AuthProvider.tsx` | Add import + `useSecurityStore.getState().reset()` in `signOut()` | +3 lines |
| `src/stores/__tests__/securityStore.test.ts` | **New file** — comprehensive unit tests for security store | ~230 lines |

---

## 7. Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Reset called before signOut throws | **None** — `reset()` is synchronous, cannot fail |
| Reset called when store doesn't exist | **None** — Zustand stores are module-scoped singletons |
| Breaking existing behavior | **None** — `reset()` is already implemented and tested by its own method signature. Only the call site is new. |
| Performance impact | **None** — single synchronous `set()` call |

---

## 8. Architectural Notes

- The fix follows the existing pattern: `pushTokenService.disableCurrentToken()` is already called in `signOut()` for the same "clean up before sign-out" purpose.
- `useSecurityStore.getState()` is the standard Zustand pattern for calling store actions outside of React components. This is identical to how the offline store docs recommend accessing store actions imperatively.
- The SIGNED_OUT listener in `AuthProvider` already clears React state (session, profile, etc.), but it has no awareness of the security store. The `signOut()` callback is the correct place to coordinate cross-store cleanup.
