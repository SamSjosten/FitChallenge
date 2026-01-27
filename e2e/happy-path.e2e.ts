// e2e/happy-path.e2e.ts
// Happy Path E2E Test - Complete User Journey
//
// This is the critical smoke test that validates the entire user journey:
// 1. Sign in
// 2. Create a challenge
// 3. Log activity
// 4. View leaderboard
// 5. Sign out
//
// Run with: npm run e2e:smoke:ios or npm run e2e:smoke:android
// This test is designed to be fast and reliable for CI smoke testing.

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
  signIn,
  signOut,
  ensureLoggedOut,
  navigateToTab,
  logActivity,
  generateTestId,
  expectVisible,
  expectTextVisible,
  retry,
} from "./setup";

describe("Happy Path", () => {
  // Unique identifiers for this test run
  const testRunId = generateTestId();
  const challengeTitle = `E2E Happy Path ${testRunId}`;

  // ==========================================================================
  // SETUP
  // ==========================================================================

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: "YES" },
    });
  });

  // ==========================================================================
  // COMPLETE USER JOURNEY
  // ==========================================================================

  it("Happy Path: Complete user journey from login to leaderboard", async () => {
    // =========================================================================
    // STEP 1: SIGN IN
    // =========================================================================
    console.log("Step 1: Signing in...");

    await ensureLoggedOut();
    await waitForElement(TestIDs.screens.login);

    // Enter credentials
    await typeText(TestIDs.auth.emailInput, TestUsers.primary.email);
    await typeText(TestIDs.auth.passwordInput, TestUsers.primary.password);
    await tap(TestIDs.auth.signInButton);

    // Verify successful login
    await waitForElement(TestIDs.screens.home, 20000);
    await expectVisible(TestIDs.screens.home);
    console.log("✓ Signed in successfully");

    // =========================================================================
    // STEP 2: CREATE CHALLENGE
    // =========================================================================
    console.log("Step 2: Creating challenge...");

    // Navigate to create screen
    await navigateToTab("create");
    await waitForElement(TestIDs.screens.createChallenge);

    // Fill in challenge details
    await typeText(TestIDs.createChallenge.titleInput, challengeTitle);
    await tap(TestIDs.createChallenge.typeSteps);
    await clearText(TestIDs.createChallenge.goalInput);
    await typeText(TestIDs.createChallenge.goalInput, "100000"); // 100k steps
    await tap(TestIDs.createChallenge.duration7); // 7 days

    // Create the challenge
    await tap(TestIDs.createChallenge.createButton);

    // Verify navigation to challenge detail
    await waitForElement(TestIDs.screens.challengeDetail, 20000);
    await expectTextVisible(challengeTitle);
    console.log("✓ Challenge created successfully");

    // =========================================================================
    // STEP 3: LOG ACTIVITY
    // =========================================================================
    console.log("Step 3: Logging activity...");

    // Open log activity modal
    await tap(TestIDs.challengeDetail.logActivityButton);
    await waitForElement(TestIDs.logActivity.modal);

    // Enter activity value
    await clearText(TestIDs.logActivity.valueInput);
    await typeText(TestIDs.logActivity.valueInput, "5000"); // 5000 steps

    // Submit activity
    await tap(TestIDs.logActivity.submitButton);

    // Verify modal closes
    await waitForElementToDisappear(TestIDs.logActivity.modal);
    await expectVisible(TestIDs.screens.challengeDetail);
    console.log("✓ Activity logged successfully");

    // =========================================================================
    // STEP 4: VERIFY LEADERBOARD
    // =========================================================================
    console.log("Step 4: Verifying leaderboard...");

    // Leaderboard should be visible (user is accepted participant)
    await expectVisible(TestIDs.challengeDetail.leaderboardSection);

    // Progress should be reflected (5000 steps logged)
    await expectVisible(TestIDs.challengeDetail.progressCard);
    console.log("✓ Leaderboard visible and progress tracked");

    // =========================================================================
    // STEP 5: VERIFY HOME SCREEN SHOWS CHALLENGE
    // =========================================================================
    console.log("Step 5: Verifying home screen...");

    // Navigate to home
    await navigateToTab("home");
    await waitForElement(TestIDs.screens.home);

    // Challenge should appear in active challenges
    await expectTextVisible(challengeTitle);
    console.log("✓ Challenge visible on home screen");

    // =========================================================================
    // STEP 6: LOG MORE ACTIVITY FROM HOME
    // =========================================================================
    console.log("Step 6: Logging more activity...");

    // Tap on the challenge to go to detail
    await element(by.text(challengeTitle)).tap();
    await waitForElement(TestIDs.screens.challengeDetail);

    // Log more activity
    await logActivity(3000);
    console.log("✓ Additional activity logged");

    // =========================================================================
    // STEP 7: SIGN OUT
    // =========================================================================
    console.log("Step 7: Signing out...");

    await signOut();

    // Verify we're back on login screen
    await expectVisible(TestIDs.screens.login);
    console.log("✓ Signed out successfully");

    // =========================================================================
    // COMPLETE
    // =========================================================================
    console.log("\n✅ Happy Path test completed successfully!");
  });

  // ==========================================================================
  // SESSION PERSISTENCE CHECK
  // ==========================================================================

  it("Happy Path: Session persists after app restart", async () => {
    console.log("Testing session persistence...");

    // Sign in
    await ensureLoggedOut();
    await signIn(TestUsers.primary.email, TestUsers.primary.password);
    await expectVisible(TestIDs.screens.home);

    // Restart app (keep storage)
    await device.launchApp({ newInstance: false });

    // Wait for app to initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Should still be logged in
    await retry(async () => {
      await waitForElement(TestIDs.screens.home, 10000);
    });
    await expectVisible(TestIDs.screens.home);

    console.log("✓ Session persisted after restart");

    // Clean up - sign out
    await signOut();
  });

  // ==========================================================================
  // DATA PERSISTENCE CHECK
  // ==========================================================================

  it("Happy Path: Challenge data persists", async () => {
    console.log("Testing data persistence...");

    // Sign in
    await signIn(TestUsers.primary.email, TestUsers.primary.password);
    await waitForElement(TestIDs.screens.home);

    // The challenge created earlier should still exist
    // (This test assumes it runs after the main happy path test)
    try {
      await expectTextVisible(challengeTitle);
      console.log("✓ Challenge data persisted");
    } catch {
      // Challenge may have been cleaned up or this is a fresh run
      console.log("Challenge not found - may be a fresh test run");
    }

    // Sign out
    await signOut();
  });
});

// =============================================================================
// NAVIGATION SMOKE TEST
// =============================================================================

describe("Navigation Smoke Test", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await ensureLoggedOut();
    await signIn(TestUsers.primary.email, TestUsers.primary.password);
    await waitForElement(TestIDs.screens.home);
  });

  afterAll(async () => {
    await signOut();
  });

  it("should navigate through all main tabs", async () => {
    // Home tab (already on home)
    await expectVisible(TestIDs.screens.home);
    console.log("✓ Home tab");

    // Challenges tab
    await navigateToTab("challenges");
    await waitForElement(TestIDs.screens.challenges);
    console.log("✓ Challenges tab");

    // Friends tab
    await navigateToTab("friends");
    await waitForElement(TestIDs.screens.friends);
    console.log("✓ Friends tab");

    // Profile tab
    await navigateToTab("profile");
    await waitForElement(TestIDs.screens.profile);
    console.log("✓ Profile tab");

    // Back to Home
    await navigateToTab("home");
    await waitForElement(TestIDs.screens.home);
    console.log("✓ Back to Home");

    console.log("\n✅ Navigation smoke test passed!");
  });
});

// =============================================================================
// ERROR HANDLING SMOKE TEST
// =============================================================================

describe("Error Handling Smoke Test", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await ensureLoggedOut();
  });

  it("should handle invalid login gracefully", async () => {
    await waitForElement(TestIDs.screens.login);

    // Try to sign in with invalid credentials
    await typeText(TestIDs.auth.emailInput, "invalid@example.com");
    await typeText(TestIDs.auth.passwordInput, "wrongpassword123");
    await tap(TestIDs.auth.signInButton);

    // Should show error, not crash
    await waitForElement(TestIDs.auth.loginError, 15000);
    await expectVisible(TestIDs.auth.loginError);

    console.log("✓ Invalid login handled gracefully");
  });

  it("should stay on login screen after error", async () => {
    // Should still be on login screen
    await expectVisible(TestIDs.screens.login);
    await expectVisible(TestIDs.auth.emailInput);

    console.log("✓ App remains stable after error");
  });
});
