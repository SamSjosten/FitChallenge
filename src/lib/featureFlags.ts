// src/lib/featureFlags.ts
// Feature flag system for UI version control
//
// Enables:
// - Zero-risk development (new UI is isolated)
// - Instant rollback (flip flag to revert)
// - Side-by-side comparison during development
// - Event-based sync across all hook instances

import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// =============================================================================
// TYPES
// =============================================================================

export type UIVersion = "v1" | "v2";

export interface FeatureFlagState {
  uiVersion: UIVersion;
  lastUpdated: string | null;
}

type VersionChangeListener = (version: UIVersion) => void;

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEYS = {
  UI_VERSION: "fitchallenge_ui_version",
  LAST_UPDATED: "fitchallenge_ui_version_updated",
} as const;

// Default version - change to 'v2' when ready for full rollout
const DEFAULT_UI_VERSION: UIVersion = "v1";

// =============================================================================
// EVENT EMITTER FOR CROSS-HOOK SYNC
// =============================================================================

const listeners = new Set<VersionChangeListener>();

function notifyListeners(version: UIVersion) {
  listeners.forEach((listener) => {
    try {
      listener(version);
    } catch (error) {
      console.error("[FeatureFlags] Listener error:", error);
    }
  });
}

function subscribe(listener: VersionChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// =============================================================================
// FEATURE FLAGS API
// =============================================================================

export const featureFlags = {
  /**
   * Get the current UI version
   */
  async getUIVersion(): Promise<UIVersion> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.UI_VERSION);
      if (stored === "v1" || stored === "v2") {
        return stored;
      }
      return DEFAULT_UI_VERSION;
    } catch (error) {
      console.warn("[FeatureFlags] Failed to read UI version:", error);
      return DEFAULT_UI_VERSION;
    }
  },

  /**
   * Set the UI version and notify all listeners
   */
  async setUIVersion(version: UIVersion): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.UI_VERSION, version);
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_UPDATED,
        new Date().toISOString(),
      );
      console.log(`[FeatureFlags] UI version set to: ${version}`);
      // Notify all hook instances
      notifyListeners(version);
    } catch (error) {
      console.error("[FeatureFlags] Failed to save UI version:", error);
      throw error;
    }
  },

  /**
   * Get full feature flag state
   */
  async getState(): Promise<FeatureFlagState> {
    const [uiVersion, lastUpdated] = await Promise.all([
      this.getUIVersion(),
      AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED),
    ]);

    return {
      uiVersion,
      lastUpdated,
    };
  },

  /**
   * Toggle between v1 and v2
   */
  async toggleUIVersion(): Promise<UIVersion> {
    const current = await this.getUIVersion();
    const next: UIVersion = current === "v1" ? "v2" : "v1";
    await this.setUIVersion(next);
    return next;
  },

  /**
   * Reset to default version
   */
  async resetToDefault(): Promise<void> {
    await this.setUIVersion(DEFAULT_UI_VERSION);
  },

  /**
   * Get the default UI version
   */
  getDefaultVersion(): UIVersion {
    return DEFAULT_UI_VERSION;
  },

  /**
   * Subscribe to version changes (used internally by hook)
   */
  subscribe,
};

// =============================================================================
// REACT HOOK
// =============================================================================

export function useFeatureFlags() {
  const [uiVersion, setUIVersionState] = useState<UIVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial value
  useEffect(() => {
    featureFlags
      .getUIVersion()
      .then((version) => {
        setUIVersionState(version);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("[useFeatureFlags] Failed to load:", error);
        setUIVersionState(DEFAULT_UI_VERSION);
        setIsLoading(false);
      });
  }, []);

  // Subscribe to changes from other hook instances
  useEffect(() => {
    const unsubscribe = featureFlags.subscribe((newVersion) => {
      setUIVersionState(newVersion);
    });
    return unsubscribe;
  }, []);

  const toggleVersion = useCallback(async () => {
    const newVersion = await featureFlags.toggleUIVersion();
    // State will be updated via the subscription
    return newVersion;
  }, []);

  const setVersion = useCallback(async (version: UIVersion) => {
    await featureFlags.setUIVersion(version);
    // State will be updated via the subscription
  }, []);

  return {
    uiVersion,
    isLoading,
    isV2: uiVersion === "v2",
    toggleVersion,
    setVersion,
  };
}

export default featureFlags;
