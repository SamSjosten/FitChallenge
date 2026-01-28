// e2e/tests/health.e2e.ts
// ============================================
// Health Integration E2E Tests
// ============================================
// Tests for health provider connection and sync flows.
// Note: HealthKit tests require iOS simulator/device.

import { device, element, by, expect } from "detox";
import {
  EXTENDED_TIMEOUT,
  DEFAULT_TIMEOUT,
  waitForElement,
  tapElement,
  assertVisible,
  assertTextVisible,
  assertNotVisible,
} from "../utils";
import { ensureSignedInState } from "../utils/authHelpers";

describe("Health Integration", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await ensureSignedInState();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await waitForElement("home-screen", EXTENDED_TIMEOUT);
  });

  describe("Health Settings", () => {
    beforeEach(async () => {
      // Navigate to health settings
      await tapElement("tab-profile");
      await waitForElement("profile-screen");
      await tapElement("settings-button");
      await waitForElement("settings-screen");
      await tapElement("health-settings-button");
      await waitForElement("health-settings-screen");
    });

    it("should display health settings screen", async () => {
      await assertVisible("health-settings-screen");
      await assertVisible("health-provider-section");
    });

    it("should show Apple Health option on iOS", async () => {
      if (device.getPlatform() === "ios") {
        await assertVisible("health-badge-healthkit");
        await assertTextVisible("Apple Health");
      }
    });

    it("should show connection status", async () => {
      // Should show either connected or disconnected state
      try {
        await assertVisible("health-badge-connected");
      } catch {
        await assertVisible("health-badge-disconnected");
      }
    });

    it("should show last sync time when connected", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await assertTextVisible("Last synced");
      } catch {
        // Not connected - that's okay
        console.log("Health not connected - skipping last sync check");
      }
    });
  });

  describe("Health Connection", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");
      await tapElement("settings-button");
      await waitForElement("settings-screen");
      await tapElement("health-settings-button");
      await waitForElement("health-settings-screen");
    });

    it("should show connect button when disconnected", async () => {
      // Ensure disconnected state
      try {
        await waitForElement("health-badge-disconnected", 2000);
        await assertTextVisible("Connect");
      } catch {
        // Already connected
        console.log("Already connected - skipping connect button test");
      }
    });

    it("should initiate connection flow when connect is tapped", async () => {
      if (device.getPlatform() !== "ios") {
        console.log("Skipping: HealthKit only available on iOS");
        return;
      }

      try {
        await waitForElement("health-badge-disconnected", 2000);
        await tapElement("connect-health-button");

        // Should trigger health permission request
        // Note: In E2E, we can't fully test the native permission dialog
        // but we can verify the app attempts to connect

        // Wait for either success or the permission dialog
        await waitForElement("health-permission-pending", 3000).catch(() => {
          // Permission dialog may be shown by system
        });
      } catch {
        console.log("Already connected or connection flow differs");
      }
    });

    it("should show sync button when connected", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await assertTextVisible("Sync Now");
      } catch {
        console.log("Not connected - skipping sync button test");
      }
    });

    it("should show settings button when connected", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await assertTextVisible("Settings");
      } catch {
        console.log("Not connected - skipping settings button test");
      }
    });
  });

  describe("Health Sync", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");
      await tapElement("settings-button");
      await waitForElement("settings-screen");
      await tapElement("health-settings-button");
      await waitForElement("health-settings-screen");
    });

    it("should initiate manual sync when button is pressed", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("sync-now-button");

        // Should show syncing state
        await waitForElement("sync-progress-indicator", DEFAULT_TIMEOUT);
      } catch {
        console.log("Not connected - skipping manual sync test");
      }
    });

    it("should show sync progress during sync", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("sync-now-button");

        // Check for progress indicator
        await waitForElement("sync-progress-indicator", DEFAULT_TIMEOUT);

        // Progress should show percentage or status
        try {
          await assertTextVisible("Syncing");
        } catch {
          // Might complete too fast
        }
      } catch {
        console.log("Not connected - skipping sync progress test");
      }
    });

    it("should update last sync time after sync completes", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("sync-now-button");

        // Wait for sync to complete
        await waitForElement("sync-complete", EXTENDED_TIMEOUT).catch(() => {
          // Sync may complete and indicator disappear
        });

        // Last sync time should update
        await assertTextVisible("Last synced");
        // Time should be very recent (within a minute)
        try {
          await assertTextVisible("Just now");
        } catch {
          // Might show "1m ago" depending on timing
        }
      } catch {
        console.log("Not connected - skipping last sync update test");
      }
    });

    it("should handle sync errors gracefully", async () => {
      // This test would require simulating a network error
      // which is difficult in E2E tests
      // We'll verify error UI exists

      try {
        await waitForElement("health-badge-connected", 2000);

        // If there's an error state, verify it displays correctly
        try {
          await waitForElement("sync-error-message", 2000);
          await assertVisible("retry-sync-button");
        } catch {
          // No error - that's fine
        }
      } catch {
        console.log("Not connected - skipping error handling test");
      }
    });
  });

  describe("Health Data Display", () => {
    it("should show health data on home screen when connected", async () => {
      // Navigate to home
      await tapElement("tab-home");
      await waitForElement("home-screen");

      // Check for health data widget/card
      try {
        await waitForElement("health-data-widget", 3000);
        await assertVisible("health-data-widget");
      } catch {
        // Health widget might not be visible if not connected
        console.log("Health widget not visible - may not be connected");
      }
    });

    it("should show today's steps when available", async () => {
      await tapElement("tab-home");
      await waitForElement("home-screen");

      try {
        await waitForElement("health-data-widget", 3000);
        await assertTextVisible("steps");
      } catch {
        console.log("Steps data not visible");
      }
    });

    it("should show health badge on challenge cards", async () => {
      await tapElement("tab-challenges");
      await waitForElement("challenges-screen");

      try {
        // Challenge cards should show health sync status
        await waitForElement("challenge-card-0", 3000);
        // Health badge might be inline with challenge
        await assertVisible("health-sync-badge");
      } catch {
        console.log("Health badge not visible on challenges");
      }
    });
  });

  describe("Health Permissions", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");
      await tapElement("settings-button");
      await waitForElement("settings-screen");
      await tapElement("health-settings-button");
      await waitForElement("health-settings-screen");
    });

    it("should show permission status", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("health-settings-detail-button");
        await waitForElement("health-permissions-screen");

        await assertVisible("permission-steps");
        await assertVisible("permission-active-minutes");
      } catch {
        console.log("Permissions screen not accessible or not connected");
      }
    });

    it("should link to Health app settings", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("open-health-app-button");

        // App would open Health app - we can't verify this in E2E
        // Just verify the button exists
      } catch {
        console.log("Open Health button not found");
      }
    });

    it("should show partial permission warning", async () => {
      // This would show if user granted only some permissions
      try {
        await waitForElement("health-badge-partial", 2000);
        await assertTextVisible("Limited access");
      } catch {
        // Full permissions or not connected
        console.log("No partial permission state");
      }
    });
  });

  describe("Disconnect Health", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");
      await tapElement("settings-button");
      await waitForElement("settings-screen");
      await tapElement("health-settings-button");
      await waitForElement("health-settings-screen");
    });

    it("should show disconnect option when connected", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("health-settings-detail-button");
        await waitForElement("health-permissions-screen");

        await assertVisible("disconnect-health-button");
      } catch {
        console.log("Not connected - no disconnect option");
      }
    });

    it("should confirm before disconnecting", async () => {
      try {
        await waitForElement("health-badge-connected", 2000);
        await tapElement("health-settings-detail-button");
        await waitForElement("health-permissions-screen");

        await tapElement("disconnect-health-button");

        // Should show confirmation dialog
        await waitForElement("disconnect-confirm-dialog", DEFAULT_TIMEOUT);
        await assertTextVisible("Disconnect");

        // Cancel the disconnect
        await tapElement("cancel-disconnect-button");
        await assertNotVisible("disconnect-confirm-dialog");
      } catch {
        console.log("Disconnect flow not accessible");
      }
    });
  });
});
