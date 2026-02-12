// e2e/setup.ts
// E2E Test Utilities and Helpers
//
// TestIDs are imported from the CANONICAL source: @/constants/testIDs
// This eliminates the dual-source problem where E2E tests could
// reference stale testID values.
//
// INSTRUMENTED (have testIDs):
//   welcome.tsx:        welcome-screen, get-started-button, welcome-sign-in-link
//   auth.tsx:           login-screen, email-input, password-input, username-input,
//                       signin-button, signup-button, signup-mode-button, signin-mode-button
//   (tabs)/_layout.tsx: tab-home, tab-challenges, tab-friends, tab-profile,
//                       notification-bell, create-challenge-fab
//   (tabs)/index.tsx:   home-screen-v2
//   (tabs)/friends.tsx: friends-screen-v2
//   (tabs)/profile.tsx: profile-screen-v2, settings-button (gear icon)
//   settings/index.tsx: settings-screen, signout-button, health-data-button, developer-button
//   ChallengeDetailScreen: challenge-detail-screen, challenge-detail-title, progress-card,
//                       log-activity-button, invite-button, leaderboard-section
//   LogActivitySheet:   log-activity-modal, activity-value-input, submit-activity-button
//   InviteModal:        invite-modal, user-search-input, close-modal-button
//   CreateChallengeOrchestrator: create-challenge-screen, wizard-back-button,
//                       wizard-header-title, wizard-cta-button
//   StepMode:           wizard-step-mode, mode-social, mode-solo
//   StepType:           wizard-step-type, challenge-type-{id}
//   StepWorkoutPicker:  wizard-step-workout-picker, workout-select-all,
//                       workout-chip-{id}, workout-category-{id}
//   StepDetails:        wizard-step-details, challenge-title-input,
//                       challenge-description-input, challenge-goal-input,
//                       challenge-custom-unit-input, daily-target-input,
//                       duration-{id}, custom-duration-input,
//                       start-mode-now, start-mode-scheduled, win-condition-{id}
//   StepInvite:         wizard-step-invite, invite-search-input, invite-friend-{id}
//   StepReview:         wizard-step-review, review-challenge-name, review-row-{label}
//   StepSuccess:        wizard-step-success, wizard-success-title, wizard-done-button
//
// NOT INSTRUMENTED (need text selectors or future testID additions):
//   FriendRow (shared component)

import { by, device, element, expect, waitFor } from "detox";
import { TestIDs } from "@/constants/testIDs";

// Re-export so test files can import TestIDs from ./setup
export { TestIDs };

// =============================================================================
// APP LAUNCH WRAPPER
// =============================================================================
// Detox synchronization is ENABLED. The app reaches idle state because
// non-essential startup instrumentation is disabled at build time via
// EXPO_PUBLIC_E2E=true (set in .env before building the E2E binary):
//
//   - Sentry.wrap() skipped → no TouchEventBoundary/profiler/feedback observers
//   - PersistQueryClientProvider skipped → no AsyncStorage hydration/throttle timers
//   - Notification polling interval disabled → no 30s refetchInterval timer
//
// With these timer sources eliminated, Detox can detect app idle and
// synchronize automatically. No disableSynchronization() workaround needed.
//
// The AuthProvider 10s safety timeout is intentionally NOT gated — it's a
// one-shot timer that clears when INITIAL_SESSION fires and serves a real
// purpose (detecting corrupted auth storage).
//
// IMPORTANT: EXPO_PUBLIC_E2E is a BUILD-TIME flag inlined by Metro.
// Detox launchArgs do NOT reach process.env. The flag must be in .env
// before `detox build`.

export async function launchApp(
  params: Record<string, unknown> = {},
): Promise<void> {
  await device.launchApp(params);
}

// =============================================================================
// TEST USER CREDENTIALS
// =============================================================================
// These match the users created by e2e/scripts/seed-users.ts.
// The seed script passes username and full_name in user_metadata,
// which the handle_new_user trigger maps to profiles.username and
// profiles.display_name respectively.

export const TestUsers = {
  primary: {
    email: "e2e-primary@test.local",
    password: "E2eTestPassword123!",
    username: "e2eprimary",
    displayName: "E2E Primary User",
  },
  secondary: {
    email: "e2e-secondary@test.local",
    password: "E2eTestPassword123!",
    username: "e2esecondary",
    displayName: "E2E Secondary User",
  },
  friend: {
    email: "e2e-friend@test.local",
    password: "E2eTestPassword123!",
    username: "e2efriend",
    displayName: "E2E Friend User",
  },
};

// =============================================================================
// WAIT HELPERS
// =============================================================================

const DEFAULT_TIMEOUT = 15000;

export async function waitForElement(
  testID: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(timeout);
}

export async function waitForElementToDisappear(
  testID: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitFor(element(by.id(testID)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

export async function waitForText(
  text: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitFor(element(by.text(text)))
    .toBeVisible()
    .withTimeout(timeout);
}

// =============================================================================
// INTERACTION HELPERS
// =============================================================================

export async function tap(testID: string): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT);
  await element(by.id(testID)).tap();
}

export async function typeText(testID: string, text: string): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT);
  await element(by.id(testID)).typeText(text);
}

export async function replaceText(testID: string, text: string): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT);
  await element(by.id(testID)).replaceText(text);
}

export async function clearText(testID: string): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT);
  await element(by.id(testID)).clearText();
}

// =============================================================================
// AUTH FLOW HELPERS
// =============================================================================

/**
 * Sign in from a fresh app launch.
 *
 * ACTUAL FLOW (verified):
 * 1. App launches → welcome-screen
 * 2. Tap welcome-sign-in-link → navigates to auth?mode=signin (400ms animation)
 * 3. Wait for login-screen
 * 4. Ensure signin mode via signin-mode-button
 * 5. replaceText into email-input and password-input
 * 6. Tap signin-button
 * 7. Wait for home-screen-v2
 */
export async function signIn(email: string, password: string): Promise<void> {
  // Wait for welcome or auth screen (handles both fresh and returning states)
  try {
    await waitFor(element(by.id(TestIDs.screens.welcome)))
      .toBeVisible()
      .withTimeout(8000);
    // On welcome — navigate to auth/signin
    await element(by.id(TestIDs.welcome.signInLink)).tap();
  } catch {
    // May already be on auth screen
  }

  // Wait for auth screen (includes welcome→auth animation ~400ms)
  await waitForElement(TestIDs.screens.login, 10000);

  // Ensure signin mode (screen may open in signup mode from "Get Started")
  try {
    await element(by.id(TestIDs.auth.signinModeButton)).tap();
  } catch {
    // Already in signin mode
  }

  // Fill credentials — use replaceText to avoid keyboard quirks
  await element(by.id(TestIDs.auth.emailInput)).replaceText(email);
  await element(by.id(TestIDs.auth.passwordInput)).replaceText(password);

  // Submit
  await element(by.id(TestIDs.auth.signInButton)).tap();

  // Wait for home screen (V2 testID)
  await waitForElement(TestIDs.screensV2.home, 15000);
}

/**
 * Sign out from an authenticated state.
 *
 * ACTUAL FLOW (verified):
 * 1. Tap tab-profile → profile-screen-v2
 * 2. Tap settings-button (gear icon) → settings-screen
 * 3. Wait for settings-screen
 * 4. Tap signout-button
 * 5. System Alert: "Sign Out" / "Are you sure..." / "Cancel" + "Sign Out"
 * 6. Confirm alert
 * 7. Wait for welcome-screen
 */
export async function signOut(): Promise<void> {
  // Navigate to profile tab
  await element(by.id(TestIDs.nav.tabProfile)).tap();
  await waitForElement(TestIDs.screensV2.profile, 5000);

  // Navigate to settings via gear icon (testID wired in profile.tsx)
  await element(by.id(TestIDs.profile.settingsButton)).tap();

  // Wait for settings screen
  await waitForElement(TestIDs.screens.settings, 5000);

  // Tap sign out
  await element(by.id(TestIDs.settings.signOutButton)).tap();

  // Handle system alert — "Sign Out" appears as both title and button
  // We need to tap the destructive "Sign Out" button (index 1)
  await waitFor(element(by.text("Sign Out")).atIndex(1))
    .toBeVisible()
    .withTimeout(3000);
  await element(by.text("Sign Out")).atIndex(1).tap();

  // Wait for welcome screen
  await waitForElement(TestIDs.screens.welcome, 10000);
}

/**
 * Ensure we're logged out and on the welcome screen.
 */
export async function ensureLoggedOut(): Promise<void> {
  await launchApp({ newInstance: true });

  try {
    await waitFor(element(by.id(TestIDs.screensV2.home)))
      .toBeVisible()
      .withTimeout(5000);
    await signOut();
  } catch {
    try {
      await waitForElement(TestIDs.screens.welcome, 5000);
    } catch {
      // Nuclear option: clear app data
      await launchApp({ newInstance: true, delete: true });
      await waitForElement(TestIDs.screens.welcome, 10000);
    }
  }
}

/**
 * Ensure we're logged in as the primary test user.
 */
export async function ensureLoggedIn(): Promise<void> {
  await launchApp({ newInstance: true });

  try {
    await waitFor(element(by.id(TestIDs.screensV2.home)))
      .toBeVisible()
      .withTimeout(5000);
    // Already logged in
  } catch {
    await signIn(TestUsers.primary.email, TestUsers.primary.password);
  }
}

// =============================================================================
// NAVIGATION HELPERS
// =============================================================================

/**
 * Navigate to a tab by tapping its tab bar button.
 *
 * NOTE: "create" is intentionally excluded. The create tab uses a custom FAB
 * component (create-challenge-fab) that is NOT a standard tab button. The
 * testID "tab-create" is defined in testIDs.ts but is never rendered to the
 * DOM. Use TestIDs.nav.createChallengeFab to tap the FAB directly.
 */
export async function navigateToTab(
  tab: "home" | "challenges" | "friends" | "profile",
): Promise<void> {
  const tabIds = {
    home: TestIDs.nav.tabHome,
    challenges: TestIDs.nav.tabChallenges,
    friends: TestIDs.nav.tabFriends,
    profile: TestIDs.nav.tabProfile,
  };
  await element(by.id(tabIds[tab])).tap();
}

// =============================================================================
// CHALLENGE HELPERS
// =============================================================================

/**
 * Log activity on the current challenge detail screen.
 * All testIDs verified in ChallengeDetailScreen.tsx and LogActivitySheet.tsx.
 */
export async function logActivity(value: number): Promise<void> {
  await element(by.id(TestIDs.challengeDetail.logActivityButton)).tap();
  await waitForElement(TestIDs.logActivity.modal);

  await element(by.id(TestIDs.logActivity.valueInput)).clearText();
  await element(by.id(TestIDs.logActivity.valueInput)).typeText(value.toString());

  await element(by.id(TestIDs.logActivity.submitButton)).tap();
  await waitForElementToDisappear(TestIDs.logActivity.modal);
}

// NOTE: createChallenge() helper is not needed — the wizard flow is fully
// instrumented with testIDs and tests drive each step directly via
// TestIDs.createWizard.* selectors.

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

export async function expectVisible(testID: string): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT);
}

export async function expectNotVisible(testID: string): Promise<void> {
  await expect(element(by.id(testID))).not.toBeVisible();
}

export async function expectTextVisible(text: string): Promise<void> {
  await expect(element(by.text(text))).toBeVisible();
}

export async function expectText(testID: string, text: string): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(DEFAULT_TIMEOUT);
  await expect(element(by.id(testID))).toHaveText(text);
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

export function generateTestId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function dismissKeyboard(): Promise<void> {
  if (device.getPlatform() === "ios") {
    try {
      await element(by.id(TestIDs.screens.login)).tap({ x: 10, y: 10 });
    } catch {
      await device.pressBack();
    }
  } else {
    await device.pressBack();
  }
}

export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}
