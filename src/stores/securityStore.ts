// src/stores/securityStore.ts
// Zustand store for security settings (biometric authentication)

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Timeout options in milliseconds
export const BIOMETRIC_TIMEOUT_OPTIONS = {
  IMMEDIATELY: 0,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
} as const;

// Default timeout: 15 minutes
const DEFAULT_TIMEOUT = BIOMETRIC_TIMEOUT_OPTIONS.FIFTEEN_MINUTES;

interface SecurityState {
  // Settings
  biometricsEnabled: boolean;
  biometricTimeout: number; // milliseconds

  // Runtime state
  lastAuthenticatedAt: number | null;
  isLocked: boolean;

  // Actions
  enableBiometrics: () => void;
  disableBiometrics: () => void;
  setBiometricTimeout: (timeout: number) => void;
  recordAuthentication: () => void;
  checkIfLocked: () => boolean;
  lock: () => void;
  unlock: () => void;
  reset: () => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      // Initial state
      biometricsEnabled: false,
      biometricTimeout: DEFAULT_TIMEOUT,
      lastAuthenticatedAt: null,
      isLocked: false,

      // Enable biometrics
      enableBiometrics: () => {
        set({
          biometricsEnabled: true,
          lastAuthenticatedAt: Date.now(),
          isLocked: false,
        });
      },

      // Disable biometrics
      disableBiometrics: () => {
        set({
          biometricsEnabled: false,
          lastAuthenticatedAt: null,
          isLocked: false,
        });
      },

      // Set timeout duration
      setBiometricTimeout: (timeout: number) => {
        set({ biometricTimeout: timeout });
      },

      // Record successful authentication
      recordAuthentication: () => {
        set({
          lastAuthenticatedAt: Date.now(),
          isLocked: false,
        });
      },

      // Check if app should be locked based on timeout
      checkIfLocked: () => {
        const state = get();

        // If biometrics not enabled, never locked
        if (!state.biometricsEnabled) {
          return false;
        }

        // If never authenticated, should be locked
        if (state.lastAuthenticatedAt === null) {
          return true;
        }

        // If timeout is 0 (immediately), always locked when checking
        if (state.biometricTimeout === 0) {
          return true;
        }

        // Check if timeout has elapsed
        const elapsed = Date.now() - state.lastAuthenticatedAt;
        const isTimedOut = elapsed > state.biometricTimeout;

        if (isTimedOut) {
          set({ isLocked: true });
        }

        return isTimedOut;
      },

      // Manually lock
      lock: () => {
        set({ isLocked: true });
      },

      // Manually unlock (after successful biometric auth)
      unlock: () => {
        set({
          isLocked: false,
          lastAuthenticatedAt: Date.now(),
        });
      },

      // Reset all security settings (e.g., on sign out)
      reset: () => {
        set({
          biometricsEnabled: false,
          biometricTimeout: DEFAULT_TIMEOUT,
          lastAuthenticatedAt: null,
          isLocked: false,
        });
      },
    }),
    {
      name: "fitchallenge-security",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist settings, not runtime state
      partialize: (state) => ({
        biometricsEnabled: state.biometricsEnabled,
        biometricTimeout: state.biometricTimeout,
      }),
    },
  ),
);

/**
 * Format timeout for display
 */
export function formatTimeout(ms: number): string {
  if (ms === 0) return "Immediately";
  if (ms < 60 * 1000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))} minutes`;
  return `${Math.round(ms / (60 * 60 * 1000))} hours`;
}
