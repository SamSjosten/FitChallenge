// e2e/settings.e2e.ts
// Settings Screen E2E Tests
//
// Settings is one of the best-instrumented screens.
// Tests navigation to settings, visibility of items, and sign-out flow.
//
// VERIFIED TESTIDS USED:
//   settings-screen, signout-button, health-data-button, developer-button
//   tab-profile, profile-screen-v2, settings-button, welcome-screen

import { by, device, element, expect, waitFor } from "detox";
import {
  TestIDs,
  TestUsers,
  waitForElement,
  ensureLoggedIn,
  navigateToTab,
  signIn,
} from "./setup";

/**
 * Helper: Navigate from authenticated state to settings screen.
 */
async function navigateToSettings(): Promise<void> {
  await navigateToTab("profile");
  await waitForElement(TestIDs.screensV2.profile, 5000);

  // Tap gear icon (testID wired in profile.tsx)
  await element(by.id(TestIDs.profile.settingsButton)).tap();
  await waitForElement(TestIDs.screens.settings, 5000);
}

describe("Settings Screen", () => {
  beforeAll(async () => {
    await ensureLoggedIn();
  });

  beforeEach(async () => {
    await navigateToSettings();
  });

  it("displays the settings screen", async () => {
    await expect(element(by.id(TestIDs.screens.settings))).toBeVisible();
  });

  it("shows Settings header text", async () => {
    await expect(element(by.text("Settings"))).toBeVisible();
  });

  it("shows the sign out button", async () => {
    await expect(element(by.id(TestIDs.settings.signOutButton))).toBeVisible();
  });

  it("shows Health Data option", async () => {
    await expect(element(by.id(TestIDs.settings.healthDataButton))).toBeVisible();
  });

  it("shows standard settings items", async () => {
    // These items exist in settings but lack testIDs — verify via text
    await expect(element(by.text("Account"))).toBeVisible();
    await expect(element(by.text("Notifications"))).toBeVisible();
    await expect(element(by.text("Privacy"))).toBeVisible();
    await expect(element(by.text("Security"))).toBeVisible();
    await expect(element(by.text("Help & Support"))).toBeVisible();
  });

  it("shows version info", async () => {
    await expect(element(by.text("FitChallenge v1.0.0"))).toBeVisible();
  });
});

describe("Settings — Sign Out", () => {
  beforeEach(async () => {
    // Fresh login before each sign-out test
    await device.launchApp({ newInstance: true, delete: true });
    await waitForElement(TestIDs.screens.welcome, 10000);
    await signIn(TestUsers.primary.email, TestUsers.primary.password);
  });

  it("sign out button triggers confirmation alert", async () => {
    await navigateToSettings();

    await element(by.id(TestIDs.settings.signOutButton)).tap();

    // Alert should appear: "Sign Out" / "Are you sure you want to sign out?"
    await waitFor(element(by.text("Are you sure you want to sign out?")))
      .toBeVisible()
      .withTimeout(3000);
  });

  it("cancelling sign out stays on settings", async () => {
    await navigateToSettings();

    await element(by.id(TestIDs.settings.signOutButton)).tap();
    await waitFor(element(by.text("Are you sure you want to sign out?")))
      .toBeVisible()
      .withTimeout(3000);

    // Tap "Cancel"
    await element(by.text("Cancel")).tap();

    // Should remain on settings screen
    await expect(element(by.id(TestIDs.screens.settings))).toBeVisible();
  });

  it("confirming sign out returns to welcome screen", async () => {
    await navigateToSettings();

    await element(by.id(TestIDs.settings.signOutButton)).tap();
    await waitFor(element(by.text("Are you sure you want to sign out?")))
      .toBeVisible()
      .withTimeout(3000);

    // Tap "Sign Out" (destructive button) — it's the second "Sign Out" text
    // First is the alert title, second is the button
    await element(by.text("Sign Out")).atIndex(1).tap();

    // Should navigate to welcome screen
    await waitForElement(TestIDs.screens.welcome, 10000);
  });
});

describe("Settings — Health Data", () => {
  beforeAll(async () => {
    await ensureLoggedIn();
  });

  it("can navigate to Health Data screen", async () => {
    await navigateToSettings();

    await element(by.id(TestIDs.settings.healthDataButton)).tap();

    // Health settings screen should appear
    // The health-settings-screen testID is defined in testIDs.ts
    await waitFor(element(by.text("Health Data")))
      .toBeVisible()
      .withTimeout(5000);
  });
});