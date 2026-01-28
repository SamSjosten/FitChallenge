// e2e/utils/authHelpers.ts
// ============================================
// E2E Authentication Helper Utilities
// ============================================
// Helpers for authentication flows in E2E tests.

import { device, element, by, expect, waitFor } from "detox";
import {
  TEST_USERS,
  waitForElement,
  tapElement,
  typeText,
  clearAndTypeText,
  assertVisible,
  assertTextVisible,
  DEFAULT_TIMEOUT,
  EXTENDED_TIMEOUT,
} from "./testHelpers";

// =============================================================================
// SIGN IN HELPERS
// =============================================================================

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<void> {
  // Wait for login screen
  await waitForElement("login-screen", EXTENDED_TIMEOUT);

  // Enter credentials
  await clearAndTypeText("email-input", email);
  await clearAndTypeText("password-input", password);

  // Tap sign in button
  await tapElement("sign-in-button");

  // Wait for home screen (indicates successful login)
  await waitForElement("home-screen", EXTENDED_TIMEOUT);
}

/**
 * Sign in with the primary test user
 */
export async function signInAsPrimaryUser(): Promise<void> {
  await signIn(TEST_USERS.primary.email, TEST_USERS.primary.password);
}

/**
 * Sign in with the secondary test user
 */
export async function signInAsSecondaryUser(): Promise<void> {
  await signIn(TEST_USERS.secondary.email, TEST_USERS.secondary.password);
}

// =============================================================================
// SIGN UP HELPERS
// =============================================================================

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string,
  username: string,
): Promise<void> {
  // Navigate to signup screen if not already there
  try {
    await waitForElement("signup-screen", 2000);
  } catch {
    await waitForElement("login-screen");
    await tapElement("go-to-signup-link");
    await waitForElement("signup-screen");
  }

  // Enter signup details
  await clearAndTypeText("email-input", email);
  await clearAndTypeText("username-input", username);
  await clearAndTypeText("password-input", password);
  await clearAndTypeText("confirm-password-input", password);

  // Accept terms (if checkbox exists)
  try {
    await tapElement("terms-checkbox");
  } catch {
    // Terms might be accepted differently or not required
  }

  // Tap sign up button
  await tapElement("sign-up-button");

  // Wait for onboarding or home screen
  await waitForElement("onboarding-screen", EXTENDED_TIMEOUT).catch(() =>
    waitForElement("home-screen", EXTENDED_TIMEOUT),
  );
}

/**
 * Sign up with a new unique test user
 * Returns the generated credentials
 */
export async function signUpNewUser(): Promise<{
  email: string;
  password: string;
  username: string;
}> {
  const email = TEST_USERS.newUser.getEmail();
  const username = TEST_USERS.newUser.getUsername();
  const password = TEST_USERS.newUser.password;

  await signUp(email, password, username);

  return { email, password, username };
}

// =============================================================================
// SIGN OUT HELPERS
// =============================================================================

/**
 * Sign out from the app
 */
export async function signOut(): Promise<void> {
  // Navigate to profile/settings
  await tapElement("tab-profile");
  await waitForElement("profile-screen");

  // Go to settings
  await tapElement("settings-button");
  await waitForElement("settings-screen");

  // Find and tap sign out
  await tapElement("sign-out-button");

  // Confirm sign out in dialog (if present)
  try {
    await waitForElement("sign-out-confirm-button", 2000);
    await tapElement("sign-out-confirm-button");
  } catch {
    // No confirmation dialog
  }

  // Wait for login screen
  await waitForElement("login-screen", EXTENDED_TIMEOUT);
}

// =============================================================================
// PASSWORD RESET HELPERS
// =============================================================================

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Navigate to forgot password screen
  await waitForElement("login-screen");
  await tapElement("forgot-password-link");
  await waitForElement("forgot-password-screen");

  // Enter email
  await clearAndTypeText("email-input", email);

  // Submit request
  await tapElement("reset-password-button");

  // Wait for confirmation
  await waitForElement("reset-email-sent-message", DEFAULT_TIMEOUT);
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Assert validation error is shown for a field
 */
export async function assertFieldError(
  fieldTestID: string,
  errorMessage?: string,
): Promise<void> {
  const errorTestID = `${fieldTestID}-error`;
  await assertVisible(errorTestID);

  if (errorMessage) {
    await expect(element(by.id(errorTestID))).toHaveText(errorMessage);
  }
}

/**
 * Assert sign in error message is shown
 */
export async function assertSignInError(message?: string): Promise<void> {
  await assertVisible("sign-in-error");
  if (message) {
    await assertTextVisible(message);
  }
}

/**
 * Assert sign up error message is shown
 */
export async function assertSignUpError(message?: string): Promise<void> {
  await assertVisible("sign-up-error");
  if (message) {
    await assertTextVisible(message);
  }
}

// =============================================================================
// STATE HELPERS
// =============================================================================

/**
 * Check if user is currently signed in
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    await waitForElement("home-screen", 3000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure app is in signed-out state before test
 */
export async function ensureSignedOutState(): Promise<void> {
  const signedIn = await isSignedIn();
  if (signedIn) {
    await signOut();
  }
}

/**
 * Ensure user is signed in before test
 * Signs in with primary user if not already signed in
 */
export async function ensureSignedInState(): Promise<void> {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    await signInAsPrimaryUser();
  }
}

// =============================================================================
// ONBOARDING HELPERS
// =============================================================================

/**
 * Complete onboarding flow (after signup)
 */
export async function completeOnboarding(): Promise<void> {
  // Wait for onboarding screen
  await waitForElement("onboarding-screen", DEFAULT_TIMEOUT).catch(() => {
    // Already past onboarding
    return;
  });

  // Skip or complete onboarding steps
  try {
    // Try to find skip button
    await tapElement("skip-onboarding-button");
  } catch {
    // Complete each step
    for (let i = 0; i < 4; i++) {
      try {
        await tapElement("onboarding-next-button");
      } catch {
        break;
      }
    }

    try {
      await tapElement("onboarding-complete-button");
    } catch {
      // Already complete
    }
  }

  // Should now be on home screen
  await waitForElement("home-screen", DEFAULT_TIMEOUT);
}

/**
 * Skip onboarding if present
 */
export async function skipOnboardingIfPresent(): Promise<void> {
  try {
    await waitForElement("onboarding-screen", 2000);
    await tapElement("skip-onboarding-button");
    await waitForElement("home-screen", DEFAULT_TIMEOUT);
  } catch {
    // Not on onboarding screen
  }
}
