// e2e/auth.e2e.ts
// Authentication E2E Tests
//
// Tests the complete authentication flows:
// - Sign in with valid credentials
// - Sign in with invalid credentials
// - Sign out
// - Session persistence across app restarts

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
  signOut,
  ensureLoggedOut,
} from "./setup";

describe("Authentication", () => {
  // ==========================================================================
  // SETUP
  // ==========================================================================

  beforeAll(async () => {
    // Start fresh - ensure logged out
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    // Reset to logged out state before each test
    await ensureLoggedOut();
  });

  // ==========================================================================
  // SIGN IN TESTS
  // ==========================================================================

  describe("Sign In", () => {
    it("should display the login screen on app launch when logged out", async () => {
      // Verify login screen elements are visible
      await waitForElement(TestIDs.screens.login);
      await expect(element(by.id(TestIDs.auth.emailInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.passwordInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.signInButton))).toBeVisible();
    });

    it("should sign in successfully with valid credentials", async () => {
      await waitForElement(TestIDs.screens.login);

      // Enter credentials
      await typeText(TestIDs.auth.emailInput, TestUsers.primary.email);
      await typeText(TestIDs.auth.passwordInput, TestUsers.primary.password);

      // Tap sign in
      await tap(TestIDs.auth.signInButton);

      // Verify navigation to home screen
      await waitForElement(TestIDs.screens.home, 20000);
      await expect(element(by.id(TestIDs.screens.home))).toBeVisible();
    });

    it("should show error message with invalid credentials", async () => {
      await waitForElement(TestIDs.screens.login);

      // Enter invalid credentials
      await typeText(TestIDs.auth.emailInput, "invalid@example.com");
      await typeText(TestIDs.auth.passwordInput, "wrongpassword");

      // Tap sign in
      await tap(TestIDs.auth.signInButton);

      // Verify error is shown (wait for network request)
      await waitForElement(TestIDs.auth.loginError, 10000);
      await expect(element(by.id(TestIDs.auth.loginError))).toBeVisible();
    });

    it("should show validation error for empty email", async () => {
      await waitForElement(TestIDs.screens.login);

      // Enter only password
      await typeText(TestIDs.auth.passwordInput, "somepassword");

      // Tap sign in
      await tap(TestIDs.auth.signInButton);

      // Should show validation error
      await waitForText("Invalid email");
    });

    it("should show validation error for invalid email format", async () => {
      await waitForElement(TestIDs.screens.login);

      // Enter invalid email format
      await typeText(TestIDs.auth.emailInput, "notanemail");
      await typeText(TestIDs.auth.passwordInput, "somepassword");

      // Tap sign in
      await tap(TestIDs.auth.signInButton);

      // Should show validation error
      await waitForText("Invalid email");
    });
  });

  // ==========================================================================
  // SIGN OUT TESTS
  // ==========================================================================

  describe("Sign Out", () => {
    beforeEach(async () => {
      // Sign in first
      await signIn(TestUsers.primary.email, TestUsers.primary.password);
    });

    it("should sign out successfully and return to login screen", async () => {
      // Verify we're on home screen
      await expect(element(by.id(TestIDs.screens.home))).toBeVisible();

      // Perform sign out
      await signOut();

      // Verify we're back on login screen
      await expect(element(by.id(TestIDs.screens.login))).toBeVisible();
    });
  });

  // ==========================================================================
  // SESSION PERSISTENCE TESTS
  // ==========================================================================

  describe("Session Persistence", () => {
    it("should persist session after app restart", async () => {
      // Sign in
      await signIn(TestUsers.primary.email, TestUsers.primary.password);

      // Verify we're on home screen
      await expect(element(by.id(TestIDs.screens.home))).toBeVisible();

      // Restart the app (not a new instance - keeps storage)
      await device.launchApp({ newInstance: false });

      // Wait for app to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Should still be on home screen (session persisted)
      await waitForElement(TestIDs.screens.home, 15000);
      await expect(element(by.id(TestIDs.screens.home))).toBeVisible();
    });

    it("should require re-login after signing out and restarting", async () => {
      // Sign in
      await signIn(TestUsers.primary.email, TestUsers.primary.password);

      // Sign out
      await signOut();

      // Restart the app
      await device.launchApp({ newInstance: false });

      // Wait for app to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Should be on login screen
      await waitForElement(TestIDs.screens.login, 15000);
      await expect(element(by.id(TestIDs.screens.login))).toBeVisible();
    });
  });

  // ==========================================================================
  // NAVIGATION TO SIGN UP
  // ==========================================================================

  describe("Sign Up Navigation", () => {
    it("should navigate to sign up screen when tapping sign up link", async () => {
      await waitForElement(TestIDs.screens.login);

      // Tap sign up link
      await tap(TestIDs.auth.signUpLink);

      // Verify navigation to sign up screen
      await waitForElement(TestIDs.screens.signup);
      await expect(element(by.id(TestIDs.auth.usernameInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.signUpButton))).toBeVisible();
    });

    it("should navigate back to sign in from sign up screen", async () => {
      await waitForElement(TestIDs.screens.login);

      // Go to sign up
      await tap(TestIDs.auth.signUpLink);
      await waitForElement(TestIDs.screens.signup);

      // Tap sign in link
      await tap(TestIDs.auth.signInLink);

      // Verify we're back on login
      await waitForElement(TestIDs.screens.login);
      await expect(element(by.id(TestIDs.auth.signInButton))).toBeVisible();
    });
  });
});
