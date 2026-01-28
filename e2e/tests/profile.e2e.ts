// e2e/tests/profile.e2e.ts
// ============================================
// Profile & Settings E2E Tests
// ============================================
// Tests for user profile, settings, and account management.

import { device, element, by, expect } from "detox";
import {
  TEST_USERS,
  DEFAULT_TIMEOUT,
  EXTENDED_TIMEOUT,
  waitForElement,
  waitForText,
  tapElement,
  tapText,
  clearAndTypeText,
  scrollDown,
  assertVisible,
  assertTextVisible,
  assertNotVisible,
} from "../utils";
import {
  signInAsPrimaryUser,
  ensureSignedInState,
  signOut,
} from "../utils/authHelpers";

describe("Profile & Settings", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await ensureSignedInState();
  });

  describe("Profile Screen", () => {
    it("should display profile tab", async () => {
      await tapElement("tab-profile");
      await assertVisible("profile-screen");
    });

    it("should display user information", async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");

      await assertVisible("profile-avatar");
      await assertVisible("profile-username");
      await assertVisible("profile-display-name");
    });

    it("should display user stats", async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");

      await assertVisible("profile-stats-section");
      await assertVisible("stat-challenges-completed");
      await assertVisible("stat-total-xp");
      await assertVisible("stat-current-streak");
    });

    it("should display achievements section", async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");

      await scrollDown("profile-scroll-view");
      await assertVisible("achievements-section");
    });

    it("should navigate to settings", async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");

      await tapElement("settings-button");
      await assertVisible("settings-screen");
    });
  });

  describe("Edit Profile", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await waitForElement("profile-screen");
      await tapElement("edit-profile-button");
      await waitForElement("edit-profile-screen");
    });

    it("should display edit profile form", async () => {
      await assertVisible("display-name-input");
      await assertVisible("username-input");
      await assertVisible("save-profile-button");
    });

    it("should update display name", async () => {
      const newDisplayName = `Test User ${Date.now()}`;

      await clearAndTypeText("display-name-input", newDisplayName);
      await tapElement("save-profile-button");

      // Should return to profile and show updated name
      await waitForElement("profile-screen");
      await assertTextVisible(newDisplayName);
    });

    it("should show validation error for invalid username", async () => {
      // Try to set an invalid username (too short)
      await clearAndTypeText("username-input", "ab");
      await tapElement("save-profile-button");

      await assertVisible("username-input-error");
    });

    it("should show error for taken username", async () => {
      // Try to use another user's username
      await clearAndTypeText("username-input", TEST_USERS.secondary.username);
      await tapElement("save-profile-button");

      await assertVisible("username-taken-error");
    });

    it("should cancel profile changes", async () => {
      await clearAndTypeText("display-name-input", "Will Cancel");
      await tapElement("cancel-edit-button");

      // Should return to profile without changes
      await assertVisible("profile-screen");
      await assertNotVisible("Will Cancel");
    });

    it("should update avatar", async () => {
      await tapElement("change-avatar-button");

      // Should show image picker options
      await waitForElement("image-picker-modal");

      // Cancel for now (actual image selection requires more setup)
      await tapElement("cancel-image-picker");
    });
  });

  describe("Settings Screen", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await tapElement("settings-button");
      await waitForElement("settings-screen");
    });

    it("should display settings sections", async () => {
      await assertVisible("account-settings-section");
      await assertVisible("app-settings-section");
      await assertVisible("privacy-settings-section");
    });

    it("should navigate to notification settings", async () => {
      await tapElement("notification-settings-button");
      await assertVisible("notification-settings-screen");
    });

    it("should navigate to privacy settings", async () => {
      await tapElement("privacy-settings-button");
      await assertVisible("privacy-settings-screen");
    });

    it("should navigate to health settings", async () => {
      await tapElement("health-settings-button");
      await assertVisible("health-settings-screen");
    });

    it("should display app version", async () => {
      await scrollDown("settings-scroll-view");
      await assertVisible("app-version-text");
    });

    it("should navigate to about screen", async () => {
      await scrollDown("settings-scroll-view");
      await tapElement("about-button");
      await assertVisible("about-screen");
    });
  });

  describe("Notification Settings", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await tapElement("settings-button");
      await tapElement("notification-settings-button");
      await waitForElement("notification-settings-screen");
    });

    it("should display notification toggles", async () => {
      await assertVisible("toggle-push-notifications");
      await assertVisible("toggle-challenge-updates");
      await assertVisible("toggle-friend-requests");
      await assertVisible("toggle-activity-reminders");
    });

    it("should toggle push notifications", async () => {
      await tapElement("toggle-push-notifications");
      // Visual state should change
      // Note: Actual permission request requires device interaction
    });

    it("should toggle challenge updates", async () => {
      await tapElement("toggle-challenge-updates");
    });

    it("should toggle friend request notifications", async () => {
      await tapElement("toggle-friend-requests");
    });
  });

  describe("Privacy Settings", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await tapElement("settings-button");
      await tapElement("privacy-settings-button");
      await waitForElement("privacy-settings-screen");
    });

    it("should display privacy options", async () => {
      await assertVisible("privacy-profile-visibility");
      await assertVisible("privacy-activity-sharing");
    });

    it("should navigate to data export", async () => {
      await scrollDown("privacy-settings-scroll");
      await tapElement("export-data-button");
      await assertVisible("export-data-screen");
    });

    it("should navigate to delete account", async () => {
      await scrollDown("privacy-settings-scroll");
      await tapElement("delete-account-button");
      await assertVisible("delete-account-screen");
    });
  });

  describe("Data Export (GDPR)", () => {
    beforeEach(async () => {
      await tapElement("tab-profile");
      await tapElement("settings-button");
      await tapElement("privacy-settings-button");
      await scrollDown("privacy-settings-scroll");
      await tapElement("export-data-button");
      await waitForElement("export-data-screen");
    });

    it("should display export options", async () => {
      await assertVisible("export-all-data-button");
      await assertTextVisible("Download your data");
    });

    it("should initiate data export", async () => {
      await tapElement("export-all-data-button");

      // Should show progress or confirmation
      await waitForElement("export-progress", DEFAULT_TIMEOUT).catch(() =>
        waitForElement("export-complete", EXTENDED_TIMEOUT),
      );
    });
  });

  describe("Delete Account", () => {
    // Note: These tests should be careful not to actually delete the test account
    beforeEach(async () => {
      await tapElement("tab-profile");
      await tapElement("settings-button");
      await tapElement("privacy-settings-button");
      await scrollDown("privacy-settings-scroll");
      await tapElement("delete-account-button");
      await waitForElement("delete-account-screen");
    });

    it("should display delete account warning", async () => {
      await assertTextVisible("Delete Account");
      await assertTextVisible("This action cannot be undone");
    });

    it("should require confirmation to delete", async () => {
      await tapElement("confirm-delete-button");

      // Should show confirmation dialog
      await waitForElement("delete-confirmation-dialog");
      await assertVisible("delete-confirm-input");
    });

    it("should cancel delete account", async () => {
      await tapElement("cancel-delete-button");
      await assertVisible("privacy-settings-screen");
    });

    it("should not delete with incorrect confirmation", async () => {
      await tapElement("confirm-delete-button");
      await waitForElement("delete-confirmation-dialog");

      // Type incorrect confirmation
      await clearAndTypeText("delete-confirm-input", "wrong text");
      await tapElement("final-delete-button");

      // Should show error
      await assertVisible("delete-confirm-error");
    });
  });

  describe("Sign Out", () => {
    it("should sign out from profile screen", async () => {
      await tapElement("tab-profile");
      await tapElement("settings-button");
      await waitForElement("settings-screen");

      await scrollDown("settings-scroll-view");
      await tapElement("sign-out-button");

      // Confirm sign out
      try {
        await waitForElement("sign-out-confirmation", 2000);
        await tapText("Sign Out");
      } catch {
        // No confirmation needed
      }

      // Should navigate to auth screen
      await waitForElement("login-screen", EXTENDED_TIMEOUT);
    });
  });
});
