// e2e/challenge-creation.e2e.ts
// Challenge Creation E2E Tests — Wizard Flow
//
// The CreateChallengeOrchestrator is a multi-step wizard:
//   mode → type → [workoutPicker] → details → [invite] → review → success
//
// Step transitions:
//   - Mode & Type: auto-advance on selection (no CTA tap)
//   - WorkoutPicker, Details, Invite: CTA button advances
//   - Review: CTA button submits (handleCreate)
//   - Success: Done button calls router.back()

import { by, device, element, expect } from "detox";
import {
  TestIDs,
  waitForElement,
  tap,
  replaceText,
  ensureLoggedIn,
  generateTestId,
  expectVisible,
  expectTextVisible,
} from "./setup";

// =============================================================================
// WIZARD NAVIGATION HELPERS
// =============================================================================

/**
 * Dismiss the keyboard inside the wizard by tapping the non-interactive
 * header title element.
 *
 * WHY NOT use the global `dismissKeyboard()` from setup.ts?
 * That helper tries to tap `TestIDs.screens.login` which doesn't exist in the
 * wizard context. On iOS the catch-fallback calls `device.pressBack()` which
 * NAVIGATES BACK instead of dismissing the keyboard — silently breaking tests.
 */
async function dismissWizardKeyboard() {
  try {
    await element(by.id(TestIDs.createWizard.headerTitle)).tap();
  } catch {
    // Header might not be visible (e.g. keyboard covers it on small screens).
    // Scrolling the step container also dismisses the keyboard.
    try {
      await element(by.id(TestIDs.screens.createChallenge)).tap({ x: 10, y: 60 });
    } catch {
      // Last resort: do nothing. replaceText doesn't open the keyboard anyway.
    }
  }
}

/**
 * Open the create challenge wizard from the home screen.
 * Waits until the mode selection step is visible.
 */
async function openWizard() {
  await waitForElement(TestIDs.screensV2.home);
  await element(by.id(TestIDs.nav.createChallengeFab)).tap();
  await waitForElement(TestIDs.screens.createChallenge);
  await waitForElement(TestIDs.createWizard.stepMode);
}

/**
 * Navigate through mode → type steps.
 * Both steps auto-advance on selection (no CTA needed).
 */
async function selectModeAndType(
  mode: "social" | "solo",
  type: "steps" | "active_minutes" | "workouts" | "distance" | "custom",
) {
  // Step 1: Mode selection — auto-advances to type
  const modeTestID =
    mode === "solo" ? TestIDs.createWizard.modeSolo : TestIDs.createWizard.modeSocial;
  await tap(modeTestID);

  // Step 2: Type selection — auto-advances to details (or workoutPicker for workouts)
  await waitForElement(TestIDs.createWizard.stepType);
  await tap(TestIDs.createWizard.typeOption(type));
}

/**
 * Fill the details step with provided values and advance via CTA.
 *
 * Uses `replaceText` (direct text replacement) instead of `typeText`
 * (character-by-character keyboard simulation) for reliability.
 * The codebase's own signIn helper already follows this pattern.
 * `replaceText` bypasses keyboard animations, avoids focus races, and
 * still triggers React Native's onChangeText on controlled TextInputs.
 */
async function fillDetailsAndAdvance(opts: {
  name: string;
  goal: string;
  duration?: string; // preset ID, defaults to "1week"
  description?: string;
  dailyTarget?: string;
  customUnit?: string; // required for "custom" challenge type
  startMode?: "now" | "scheduled";
  winCondition?: string; // for social mode
}) {
  await waitForElement(TestIDs.createWizard.stepDetails);

  // Name (required)
  await replaceText(TestIDs.createWizard.nameInput, opts.name);

  // Description (optional)
  if (opts.description) {
    await replaceText(TestIDs.createWizard.descriptionInput, opts.description);
  }

  // Custom unit (required for "custom" type, renders conditionally)
  if (opts.customUnit) {
    await replaceText(TestIDs.createWizard.customUnitInput, opts.customUnit);
  }

  // Goal (required)
  await replaceText(TestIDs.createWizard.goalInput, opts.goal);

  // Daily target (optional)
  if (opts.dailyTarget) {
    await replaceText(TestIDs.createWizard.dailyTargetInput, opts.dailyTarget);
  }

  // Duration preset (defaults to 1week)
  const duration = opts.duration ?? "1week";
  await tap(TestIDs.createWizard.durationPreset(duration));

  // Start mode (defaults to "now")
  if (opts.startMode === "scheduled") {
    await tap(TestIDs.createWizard.startModeScheduled);
  }

  // Win condition (social only)
  if (opts.winCondition) {
    await tap(TestIDs.createWizard.winCondition(opts.winCondition));
  }

  // Safety: dismiss any lingering keyboard before CTA tap.
  // replaceText usually doesn't open the keyboard, but a prior typeText call
  // or a focus event from tapping an input could leave it open.
  await dismissWizardKeyboard();

  // Advance to next step
  await tap(TestIDs.createWizard.ctaButton);
}

/**
 * Submit from the review step and wait for success.
 */
async function submitFromReviewAndWaitForSuccess() {
  await waitForElement(TestIDs.createWizard.stepReview);
  await tap(TestIDs.createWizard.ctaButton);
  await waitForElement(TestIDs.createWizard.stepSuccess, 20000);
}

/**
 * Tap Done on success screen and wait for home.
 */
async function tapDoneAndWaitForHome() {
  await tap(TestIDs.createWizard.doneButton);
  await waitForElement(TestIDs.screensV2.home);
}

// =============================================================================
// TESTS
// =============================================================================

describe("Challenge Creation", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await ensureLoggedIn();
  });

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  describe("Navigation", () => {
    it("should open create challenge wizard showing mode selection", async () => {
      await openWizard();
      // Mode step should show both options
      await expectVisible(TestIDs.createWizard.modeSocial);
      await expectVisible(TestIDs.createWizard.modeSolo);
    });

    it("should close wizard when tapping back on mode step", async () => {
      await openWizard();
      await tap(TestIDs.createWizard.backButton);
      await waitForElement(TestIDs.screensV2.home);
    });

    it("should navigate back from type to mode step", async () => {
      await openWizard();

      // Advance to type step
      await tap(TestIDs.createWizard.modeSolo);
      await waitForElement(TestIDs.createWizard.stepType);

      // Go back
      await tap(TestIDs.createWizard.backButton);
      await waitForElement(TestIDs.createWizard.stepMode);
    });

    it("should navigate back from details to type step", async () => {
      await openWizard();

      // Advance to details
      await selectModeAndType("solo", "steps");
      await waitForElement(TestIDs.createWizard.stepDetails);

      // Go back
      await tap(TestIDs.createWizard.backButton);
      await waitForElement(TestIDs.createWizard.stepType);
    });
  });

  // ==========================================================================
  // SOLO CHALLENGE CREATION
  // ==========================================================================

  describe("Solo Challenge Creation", () => {
    it("should create a solo steps goal through full wizard flow", async () => {
      const name = `Steps Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "steps");
      await fillDetailsAndAdvance({ name, goal: "70000" });
      await submitFromReviewAndWaitForSuccess();

      // Verify success screen shows correct title
      await expectVisible(TestIDs.createWizard.successTitle);

      await tapDoneAndWaitForHome();

      // Challenge should appear on home screen
      await expectTextVisible(name);
    });

    it("should create a solo active minutes goal", async () => {
      const name = `Minutes Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "active_minutes");
      await fillDetailsAndAdvance({ name, goal: "150", duration: "2weeks" });
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });

    it("should create a solo distance goal", async () => {
      const name = `Distance Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "distance");
      await fillDetailsAndAdvance({ name, goal: "50", duration: "1month" });
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });

    it("should create a solo workouts goal with workout picker step", async () => {
      const name = `Workouts Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "workouts");

      // Workout picker step appears for workouts type
      await waitForElement(TestIDs.createWizard.stepWorkoutPicker);

      // Select all workouts and advance
      await tap(TestIDs.createWizard.workoutSelectAll);
      await tap(TestIDs.createWizard.ctaButton);

      // Now on details step
      await fillDetailsAndAdvance({ name, goal: "20" });
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });

    it("should create a goal with description", async () => {
      const name = `Described Goal ${generateTestId()}`;
      const description = "This is a test description for the goal";

      await openWizard();
      await selectModeAndType("solo", "steps");
      await fillDetailsAndAdvance({ name, goal: "30000", description });
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });

    it("should create a solo custom type goal with custom unit", async () => {
      const name = `Custom Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "custom");

      // Custom type requires the "What are you tracking?" field
      await fillDetailsAndAdvance({
        name,
        goal: "30",
        customUnit: "glasses of water",
        duration: "1week",
      });

      // Verify review shows the custom unit
      await waitForElement(TestIDs.createWizard.stepReview);
      await expectTextVisible(name);

      await tap(TestIDs.createWizard.ctaButton);
      await waitForElement(TestIDs.createWizard.stepSuccess, 20000);
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });
  });

  // ==========================================================================
  // SOCIAL CHALLENGE CREATION
  // ==========================================================================

  describe("Social Challenge Creation", () => {
    it("should create a social steps challenge with invite step", async () => {
      const name = `Social Steps ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("social", "steps");

      // Details step — social mode shows win condition
      await fillDetailsAndAdvance({
        name,
        goal: "100000",
        winCondition: "highest_total",
      });

      // Invite step — skip inviting for now, just advance
      await waitForElement(TestIDs.createWizard.stepInvite);
      await tap(TestIDs.createWizard.ctaButton);

      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });

    it("should show invite step with search and skip option for social mode", async () => {
      await openWizard();
      await selectModeAndType("social", "steps");

      await fillDetailsAndAdvance({
        name: `Invite UI ${generateTestId()}`,
        goal: "5000",
        winCondition: "highest_total",
      });

      // Invite step should render with search input
      await waitForElement(TestIDs.createWizard.stepInvite);
      await expectVisible(TestIDs.createWizard.inviteSearchInput);

      // With no friends selected, CTA should show skip text
      await expectTextVisible("Skip — invite later");

      // Advance through skip, then complete the flow
      await tap(TestIDs.createWizard.ctaButton);
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();
    });

    it("should create a social workouts challenge with full flow", async () => {
      const name = `Social Workouts ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("social", "workouts");

      // Workout picker step
      await waitForElement(TestIDs.createWizard.stepWorkoutPicker);
      await tap(TestIDs.createWizard.workoutSelectAll);
      await tap(TestIDs.createWizard.ctaButton);

      // Details step
      await fillDetailsAndAdvance({
        name,
        goal: "30",
        duration: "1month",
        winCondition: "first_to_goal",
      });

      // Invite step — skip
      await waitForElement(TestIDs.createWizard.stepInvite);
      await tap(TestIDs.createWizard.ctaButton);

      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });
  });

  // ==========================================================================
  // REVIEW STEP VERIFICATION
  // ==========================================================================

  describe("Review Step", () => {
    it("should show correct challenge details on review screen", async () => {
      const name = `Review Test ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "steps");
      await fillDetailsAndAdvance({ name, goal: "50000", duration: "2weeks" });

      await waitForElement(TestIDs.createWizard.stepReview);

      // Verify challenge name is displayed with correct text
      await expect(element(by.id(TestIDs.createWizard.reviewChallengeName))).toHaveText(name);

      // Verify summary rows exist AND contain expected values.
      // The row labels are generated from StepReview's summaryRows array:
      //   "Goal" → review-row-goal, "Duration" → review-row-duration, etc.
      await expectVisible(TestIDs.createWizard.reviewSummaryRow("Goal"));
      await expectVisible(TestIDs.createWizard.reviewSummaryRow("Duration"));
      await expectVisible(TestIDs.createWizard.reviewSummaryRow("Starts"));

      // Verify actual content matches what we entered.
      // NOTE: Number formatting ("50,000") assumes en-US locale on the test
      // device/simulator. CI should configure the simulator locale explicitly
      // if this becomes flaky across environments.
      await expectTextVisible("50,000 steps"); // Goal row value
      await expectTextVisible("2 Weeks"); // Duration row value (matches DURATION_PRESETS label)
      await expectTextVisible("Immediately"); // Start mode "now" → "Immediately"

      // Clean up: complete the flow
      await tap(TestIDs.createWizard.ctaButton);
      await waitForElement(TestIDs.createWizard.stepSuccess, 20000);
      await tapDoneAndWaitForHome();
    });

    it("should show win condition and invite count for social challenges", async () => {
      const name = `Social Review ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("social", "active_minutes");
      await fillDetailsAndAdvance({
        name,
        goal: "300",
        duration: "1month",
        winCondition: "first_to_goal",
      });

      // Skip invite step
      await waitForElement(TestIDs.createWizard.stepInvite);
      await tap(TestIDs.createWizard.ctaButton);

      await waitForElement(TestIDs.createWizard.stepReview);

      // Social-specific rows should be present
      await expectVisible(TestIDs.createWizard.reviewSummaryRow("Win Condition"));
      await expectVisible(TestIDs.createWizard.reviewSummaryRow("Invited"));
      await expectTextVisible("First to Goal"); // Win condition label
      await expectTextVisible("0 friends"); // No friends invited

      // Clean up
      await tap(TestIDs.createWizard.ctaButton);
      await waitForElement(TestIDs.createWizard.stepSuccess, 20000);
      await tapDoneAndWaitForHome();
    });
  });

  // ==========================================================================
  // FORM VALIDATION
  // ==========================================================================

  describe("Form Validation", () => {
    it("should disable CTA when name is empty on details step", async () => {
      await openWizard();
      await selectModeAndType("solo", "steps");
      await waitForElement(TestIDs.createWizard.stepDetails);

      // Fill goal but leave name empty — CTA should be disabled
      await replaceText(TestIDs.createWizard.goalInput, "10000");
      await dismissWizardKeyboard();

      // Detox: disabled TouchableOpacity won't advance the wizard
      await tap(TestIDs.createWizard.ctaButton);
      await expectVisible(TestIDs.createWizard.stepDetails);
    });

    it("should disable CTA when goal is empty on details step", async () => {
      await openWizard();
      await selectModeAndType("solo", "steps");
      await waitForElement(TestIDs.createWizard.stepDetails);

      // Fill name but clear goal — CTA should be disabled
      await replaceText(TestIDs.createWizard.nameInput, "Test Challenge");
      await replaceText(TestIDs.createWizard.goalInput, "");
      await dismissWizardKeyboard();

      // CTA disabled — should stay on details
      await tap(TestIDs.createWizard.ctaButton);
      await expectVisible(TestIDs.createWizard.stepDetails);
    });

    it("should disable CTA when custom unit is too short for custom type", async () => {
      await openWizard();
      await selectModeAndType("solo", "custom");
      await waitForElement(TestIDs.createWizard.stepDetails);

      // Fill name and goal but use 1-char custom unit (min is 2)
      await replaceText(TestIDs.createWizard.nameInput, "Custom Test");
      await replaceText(TestIDs.createWizard.customUnitInput, "x");
      await replaceText(TestIDs.createWizard.goalInput, "10");
      await dismissWizardKeyboard();

      // CTA disabled due to short custom unit — should stay on details
      await tap(TestIDs.createWizard.ctaButton);
      await expectVisible(TestIDs.createWizard.stepDetails);
    });

    it("should enable CTA once name and goal are provided", async () => {
      await openWizard();
      await selectModeAndType("solo", "steps");
      await waitForElement(TestIDs.createWizard.stepDetails);

      // Fill required fields
      await replaceText(TestIDs.createWizard.nameInput, "Valid Challenge");
      await replaceText(TestIDs.createWizard.goalInput, "10000");
      await tap(TestIDs.createWizard.durationPreset("1week"));
      await dismissWizardKeyboard();

      // CTA should advance to review
      await tap(TestIDs.createWizard.ctaButton);
      await waitForElement(TestIDs.createWizard.stepReview);

      // Clean up
      await tap(TestIDs.createWizard.ctaButton);
      await waitForElement(TestIDs.createWizard.stepSuccess, 20000);
      await tapDoneAndWaitForHome();
    });
  });

  // ==========================================================================
  // DURATION SELECTION
  // ==========================================================================

  describe("Duration Selection", () => {
    it("should create challenge with 14-day duration", async () => {
      const name = `14Day Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "steps");
      await fillDetailsAndAdvance({ name, goal: "100000", duration: "2weeks" });
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });

    it("should create challenge with 30-day duration", async () => {
      const name = `30Day Goal ${generateTestId()}`;

      await openWizard();
      await selectModeAndType("solo", "active_minutes");
      await fillDetailsAndAdvance({ name, goal: "500", duration: "1month" });
      await submitFromReviewAndWaitForSuccess();
      await tapDoneAndWaitForHome();

      await expectTextVisible(name);
    });
  });

  // ==========================================================================
  // CHALLENGE TYPE VARIETY
  // ==========================================================================

  describe("Challenge Type Selection", () => {
    it("should navigate through all solo types without errors", async () => {
      // Test that each non-workout type can be selected and reaches details.
      // "workouts" is tested separately (it routes through workoutPicker).
      const types = ["steps", "active_minutes", "distance", "custom"] as const;

      for (const type of types) {
        await openWizard();
        await selectModeAndType("solo", type);
        await waitForElement(TestIDs.createWizard.stepDetails);

        // Navigate back step-by-step, waiting for each step to appear
        // before tapping again. Without these waits, the back button's
        // onPress handler may not yet reflect the new currentStep.
        await tap(TestIDs.createWizard.backButton);
        await waitForElement(TestIDs.createWizard.stepType);

        await tap(TestIDs.createWizard.backButton);
        await waitForElement(TestIDs.createWizard.stepMode);

        await tap(TestIDs.createWizard.backButton); // close wizard
        await waitForElement(TestIDs.screensV2.home);
      }
    });

    it("should show workout picker for workouts type", async () => {
      await openWizard();
      await selectModeAndType("solo", "workouts");

      // Workouts type should show workout picker BEFORE details
      await waitForElement(TestIDs.createWizard.stepWorkoutPicker);
      await expectVisible(TestIDs.createWizard.workoutSelectAll);

      // Navigate back step-by-step with waits to avoid race conditions
      await tap(TestIDs.createWizard.backButton);
      await waitForElement(TestIDs.createWizard.stepType);

      await tap(TestIDs.createWizard.backButton);
      await waitForElement(TestIDs.createWizard.stepMode);

      await tap(TestIDs.createWizard.backButton); // close wizard
      await waitForElement(TestIDs.screensV2.home);
    });
  });
});
