// e2e/tests/auth.e2e.ts
// ============================================
// Authentication E2E Tests
// ============================================
// Tests for login, signup, logout, and password reset flows.

import { device, element, by, expect } from "detox";
import {
  TEST_USERS,
  EXTENDED_TIMEOUT,
  waitForElement,
  tapElement,
  clearAndTypeText,
  assertVisible,
  assertTextVisible,
  resetAppState,
} from "../utils";
import {
  signIn,
  signInAsPrimaryUser,
  signUp,
  signUpNewUser,
  signOut,
  requestPasswordReset,
  assertFieldError,
  assertSignInError,
  ensureSignedOutState,
  skipOnboardingIfPresent,
} from "../utils/authHelpers";

describe("Authentication", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe("Sign In", () => {
    beforeEach(async () => {
      await ensureSignedOutState();
    });

    it("should sign in with valid credentials", async () => {
      await signInAsPrimaryUser();

      // Verify we're on the home screen
      await assertVisible("home-screen");
      await assertVisible("tab-challenges");
    });

    it("should show error for invalid email format", async () => {
      await waitForElement("login-screen");

      await clearAndTypeText("email-input", "invalid-email");
      await clearAndTypeText("password-input", "password123");
      await tapElement("sign-in-button");

      await assertFieldError("email-input", "Invalid email address");
    });

    it("should show error for wrong password", async () => {
      await waitForElement("login-screen");

      await clearAndTypeText("email-input", TEST_USERS.primary.email);
      await clearAndTypeText("password-input", "wrongpassword123");
      await tapElement("sign-in-button");

      await assertSignInError("Invalid login credentials");
    });

    it("should show error for non-existent user", async () => {
      await waitForElement("login-screen");

      await clearAndTypeText("email-input", "nonexistent@test.com");
      await clearAndTypeText("password-input", "anypassword123");
      await tapElement("sign-in-button");

      await assertSignInError("Invalid login credentials");
    });

    it("should navigate to signup screen", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");

      await assertVisible("signup-screen");
    });

    it("should navigate to forgot password screen", async () => {
      await waitForElement("login-screen");
      await tapElement("forgot-password-link");

      await assertVisible("forgot-password-screen");
    });
  });

  describe("Sign Up", () => {
    beforeEach(async () => {
      await ensureSignedOutState();
    });

    it("should sign up a new user", async () => {
      const { email, username } = await signUpNewUser();

      // Should be on onboarding or home screen
      try {
        await waitForElement("onboarding-screen", 5000);
        await skipOnboardingIfPresent();
      } catch {
        // Already on home screen
      }

      await assertVisible("home-screen");
    });

    it("should show error for existing email", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");
      await waitForElement("signup-screen");

      await clearAndTypeText("email-input", TEST_USERS.primary.email);
      await clearAndTypeText("username-input", "unique_username_123");
      await clearAndTypeText("password-input", "TestPass123!");
      await clearAndTypeText("confirm-password-input", "TestPass123!");
      await tapElement("sign-up-button");

      await assertTextVisible("already registered");
    });

    it("should show error for existing username", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");
      await waitForElement("signup-screen");

      const uniqueEmail = `unique-${Date.now()}@test.com`;
      await clearAndTypeText("email-input", uniqueEmail);
      await clearAndTypeText("username-input", TEST_USERS.primary.username);
      await clearAndTypeText("password-input", "TestPass123!");
      await clearAndTypeText("confirm-password-input", "TestPass123!");
      await tapElement("sign-up-button");

      await assertTextVisible("Username is already taken");
    });

    it("should show error for password mismatch", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");
      await waitForElement("signup-screen");

      await clearAndTypeText("email-input", "test@test.com");
      await clearAndTypeText("username-input", "testuser");
      await clearAndTypeText("password-input", "TestPass123!");
      await clearAndTypeText("confirm-password-input", "DifferentPass123!");
      await tapElement("sign-up-button");

      await assertFieldError(
        "confirm-password-input",
        "Passwords do not match",
      );
    });

    it("should show error for weak password", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");
      await waitForElement("signup-screen");

      await clearAndTypeText("email-input", "test@test.com");
      await clearAndTypeText("username-input", "testuser");
      await clearAndTypeText("password-input", "weak");
      await clearAndTypeText("confirm-password-input", "weak");
      await tapElement("sign-up-button");

      await assertFieldError("password-input");
    });

    it("should show error for invalid username format", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");
      await waitForElement("signup-screen");

      await clearAndTypeText("email-input", "test@test.com");
      await clearAndTypeText("username-input", "invalid username!");
      await clearAndTypeText("password-input", "TestPass123!");
      await clearAndTypeText("confirm-password-input", "TestPass123!");
      await tapElement("sign-up-button");

      await assertFieldError(
        "username-input",
        "Letters, numbers, and underscores only",
      );
    });

    it("should navigate back to login screen", async () => {
      await waitForElement("login-screen");
      await tapElement("go-to-signup-link");
      await waitForElement("signup-screen");

      await tapElement("go-to-login-link");

      await assertVisible("login-screen");
    });
  });

  describe("Sign Out", () => {
    beforeEach(async () => {
      // Ensure we're signed in first
      try {
        await waitForElement("home-screen", 3000);
      } catch {
        await signInAsPrimaryUser();
      }
    });

    it("should sign out successfully", async () => {
      await signOut();

      // Verify we're on the login screen
      await assertVisible("login-screen");
    });

    it("should clear session after sign out", async () => {
      await signOut();

      // Reload app
      await device.reloadReactNative();

      // Should still be on login screen (session cleared)
      await waitForElement("login-screen", EXTENDED_TIMEOUT);
    });
  });

  describe("Password Reset", () => {
    beforeEach(async () => {
      await ensureSignedOutState();
    });

    it("should request password reset for valid email", async () => {
      await waitForElement("login-screen");
      await tapElement("forgot-password-link");
      await waitForElement("forgot-password-screen");

      await clearAndTypeText("email-input", TEST_USERS.primary.email);
      await tapElement("reset-password-button");

      // Should show success message
      await assertVisible("reset-email-sent-message");
      await assertTextVisible("Check your email");
    });

    it("should show error for invalid email format", async () => {
      await waitForElement("login-screen");
      await tapElement("forgot-password-link");
      await waitForElement("forgot-password-screen");

      await clearAndTypeText("email-input", "invalid-email");
      await tapElement("reset-password-button");

      await assertFieldError("email-input", "Invalid email address");
    });

    it("should navigate back to login screen", async () => {
      await waitForElement("login-screen");
      await tapElement("forgot-password-link");
      await waitForElement("forgot-password-screen");

      await tapElement("back-to-login-link");

      await assertVisible("login-screen");
    });
  });

  describe("Session Persistence", () => {
    it("should persist session across app restarts", async () => {
      // Sign in
      await ensureSignedOutState();
      await signInAsPrimaryUser();
      await assertVisible("home-screen");

      // Restart app
      await device.launchApp({ newInstance: false });

      // Should still be on home screen (session persisted)
      await waitForElement("home-screen", EXTENDED_TIMEOUT);
    });

    it("should persist session after background/foreground", async () => {
      // Ensure signed in
      try {
        await waitForElement("home-screen", 3000);
      } catch {
        await signInAsPrimaryUser();
      }

      // Send to background
      await device.sendToHome();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Bring back to foreground
      await device.launchApp({ newInstance: false });

      // Should still be on home screen
      await waitForElement("home-screen", EXTENDED_TIMEOUT);
    });
  });
});
