// e2e/challenge-creation.e2e.ts
// Challenge Creation E2E Tests
//
// Tests the complete challenge creation flow:
// - Creating different challenge types
// - Form validation
// - Successful creation and navigation
// - Creator is auto-added as participant

import { by, device, element, expect } from "detox";
import {
  TestIDs,
  TestUsers,
  waitForElement,
  waitForText,
  tap,
  typeText,
  clearText,
  signIn,
  ensureLoggedIn,
  navigateToTab,
  createChallenge,
  generateTestId,
  expectVisible,
  expectTextVisible,
} from "./setup";

describe("Challenge Creation", () => {
  // ==========================================================================
  // SETUP
  // ==========================================================================

  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    // Ensure logged in as primary user
    await ensureLoggedIn();
  });

  // ==========================================================================
  // NAVIGATION TO CREATE SCREEN
  // ==========================================================================

  describe("Navigation", () => {
    it("should open create challenge screen from tab bar", async () => {
      await waitForElement(TestIDs.screens.home);

      // Tap create tab
      await navigateToTab("create");

      // Verify create challenge screen is shown
      await waitForElement(TestIDs.screens.createChallenge);
      await expectVisible(TestIDs.createChallenge.titleInput);
    });

    it("should close create screen when tapping cancel", async () => {
      await waitForElement(TestIDs.screens.home);

      // Open create screen
      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);

      // Tap cancel
      await tap(TestIDs.createChallenge.cancelButton);

      // Should return to home
      await waitForElement(TestIDs.screens.home);
    });
  });

  // ==========================================================================
  // FORM VALIDATION
  // ==========================================================================

  describe("Form Validation", () => {
    beforeEach(async () => {
      // Navigate to create screen
      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);
    });

    it("should show validation error when title is empty", async () => {
      // Leave title empty, fill other required fields
      await tap(TestIDs.createChallenge.typeSteps);
      await typeText(TestIDs.createChallenge.goalInput, "10000");
      await tap(TestIDs.createChallenge.duration7);

      // Try to create
      await tap(TestIDs.createChallenge.createButton);

      // Should show title error
      await waitForText("Title must be at least 3 characters");
    });

    it("should show validation error when title is too short", async () => {
      // Enter short title
      await typeText(TestIDs.createChallenge.titleInput, "AB");
      await tap(TestIDs.createChallenge.typeSteps);
      await typeText(TestIDs.createChallenge.goalInput, "10000");
      await tap(TestIDs.createChallenge.duration7);

      // Try to create
      await tap(TestIDs.createChallenge.createButton);

      // Should show title error
      await waitForText("Title must be at least 3 characters");
    });

    it("should show validation error when goal is empty", async () => {
      // Fill title but not goal
      await typeText(TestIDs.createChallenge.titleInput, "Test Challenge");
      await tap(TestIDs.createChallenge.typeSteps);
      await tap(TestIDs.createChallenge.duration7);

      // Clear default goal value
      await clearText(TestIDs.createChallenge.goalInput);

      // Try to create
      await tap(TestIDs.createChallenge.createButton);

      // Should show goal error
      await waitForText("Must be positive");
    });

    it("should show validation error for zero goal", async () => {
      await typeText(TestIDs.createChallenge.titleInput, "Test Challenge");
      await tap(TestIDs.createChallenge.typeSteps);
      await clearText(TestIDs.createChallenge.goalInput);
      await typeText(TestIDs.createChallenge.goalInput, "0");
      await tap(TestIDs.createChallenge.duration7);

      // Try to create
      await tap(TestIDs.createChallenge.createButton);

      // Should show goal error
      await waitForText("Must be positive");
    });
  });

  // ==========================================================================
  // CHALLENGE TYPE SELECTION
  // ==========================================================================

  describe("Challenge Type Selection", () => {
    beforeEach(async () => {
      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);
    });

    it("should select steps challenge type", async () => {
      await tap(TestIDs.createChallenge.typeSteps);
      // Verify selection (steps type should be highlighted)
      await expect(element(by.id(TestIDs.createChallenge.typeSteps))).toExist();
    });

    it("should select active minutes challenge type", async () => {
      await tap(TestIDs.createChallenge.typeActiveMinutes);
      await expect(
        element(by.id(TestIDs.createChallenge.typeActiveMinutes)),
      ).toExist();
    });

    it("should select workouts challenge type", async () => {
      await tap(TestIDs.createChallenge.typeWorkouts);
      await expect(
        element(by.id(TestIDs.createChallenge.typeWorkouts)),
      ).toExist();
    });

    it("should select distance challenge type", async () => {
      await tap(TestIDs.createChallenge.typeDistance);
      await expect(
        element(by.id(TestIDs.createChallenge.typeDistance)),
      ).toExist();
    });
  });

  // ==========================================================================
  // DURATION SELECTION
  // ==========================================================================

  describe("Duration Selection", () => {
    beforeEach(async () => {
      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);
    });

    it("should select 7-day duration", async () => {
      await tap(TestIDs.createChallenge.duration7);
      await expect(element(by.id(TestIDs.createChallenge.duration7))).toExist();
    });

    it("should select 14-day duration", async () => {
      await tap(TestIDs.createChallenge.duration14);
      await expect(
        element(by.id(TestIDs.createChallenge.duration14)),
      ).toExist();
    });

    it("should select 30-day duration", async () => {
      await tap(TestIDs.createChallenge.duration30);
      await expect(
        element(by.id(TestIDs.createChallenge.duration30)),
      ).toExist();
    });
  });

  // ==========================================================================
  // SUCCESSFUL CREATION
  // ==========================================================================

  describe("Successful Creation", () => {
    it("should create a steps challenge and navigate to detail", async () => {
      const challengeTitle = `Steps Challenge ${generateTestId()}`;

      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);

      // Fill form
      await typeText(TestIDs.createChallenge.titleInput, challengeTitle);
      await tap(TestIDs.createChallenge.typeSteps);
      await clearText(TestIDs.createChallenge.goalInput);
      await typeText(TestIDs.createChallenge.goalInput, "70000");
      await tap(TestIDs.createChallenge.duration7);

      // Create
      await tap(TestIDs.createChallenge.createButton);

      // Should navigate to challenge detail
      await waitForElement(TestIDs.screens.challengeDetail, 20000);

      // Verify challenge title is shown
      await expectTextVisible(challengeTitle);

      // Verify progress card is visible (creator is auto-added)
      await expectVisible(TestIDs.challengeDetail.progressCard);

      // Verify log activity button is available
      await expectVisible(TestIDs.challengeDetail.logActivityButton);
    });

    it("should create an active minutes challenge", async () => {
      const challengeTitle = `Minutes Challenge ${generateTestId()}`;

      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);

      await typeText(TestIDs.createChallenge.titleInput, challengeTitle);
      await tap(TestIDs.createChallenge.typeActiveMinutes);
      await clearText(TestIDs.createChallenge.goalInput);
      await typeText(TestIDs.createChallenge.goalInput, "150");
      await tap(TestIDs.createChallenge.duration14);

      await tap(TestIDs.createChallenge.createButton);

      await waitForElement(TestIDs.screens.challengeDetail, 20000);
      await expectTextVisible(challengeTitle);
    });

    it("should create a workouts challenge", async () => {
      const challengeTitle = `Workouts Challenge ${generateTestId()}`;

      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);

      await typeText(TestIDs.createChallenge.titleInput, challengeTitle);
      await tap(TestIDs.createChallenge.typeWorkouts);
      await clearText(TestIDs.createChallenge.goalInput);
      await typeText(TestIDs.createChallenge.goalInput, "20");
      await tap(TestIDs.createChallenge.duration30);

      await tap(TestIDs.createChallenge.createButton);

      await waitForElement(TestIDs.screens.challengeDetail, 20000);
      await expectTextVisible(challengeTitle);
    });

    it("should show new challenge on home screen after creation", async () => {
      const challengeTitle = `Home Test ${generateTestId()}`;

      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);

      await typeText(TestIDs.createChallenge.titleInput, challengeTitle);
      await tap(TestIDs.createChallenge.typeSteps);
      await clearText(TestIDs.createChallenge.goalInput);
      await typeText(TestIDs.createChallenge.goalInput, "50000");
      await tap(TestIDs.createChallenge.duration7);

      await tap(TestIDs.createChallenge.createButton);

      // Wait for detail screen
      await waitForElement(TestIDs.screens.challengeDetail, 20000);

      // Navigate back to home
      await navigateToTab("home");
      await waitForElement(TestIDs.screens.home);

      // Challenge should appear in active challenges
      await expectTextVisible(challengeTitle);
    });
  });

  // ==========================================================================
  // CHALLENGE WITH DESCRIPTION
  // ==========================================================================

  describe("Optional Fields", () => {
    it("should create challenge with description", async () => {
      const challengeTitle = `Described Challenge ${generateTestId()}`;
      const description = "This is a test description for the challenge";

      await navigateToTab("create");
      await waitForElement(TestIDs.screens.createChallenge);

      await typeText(TestIDs.createChallenge.titleInput, challengeTitle);
      await typeText(TestIDs.createChallenge.descriptionInput, description);
      await tap(TestIDs.createChallenge.typeSteps);
      await clearText(TestIDs.createChallenge.goalInput);
      await typeText(TestIDs.createChallenge.goalInput, "30000");
      await tap(TestIDs.createChallenge.duration7);

      await tap(TestIDs.createChallenge.createButton);

      await waitForElement(TestIDs.screens.challengeDetail, 20000);
      await expectTextVisible(challengeTitle);
      // Description should be visible somewhere on detail screen
      await expectTextVisible(description);
    });
  });
});
