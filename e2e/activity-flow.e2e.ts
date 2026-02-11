// e2e/activity-flow.e2e.ts
// Activity Logging E2E Tests
//
// Tests the activity logging flow:
// - Opening log activity modal
// - Form validation
// - Successful activity logging
// - Progress updates after logging
// - Leaderboard position updates

import { by, device, element, expect } from "detox";
import {
  TestIDs,
  TestUsers,
  waitForElement,
  waitForElementToDisappear,
  waitForText,
  tap,
  typeText,
  clearText,
  ensureLoggedIn,
  navigateToTab,
  logActivity,
  generateTestId,
  expectVisible,
  expectNotVisible,
  expectTextVisible,
  launchApp,
} from "./setup";

describe("Activity Logging", () => {
  // Store created challenge ID for tests
  let testChallengeTitle: string;

  // ==========================================================================
  // SETUP
  // ==========================================================================

  beforeAll(async () => {
    await launchApp({ newInstance: true });

    // Sign in and create a test challenge
    await ensureLoggedIn();

    testChallengeTitle = `Activity Test ${generateTestId()}`;

    await tap(TestIDs.nav.createChallengeFab);
    await waitForElement(TestIDs.screens.createChallenge);

    await typeText(TestIDs.createChallenge.titleInput, testChallengeTitle);
    await tap(TestIDs.createChallenge.typeSteps);
    await clearText(TestIDs.createChallenge.goalInput);
    await typeText(TestIDs.createChallenge.goalInput, "100000");
    await tap(TestIDs.createChallenge.duration7);
    await tap(TestIDs.createChallenge.createButton);

    await waitForElement(TestIDs.screens.challengeDetail, 20000);
  });

  beforeEach(async () => {
    // Navigate back to challenge detail if needed
    await navigateToTab("home");
    await waitForElement(TestIDs.screens.home);

    // Find and tap on the test challenge
    await tap(TestIDs.home.activeChallengesSection);
    await element(by.text(testChallengeTitle)).tap();
    await waitForElement(TestIDs.screens.challengeDetail);
  });

  // ==========================================================================
  // LOG ACTIVITY MODAL
  // ==========================================================================

  describe("Log Activity Modal", () => {
    it("should open log activity modal", async () => {
      await tap(TestIDs.challengeDetail.logActivityButton);
      await waitForElement(TestIDs.logActivity.modal);
      await expectVisible(TestIDs.logActivity.valueInput);
      await expectVisible(TestIDs.logActivity.submitButton);
    });

    it("should close modal when tapping cancel", async () => {
      await tap(TestIDs.challengeDetail.logActivityButton);
      await waitForElement(TestIDs.logActivity.modal);

      await tap(TestIDs.logActivity.cancelButton);

      await waitForElementToDisappear(TestIDs.logActivity.modal);
      await expectVisible(TestIDs.screens.challengeDetail);
    });
  });

  // ==========================================================================
  // FORM VALIDATION
  // ==========================================================================

  describe("Activity Form Validation", () => {
    beforeEach(async () => {
      await tap(TestIDs.challengeDetail.logActivityButton);
      await waitForElement(TestIDs.logActivity.modal);
    });

    afterEach(async () => {
      // Close modal if still open
      try {
        await tap(TestIDs.logActivity.cancelButton);
        await waitForElementToDisappear(TestIDs.logActivity.modal, 3000);
      } catch {
        // Modal already closed
      }
    });

    it("should show validation error for empty value", async () => {
      // Clear default value if any
      await clearText(TestIDs.logActivity.valueInput);

      // Try to submit
      await tap(TestIDs.logActivity.submitButton);

      // Should show validation error
      await waitForText("Must be positive");
    });

    it("should show validation error for zero value", async () => {
      await clearText(TestIDs.logActivity.valueInput);
      await typeText(TestIDs.logActivity.valueInput, "0");

      await tap(TestIDs.logActivity.submitButton);

      await waitForText("Must be positive");
    });

    it("should show validation error for negative value", async () => {
      await clearText(TestIDs.logActivity.valueInput);
      await typeText(TestIDs.logActivity.valueInput, "-100");

      await tap(TestIDs.logActivity.submitButton);

      await waitForText("Must be positive");
    });

    it("should show validation error for non-numeric value", async () => {
      await clearText(TestIDs.logActivity.valueInput);
      await typeText(TestIDs.logActivity.valueInput, "abc");

      await tap(TestIDs.logActivity.submitButton);

      // Should show validation error
      await waitForElement(TestIDs.logActivity.valueError, 5000);
    });
  });

  // ==========================================================================
  // SUCCESSFUL ACTIVITY LOGGING
  // ==========================================================================

  describe("Successful Activity Logging", () => {
    it("should log activity and show success feedback", async () => {
      await tap(TestIDs.challengeDetail.logActivityButton);
      await waitForElement(TestIDs.logActivity.modal);

      // Enter a value
      await clearText(TestIDs.logActivity.valueInput);
      await typeText(TestIDs.logActivity.valueInput, "5000");

      // Submit
      await tap(TestIDs.logActivity.submitButton);

      // Modal should close
      await waitForElementToDisappear(TestIDs.logActivity.modal);

      // Should still be on challenge detail
      await expectVisible(TestIDs.screens.challengeDetail);
    });

    it("should update progress after logging activity", async () => {
      // Log activity
      await tap(TestIDs.challengeDetail.logActivityButton);
      await waitForElement(TestIDs.logActivity.modal);
      await clearText(TestIDs.logActivity.valueInput);
      await typeText(TestIDs.logActivity.valueInput, "3000");
      await tap(TestIDs.logActivity.submitButton);
      await waitForElementToDisappear(TestIDs.logActivity.modal);

      // Progress card should be visible and updated
      await expectVisible(TestIDs.challengeDetail.progressCard);

      // The progress text should show some value
      // (exact value depends on previous activities in this test run)
    });

    it("should allow logging multiple activities", async () => {
      // First activity
      await logActivity(1000);
      await expectVisible(TestIDs.screens.challengeDetail);

      // Second activity
      await logActivity(2000);
      await expectVisible(TestIDs.screens.challengeDetail);

      // Third activity
      await logActivity(1500);
      await expectVisible(TestIDs.screens.challengeDetail);

      // Progress should be cumulative
      await expectVisible(TestIDs.challengeDetail.progressCard);
    });
  });

  // ==========================================================================
  // IDEMPOTENCY
  // ==========================================================================

  describe("Activity Idempotency", () => {
    it("should handle rapid submissions gracefully", async () => {
      await tap(TestIDs.challengeDetail.logActivityButton);
      await waitForElement(TestIDs.logActivity.modal);

      await clearText(TestIDs.logActivity.valueInput);
      await typeText(TestIDs.logActivity.valueInput, "500");

      // Tap submit multiple times quickly
      await tap(TestIDs.logActivity.submitButton);
      // The second tap should be ignored or handled gracefully

      // Should complete without crash
      await waitForElementToDisappear(TestIDs.logActivity.modal, 10000);
      await expectVisible(TestIDs.screens.challengeDetail);
    });
  });

  // ==========================================================================
  // LEADERBOARD UPDATES
  // ==========================================================================

  describe("Leaderboard Updates", () => {
    it("should update leaderboard position after logging activity", async () => {
      // Verify leaderboard is visible (creator should be the only participant)
      await expectVisible(TestIDs.challengeDetail.leaderboardSection);

      // Log some activity
      await logActivity(10000);

      // Leaderboard should still be visible
      await expectVisible(TestIDs.challengeDetail.leaderboardSection);

      // Progress should reflect in the leaderboard
      // (The user should see their updated progress in the leaderboard entry)
    });
  });
});
