// e2e/utils/testHelpers.ts
// ============================================
// E2E Test Helper Utilities
// ============================================
// Common utilities for Detox E2E tests.

import { device, element, by, expect, waitFor } from "detox";

// =============================================================================
// TEST USER CONFIGURATION
// =============================================================================

/**
 * Test user credentials for E2E testing.
 * These accounts are created specifically for E2E tests.
 */
export const TEST_USERS = {
  primary: {
    email: "e2e-primary@fitchallenge-test.com",
    password: "TestPass123!",
    username: "e2e_primary_user",
  },
  secondary: {
    email: "e2e-secondary@fitchallenge-test.com",
    password: "TestPass123!",
    username: "e2e_secondary_user",
  },
  newUser: {
    // For signup tests - uses timestamp to ensure uniqueness
    getEmail: () => `e2e-new-${Date.now()}@fitchallenge-test.com`,
    password: "TestPass123!",
    getUsername: () => `e2e_new_${Date.now()}`,
  },
};

// =============================================================================
// WAIT HELPERS
// =============================================================================

/**
 * Default timeout for waitFor operations (10 seconds)
 */
export const DEFAULT_TIMEOUT = 10000;

/**
 * Short timeout for quick checks (3 seconds)
 */
export const SHORT_TIMEOUT = 3000;

/**
 * Extended timeout for slow operations (30 seconds)
 */
export const EXTENDED_TIMEOUT = 30000;

/**
 * Wait for an element to be visible
 */
export async function waitForElement(
  testID: string,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<void> {
  // Type assertion needed for Detox 20.x type definitions
  await (waitFor(element(by.id(testID))) as any)
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for an element to disappear
 */
export async function waitForElementToDisappear(
  testID: string,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<void> {
  // Type assertion needed for Detox 20.x type definitions
  await (waitFor(element(by.id(testID))) as any).not
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Wait for text to be visible
 */
export async function waitForText(
  text: string,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<void> {
  // Type assertion needed for Detox 20.x type definitions
  await (waitFor(element(by.text(text))) as any)
    .toBeVisible()
    .withTimeout(timeout);
}

// =============================================================================
// TAP HELPERS
// =============================================================================

/**
 * Tap an element by testID
 */
export async function tapElement(testID: string): Promise<void> {
  await element(by.id(testID)).tap();
}

/**
 * Tap an element by text
 */
export async function tapText(text: string): Promise<void> {
  await element(by.text(text)).tap();
}

/**
 * Long press an element by testID
 */
export async function longPressElement(
  testID: string,
  duration: number = 1000,
): Promise<void> {
  await element(by.id(testID)).longPress(duration);
}

// =============================================================================
// INPUT HELPERS
// =============================================================================

/**
 * Type text into an input field
 */
export async function typeText(testID: string, text: string): Promise<void> {
  await element(by.id(testID)).typeText(text);
}

/**
 * Clear and type text into an input field
 */
export async function clearAndTypeText(
  testID: string,
  text: string,
): Promise<void> {
  await element(by.id(testID)).clearText();
  await element(by.id(testID)).typeText(text);
}

/**
 * Replace text in an input field (clear + type in one action)
 */
export async function replaceText(testID: string, text: string): Promise<void> {
  await element(by.id(testID)).replaceText(text);
}

// =============================================================================
// SCROLL HELPERS
// =============================================================================

/**
 * Scroll down within a scrollable element
 */
export async function scrollDown(
  testID: string,
  pixels: number = 300,
): Promise<void> {
  await element(by.id(testID)).scroll(pixels, "down");
}

/**
 * Scroll up within a scrollable element
 */
export async function scrollUp(
  testID: string,
  pixels: number = 300,
): Promise<void> {
  await element(by.id(testID)).scroll(pixels, "up");
}

/**
 * Scroll to an element within a scrollable container
 */
export async function scrollToElement(
  containerTestID: string,
  elementTestID: string,
  direction: "down" | "up" = "down",
): Promise<void> {
  // Type assertion needed for Detox 20.x type definitions
  await (waitFor(element(by.id(elementTestID))) as any)
    .toBeVisible()
    .whileElement(by.id(containerTestID))
    .scroll(200, direction);
}

// =============================================================================
// SWIPE HELPERS
// =============================================================================

/**
 * Swipe left on an element
 */
export async function swipeLeft(
  testID: string,
  speed: "slow" | "fast" = "fast",
): Promise<void> {
  await element(by.id(testID)).swipe("left", speed);
}

/**
 * Swipe right on an element
 */
export async function swipeRight(
  testID: string,
  speed: "slow" | "fast" = "fast",
): Promise<void> {
  await element(by.id(testID)).swipe("right", speed);
}

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

/**
 * Assert an element is visible
 */
export async function assertVisible(testID: string): Promise<void> {
  await expect(element(by.id(testID))).toBeVisible();
}

/**
 * Assert an element is not visible
 */
export async function assertNotVisible(testID: string): Promise<void> {
  await expect(element(by.id(testID))).not.toBeVisible();
}

/**
 * Assert text is visible on screen
 */
export async function assertTextVisible(text: string): Promise<void> {
  await expect(element(by.text(text))).toBeVisible();
}

/**
 * Assert an element exists (may not be visible)
 */
export async function assertExists(testID: string): Promise<void> {
  await expect(element(by.id(testID))).toExist();
}

/**
 * Assert an element has specific text
 */
export async function assertHasText(
  testID: string,
  text: string,
): Promise<void> {
  await expect(element(by.id(testID))).toHaveText(text);
}

// =============================================================================
// DEVICE HELPERS
// =============================================================================

/**
 * Take a screenshot with a custom name
 */
export async function takeScreenshot(name: string): Promise<void> {
  await device.takeScreenshot(name);
}

/**
 * Send app to background and bring back
 */
export async function backgroundAndForeground(
  backgroundSeconds: number = 2,
): Promise<void> {
  await device.sendToHome();
  await new Promise((resolve) => setTimeout(resolve, backgroundSeconds * 1000));
  await device.launchApp({ newInstance: false });
}

/**
 * Shake the device (useful for triggering dev menu in debug)
 */
export async function shakeDevice(): Promise<void> {
  await device.shake();
}

/**
 * Set device orientation
 */
export async function setOrientation(
  orientation: "portrait" | "landscape",
): Promise<void> {
  await device.setOrientation(orientation);
}

// =============================================================================
// KEYBOARD HELPERS
// =============================================================================

/**
 * Dismiss the keyboard
 */
export async function dismissKeyboard(): Promise<void> {
  if (device.getPlatform() === "ios") {
    // iOS: Tap outside or use specific dismiss action
    await element(by.id("keyboard-dismiss-area"))
      .tap()
      .catch(() => {
        // Fallback: try tapping at top of screen
      });
  } else {
    // Android: Press back button
    await device.pressBack();
  }
}

// =============================================================================
// NETWORK HELPERS
// =============================================================================

/**
 * Simulate offline mode (iOS only currently)
 */
export async function goOffline(): Promise<void> {
  if (device.getPlatform() === "ios") {
    await device.setURLBlacklist([".*"]);
  }
}

/**
 * Restore online mode
 */
export async function goOnline(): Promise<void> {
  if (device.getPlatform() === "ios") {
    await device.setURLBlacklist([]);
  }
}

// =============================================================================
// CLEANUP HELPERS
// =============================================================================

/**
 * Reset app state (clear storage, restart app)
 */
export async function resetAppState(): Promise<void> {
  await device.clearKeychain();
  await device.launchApp({ delete: true });
}

/**
 * Sign out if signed in (navigates to logout if needed)
 */
export async function ensureSignedOut(): Promise<void> {
  try {
    // Check if we're on a screen that indicates we're logged in
    await expect(element(by.id("tab-profile"))).toBeVisible();

    // If we get here, we're logged in - proceed to sign out
    await tapElement("tab-profile");
    await waitForElement("settings-button");
    await tapElement("settings-button");
    await scrollToElement("settings-scroll", "sign-out-button", "down");
    await tapElement("sign-out-button");
    await tapText("Sign Out"); // Confirm dialog
  } catch {
    // Already signed out or on auth screen
  }
}
