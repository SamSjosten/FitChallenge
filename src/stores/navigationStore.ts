// src/stores/navigationStore.ts
// Navigation coordination store for auth flow
//
// This store prevents race conditions between:
// - useProtectedRoute (auto-redirects based on session)
// - Auth screen (handles post-login flow like biometric modal)
//
// Lock lifecycle:
// 1. Auth screen SETS lock before sign-in
// 2. useProtectedRoute CHECKS lock and defers if set
// 3. Tabs layout CLEARS lock when it mounts
// 4. FALLBACK: Lock auto-clears after MAX_LOCK_DURATION_MS or on app foreground

import { create } from "zustand";
import { AppState, AppStateStatus } from "react-native";

// Maximum time a lock can be held (prevents stuck states)
const MAX_LOCK_DURATION_MS = 30_000; // 30 seconds

// Logging prefix for easy filtering
const LOG = "🔐 [NavLock]";

interface NavigationState {
  // Whether auth screen is handling navigation (sign-in flow in progress)
  authHandlingNavigation: boolean;
  // Timestamp when lock was set (for stale detection)
  lockSetAt: number | null;
  // Set the navigation lock
  setAuthHandlingNavigation: (value: boolean) => void;
  // Check if lock is currently valid (set and not stale)
  isNavigationLocked: () => boolean;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  authHandlingNavigation: false,
  lockSetAt: null,

  setAuthHandlingNavigation: (value: boolean) => {
    const currentState = get();
    if (value) {
      if (currentState.authHandlingNavigation) {
        const age = currentState.lockSetAt
          ? Date.now() - currentState.lockSetAt
          : 0;
        console.log(
          `${LOG} Lock already held (${age}ms), ignoring duplicate SET`,
        );
        return;
      }
      console.log(`${LOG} 🟢 LOCK ACQUIRED`);
      set({ authHandlingNavigation: true, lockSetAt: Date.now() });
    } else {
      if (!currentState.authHandlingNavigation) {
        console.log(`${LOG} Lock not held, ignoring CLEAR`);
        return;
      }
      const heldFor = currentState.lockSetAt
        ? `${Date.now() - currentState.lockSetAt}ms`
        : "unknown";
      console.log(`${LOG} 🔴 LOCK RELEASED (held for ${heldFor})`);
      set({ authHandlingNavigation: false, lockSetAt: null });
    }
  },

  isNavigationLocked: () => {
    const { authHandlingNavigation, lockSetAt } = get();
    if (!authHandlingNavigation) {
      return false;
    }

    // Check if lock is stale
    if (lockSetAt) {
      const lockAge = Date.now() - lockSetAt;
      if (lockAge > MAX_LOCK_DURATION_MS) {
        console.warn(`${LOG} ⚠️ STALE LOCK (age: ${lockAge}ms), auto-clearing`);
        set({ authHandlingNavigation: false, lockSetAt: null });
        return false;
      }
    }

    return true;
  },
}));

// AppState listener management
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null;

/**
 * Initialize app state listener for stale lock recovery.
 * Call this once in root layout.
 */
export function initNavigationStoreRecovery() {
  if (appStateSubscription) {
    console.log(`${LOG} Recovery listener already initialized`);
    return;
  }

  appStateSubscription = AppState.addEventListener(
    "change",
    (nextState: AppStateStatus) => {
      console.log(`${LOG} AppState → ${nextState}`);
      if (nextState === "active") {
        const store = useNavigationStore.getState();
        if (store.authHandlingNavigation) {
          console.log(`${LOG} Foregrounded with lock held, validating...`);
          const isValid = store.isNavigationLocked();
          console.log(`${LOG} Lock still valid: ${isValid}`);
        }
      }
    },
  );

  console.log(`${LOG} ✅ Recovery listener initialized`);
}

/**
 * Cleanup app state listener.
 */
export function cleanupNavigationStoreRecovery() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
    console.log(`${LOG} Recovery listener cleaned up`);
  }
}
