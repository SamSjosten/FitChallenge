// e2e/setup.ts
// E2E Test Utilities and Helpers
//
// This file provides reusable helpers for Detox E2E tests.
// Mirrors TestIDs from src/constants/testIDs.ts for consistency.

import { by, device, element, expect, waitFor } from "detox";

// =============================================================================
// TEST USER CREDENTIALS
// =============================================================================

/**
 * E2E test user credentials.
 * These users must be seeded before running tests (npm run e2e:seed).
 */
export const TestUsers = {
  primary: {
    email: "e2e-primary@test.local",
    password: "E2eTestPassword123!",
    displayName: "E2E Primary User",
  },
  secondary: {
    email: "e2e-secondary@test.local",
    password: "E2eTestPassword123!",
    displayName: "E2E Secondary User",
  },
  friend: {
    email: "e2e-friend@test.local",
    password: "E2eTestPassword123!",
    displayName: "E2E Friend User",
  },
};

// =============================================================================
// TEST IDS (Mirrored from src/constants/testIDs.ts)
// =============================================================================

/**
 * Test IDs used by components. Keep in sync with src/constants/testIDs.ts.
 */
export const TestIDs = {
  screens: {
    login: "login-screen",
    signup: "signup-screen",
    home: "home-screen",
    challenges: "challenges-screen",
    friends: "friends-screen",
    profile: "profile-screen",
    settings: "settings-screen",
    createChallenge: "create-challenge-screen",
    challengeDetail: "challenge-detail-screen",
    notifications: "notifications-screen",
  },
  auth: {
    emailInput: "email-input",
    passwordInput: "password-input",
    signInButton: "signin-button",
    signUpLink: "signup-link",
    loginError: "login-error",
    usernameInput: "username-input",
    signUpButton: "signup-button",
    signInLink: "signin-link",
    signupError: "signup-error",
  },
  nav: {
    tabHome: "tab-home",
    tabChallenges: "tab-challenges",
    tabCreate: "tab-create",
    tabFriends: "tab-friends",
    tabProfile: "tab-profile",
    createChallengeFab: "create-challenge-fab",
    notificationBell: "notification-bell",
  },
  home: {
    streakBanner: "streak-banner",
    pendingInvitesSection: "pending-invites-section",
    activeChallengesSection: "active-challenges-section",
    emptyActiveChallenges: "empty-active-challenges",
    createFirstChallengeButton: "create-first-challenge-button",
    acceptInviteButton: (id: string) => `accept-invite-${id}`,
    declineInviteButton: (id: string) => `decline-invite-${id}`,
    activeChallengeCard: (id: string) => `active-challenge-${id}`,
  },
  createChallenge: {
    titleInput: "challenge-title-input",
    descriptionInput: "challenge-description-input",
    goalInput: "challenge-goal-input",
    typeSteps: "challenge-type-steps",
    typeActiveMinutes: "challenge-type-active_minutes",
    typeWorkouts: "challenge-type-workouts",
    typeDistance: "challenge-type-distance",
    typeCustom: "challenge-type-custom",
    duration7: "duration-7",
    duration14: "duration-14",
    duration30: "duration-30",
    createButton: "create-challenge-button",
    cancelButton: "cancel-create-button",
  },
  challengeDetail: {
    challengeTitle: "challenge-detail-title",
    progressCard: "progress-card",
    logActivityButton: "log-activity-button",
    inviteButton: "invite-button",
    leaveButton: "leave-challenge-button",
    cancelChallengeButton: "cancel-challenge-button",
    leaderboardSection: "leaderboard-section",
    leaderboardLocked: "leaderboard-locked",
  },
  logActivity: {
    modal: "log-activity-modal",
    valueInput: "activity-value-input",
    submitButton: "submit-activity-button",
    cancelButton: "cancel-activity-button",
    valueError: "activity-value-error",
    successMessage: "activity-logged-success",
  },
  invite: {
    modal: "invite-modal",
    searchInput: "user-search-input",
    closeButton: "close-modal-button",
    userResult: (id: string) => `user-result-${id}`,
    sendInviteButton: (id: string) => `send-invite-${id}`,
    inviteSentMessage: "invite-sent-message",
  },
  profile: {
    username: "profile-username",
    settingsButton: "settings-button",
  },
  settings: {
    signOutButton: "signout-button",
  },
  friends: {
    friendsList: "friends-list",
    pendingRequestsSection: "pending-requests-section",
    acceptFriendButton: (id: string) => `accept-friend-${id}`,
    addFriendButton: "add-friend-button",
  },
  common: {
    loadingIndicator: "loading-indicator",
    errorMessage: "error-message",
  },
};

// =============================================================================
// WAIT HELPERS
// =============================================================================

/**
 * Default timeout for wait operations (15 seconds).
 * Adjust based on network conditions and CI environment.
 */
const DEFAULT_TIMEOUT = 15000;

/**
 * Wait for an element to be visible on screen.
 */
export async function waitForElement(
  testID: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for an element to NOT be visible on screen.
 */
export async function waitForElementToDisappear(
  testID: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  await waitFor(element(by.id(testID)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for text to be visible on screen.
 */
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

/**
 * Tap an element by testID.
 */
export async function tap(testID: string): Promise<void> {
  await element(by.id(testID)).tap();
}

/**
 * Type text into an input by testID.
 */
export async function typeText(testID: string, text: string): Promise<void> {
  await element(by.id(testID)).typeText(text);
}

/**
 * Replace text in an input by testID.
 */
export async function replaceText(testID: string, text: string): Promise<void> {
  await element(by.id(testID)).replaceText(text);
}

/**
 * Clear text from an input by testID.
 */
export async function clearText(testID: string): Promise<void> {
  await element(by.id(testID)).clearText();
}

/**
 * Scroll down in a scrollable element.
 */
export async function scrollDown(testID: string, pixels = 200): Promise<void> {
  await element(by.id(testID)).scroll(pixels, "down");
}

/**
 * Scroll up in a scrollable element.
 */
export async function scrollUp(testID: string, pixels = 200): Promise<void> {
  await element(by.id(testID)).scroll(pixels, "up");
}

// =============================================================================
// AUTH FLOW HELPERS
// =============================================================================

/**
 * Perform a complete sign-in flow.
 * Assumes we start on the login screen.
 */
export async function signIn(email: string, password: string): Promise<void> {
  await waitForElement(TestIDs.screens.login);

  await typeText(TestIDs.auth.emailInput, email);
  await typeText(TestIDs.auth.passwordInput, password);
  await tap(TestIDs.auth.signInButton);

  // Wait for navigation to home screen
  await waitForElement(TestIDs.screens.home);
}

/**
 * Perform a complete sign-out flow.
 * Assumes we are logged in.
 */
export async function signOut(): Promise<void> {
  // Navigate to profile
  await tap(TestIDs.nav.tabProfile);
  await waitForElement(TestIDs.screens.profile);

  // Tap settings
  await tap(TestIDs.profile.settingsButton);
  await waitForElement(TestIDs.screens.settings);

  // Tap sign out
  await tap(TestIDs.settings.signOutButton);

  // Wait for login screen
  await waitForElement(TestIDs.screens.login);
}

/**
 * Ensure we're logged out and on the login screen.
 * Useful for test setup.
 */
export async function ensureLoggedOut(): Promise<void> {
  // Relaunch to clear state
  await device.launchApp({ newInstance: true });

  // Wait a bit for app to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check if we're on home screen (logged in)
  try {
    await waitFor(element(by.id(TestIDs.screens.home)))
      .toBeVisible()
      .withTimeout(5000);

    // We're logged in - sign out
    await signOut();
  } catch {
    // We're already on login screen (or auth screen)
    await waitForElement(TestIDs.screens.login, 10000);
  }
}

/**
 * Ensure we're logged in as the primary test user.
 */
export async function ensureLoggedIn(): Promise<void> {
  // Relaunch to get fresh state
  await device.launchApp({ newInstance: true });

  // Wait for app to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check if we're on login screen
  try {
    await waitFor(element(by.id(TestIDs.screens.login)))
      .toBeVisible()
      .withTimeout(5000);

    // We're logged out - sign in
    await signIn(TestUsers.primary.email, TestUsers.primary.password);
  } catch {
    // We might already be logged in - check for home screen
    await waitForElement(TestIDs.screens.home, 10000);
  }
}

// =============================================================================
// NAVIGATION HELPERS
// =============================================================================

/**
 * Navigate to a tab by its testID.
 */
export async function navigateToTab(
  tab: "home" | "challenges" | "create" | "friends" | "profile",
): Promise<void> {
  const tabIds = {
    home: TestIDs.nav.tabHome,
    challenges: TestIDs.nav.tabChallenges,
    create: TestIDs.nav.tabCreate,
    friends: TestIDs.nav.tabFriends,
    profile: TestIDs.nav.tabProfile,
  };

  await tap(tabIds[tab]);
}

// =============================================================================
// CHALLENGE HELPERS
// =============================================================================

/**
 * Create a challenge with the given parameters.
 * Assumes we're logged in and navigated to the create screen.
 */
export async function createChallenge(options: {
  title: string;
  type?: "steps" | "active_minutes" | "workouts" | "distance" | "custom";
  goal?: number;
  duration?: 7 | 14 | 30;
  description?: string;
}): Promise<void> {
  const {
    title,
    type = "steps",
    goal = 10000,
    duration = 7,
    description,
  } = options;

  // Wait for create screen
  await waitForElement(TestIDs.screens.createChallenge);

  // Enter title
  await typeText(TestIDs.createChallenge.titleInput, title);

  // Select challenge type
  const typeIds: Record<string, string> = {
    steps: TestIDs.createChallenge.typeSteps,
    active_minutes: TestIDs.createChallenge.typeActiveMinutes,
    workouts: TestIDs.createChallenge.typeWorkouts,
    distance: TestIDs.createChallenge.typeDistance,
    custom: TestIDs.createChallenge.typeCustom,
  };
  await tap(typeIds[type]);

  // Enter goal
  await clearText(TestIDs.createChallenge.goalInput);
  await typeText(TestIDs.createChallenge.goalInput, goal.toString());

  // Select duration
  const durationIds: Record<number, string> = {
    7: TestIDs.createChallenge.duration7,
    14: TestIDs.createChallenge.duration14,
    30: TestIDs.createChallenge.duration30,
  };
  await tap(durationIds[duration]);

  // Enter description if provided
  if (description) {
    await typeText(TestIDs.createChallenge.descriptionInput, description);
  }

  // Tap create
  await tap(TestIDs.createChallenge.createButton);

  // Wait for navigation to challenge detail
  await waitForElement(TestIDs.screens.challengeDetail);
}

/**
 * Log activity for the current challenge.
 * Assumes we're on the challenge detail screen.
 */
export async function logActivity(value: number): Promise<void> {
  // Tap log activity button
  await tap(TestIDs.challengeDetail.logActivityButton);

  // Wait for modal
  await waitForElement(TestIDs.logActivity.modal);

  // Enter value
  await clearText(TestIDs.logActivity.valueInput);
  await typeText(TestIDs.logActivity.valueInput, value.toString());

  // Submit
  await tap(TestIDs.logActivity.submitButton);

  // Wait for modal to close
  await waitForElementToDisappear(TestIDs.logActivity.modal);
}

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

/**
 * Assert an element is visible.
 */
export async function expectVisible(testID: string): Promise<void> {
  await expect(element(by.id(testID))).toBeVisible();
}

/**
 * Assert an element is NOT visible.
 */
export async function expectNotVisible(testID: string): Promise<void> {
  await expect(element(by.id(testID))).not.toBeVisible();
}

/**
 * Assert text is visible on screen.
 */
export async function expectTextVisible(text: string): Promise<void> {
  await expect(element(by.text(text))).toBeVisible();
}

/**
 * Assert an element has specific text.
 */
export async function expectText(testID: string, text: string): Promise<void> {
  await expect(element(by.id(testID))).toHaveText(text);
}

// =============================================================================
// CLEANUP HELPERS
// =============================================================================

/**
 * Generate a unique test identifier to avoid conflicts.
 */
export function generateTestId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Dismiss keyboard if visible.
 */
export async function dismissKeyboard(): Promise<void> {
  if (device.getPlatform() === "ios") {
    // Tap somewhere outside input fields
    await device.pressBack();
  } else {
    await device.pressBack();
  }
}

// =============================================================================
// RETRY HELPERS
// =============================================================================

/**
 * Retry an async operation with exponential backoff.
 * Useful for flaky operations in CI.
 */
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
