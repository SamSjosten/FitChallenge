// e2e/auth.e2e.ts
// Authentication E2E Tests
//
// Tests the complete auth flow: welcome → auth → home → signout → welcome
//
// VERIFIED TESTIDS USED:
//   welcome-screen, get-started-button, welcome-sign-in-link
//   login-screen, email-input, password-input, username-input
//   signin-button, signup-button, signup-mode-button, signin-mode-button
//   login-error, home-screen-v2, settings-screen, signout-button
//
// PREREQUISITES:
//   - E2E test users seeded (npm run e2e:seed)
//   - Dev build installed on device/simulator

import { by, device, element, expect, waitFor } from "detox";
import {
  TestIDs,
  TestUsers,
  waitForElement,
  signIn,
  signOut,
  launchApp,
} from "./setup";

describe("Authentication", () => {
  beforeAll(async () => {
    await launchApp({ newInstance: true, delete: true });
  });

  describe("Welcome Screen", () => {
    beforeEach(async () => {
      await launchApp({ newInstance: true, delete: true });
      await waitForElement(TestIDs.screens.welcome, 10000);
    });

    it("shows welcome screen on fresh launch", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await expect(element(by.id(TestIDs.screens.welcome))).toBeVisible();
    });

    it("has Get Started button", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await expect(element(by.id(TestIDs.welcome.getStartedButton))).toBeVisible();
    });

    it("has Sign In link", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await expect(element(by.id(TestIDs.welcome.signInLink))).toBeVisible();
    });

    it("Get Started navigates to auth in signup mode", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await element(by.id(TestIDs.welcome.getStartedButton)).tap();

      // Wait for auth screen (500ms exit animation from welcome)
      await waitForElement(TestIDs.screens.login, 5000);

      // Verify signup mode is active — the username field should be visible
      await expect(element(by.id(TestIDs.auth.usernameInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.signUpButton))).toBeVisible();
    });

    it("Sign In link navigates to auth in signin mode", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await element(by.id(TestIDs.welcome.signInLink)).tap();

      // Wait for auth screen (400ms exit animation from welcome)
      await waitForElement(TestIDs.screens.login, 5000);

      // Verify signin mode — username field should NOT exist (conditionally rendered)
      await expect(element(by.id(TestIDs.auth.usernameInput))).not.toExist();
      await expect(element(by.id(TestIDs.auth.signInButton))).toBeVisible();
    });
  });

  describe("Auth Screen — Mode Toggle", () => {
    beforeEach(async () => {
      await launchApp({ newInstance: true, delete: true });
      await waitForElement(TestIDs.screens.welcome, 10000);
      await element(by.id(TestIDs.welcome.signInLink)).tap();
      await waitForElement(TestIDs.screens.login, 5000);
    });

    it("can switch from signin to signup mode", async () => {
      // Start in signin mode — no username field
      await expect(element(by.id(TestIDs.auth.usernameInput))).not.toExist();

      // Switch to signup mode
      await element(by.id(TestIDs.auth.signupModeButton)).tap();

      // Username field appears, button changes
      await expect(element(by.id(TestIDs.auth.usernameInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.signUpButton))).toBeVisible();
    });

    it("can switch from signup to signin mode", async () => {
      // Switch to signup first
      await element(by.id(TestIDs.auth.signupModeButton)).tap();
      await expect(element(by.id(TestIDs.auth.usernameInput))).toBeVisible();

      // Switch back to signin
      await element(by.id(TestIDs.auth.signinModeButton)).tap();
      await expect(element(by.id(TestIDs.auth.usernameInput))).not.toExist();
      await expect(element(by.id(TestIDs.auth.signInButton))).toBeVisible();
    });
  });

  describe("Sign In Flow", () => {
    beforeEach(async () => {
      await launchApp({ newInstance: true, delete: true });
      await waitForElement(TestIDs.screens.welcome, 10000);
    });

    it("successfully signs in with valid credentials", async () => {
      await signIn(TestUsers.primary.email, TestUsers.primary.password);

      // Verify we're on home screen
      await expect(element(by.id(TestIDs.screensV2.home))).toBeVisible();
    });

    it("shows error for invalid credentials", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await element(by.id(TestIDs.welcome.signInLink)).tap();
      await waitForElement(TestIDs.screens.login, 5000);

      // Enter invalid credentials
      await element(by.id(TestIDs.auth.emailInput)).replaceText("wrong@test.local");
      await element(by.id(TestIDs.auth.passwordInput)).replaceText("WrongPassword123!");
      await element(by.id(TestIDs.auth.signInButton)).tap();

      // Should see an error (either login-error banner or Alert)
      // The auth screen shows Alert.alert on error, which is a system dialog
      await waitFor(element(by.text("Error")))
        .toBeVisible()
        .withTimeout(10000);
    });

    it("shows error for empty fields", async () => {
      await waitForElement(TestIDs.screens.welcome, 10000);
      await element(by.id(TestIDs.welcome.signInLink)).tap();
      await waitForElement(TestIDs.screens.login, 5000);

      // Tap submit without entering anything
      await element(by.id(TestIDs.auth.signInButton)).tap();

      // Zod validation should fire and show field-level errors.
      // signInSchema requires: email (valid format) and password (min 1 char).
      // Assert: still on auth screen AND validation error appeared.
      await expect(element(by.id(TestIDs.screens.login))).toBeVisible();
      await waitFor(element(by.text("Password is required")))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe("Sign Out Flow", () => {
    beforeEach(async () => {
      await launchApp({ newInstance: true, delete: true });
      await waitForElement(TestIDs.screens.welcome, 10000);
      await signIn(TestUsers.primary.email, TestUsers.primary.password);
    });

    it("successfully signs out and returns to welcome", async () => {
      await signOut();
      await expect(element(by.id(TestIDs.screens.welcome))).toBeVisible();
    });
  });

  describe("Session Persistence", () => {
    it("stays logged in after app relaunch", async () => {
      // Sign in first
      await launchApp({ newInstance: true, delete: true });
      await waitForElement(TestIDs.screens.welcome, 10000);
      await signIn(TestUsers.primary.email, TestUsers.primary.password);

      // Relaunch WITHOUT deleting — session should persist
      await launchApp({ newInstance: true });

      // Should go straight to home, not welcome
      await waitForElement(TestIDs.screensV2.home, 10000);
    });
  });
});
