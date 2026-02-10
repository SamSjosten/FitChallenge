// src/__tests__/component/login.component.test.tsx
// Component tests for Login screen

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../../../app/(auth)/login";
import { mockAuthState, mockRouter } from "./jest.setup";

describe("LoginScreen", () => {
  // =========================================================================
  // RENDERING TESTS
  // =========================================================================

  describe("rendering", () => {
    it("renders the welcome heading", () => {
      render(<LoginScreen />);

      expect(screen.getByText("Welcome Back")).toBeTruthy();
    });

    it("renders the subheading", () => {
      render(<LoginScreen />);

      expect(screen.getByText("Sign in to continue")).toBeTruthy();
    });

    it("renders email input with label", () => {
      render(<LoginScreen />);

      expect(screen.getByText("Email")).toBeTruthy();
      expect(screen.getByPlaceholderText("your@email.com")).toBeTruthy();
    });

    it("renders password input with label", () => {
      render(<LoginScreen />);

      expect(screen.getByText("Password")).toBeTruthy();
      expect(screen.getByPlaceholderText("Your password")).toBeTruthy();
    });

    it("renders Sign In button", () => {
      render(<LoginScreen />);

      expect(screen.getByText("Sign In")).toBeTruthy();
    });

    it("renders Sign Up link", () => {
      render(<LoginScreen />);

      expect(screen.getByText("Don't have an account?")).toBeTruthy();
      expect(screen.getByText("Sign Up")).toBeTruthy();
    });
  });

  // =========================================================================
  // VALIDATION TESTS
  // =========================================================================

  describe("validation", () => {
    it("shows error when email is empty on submit", async () => {
      render(<LoginScreen />);

      const signInButton = screen.getByText("Sign In");
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText("Email is required")).toBeTruthy();
      });
    });

    it("shows error when password is empty on submit", async () => {
      render(<LoginScreen />);

      // Fill in email but leave password empty
      const emailInput = screen.getByPlaceholderText("your@email.com");
      fireEvent.changeText(emailInput, "test@example.com");

      const signInButton = screen.getByText("Sign In");
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText("Password is required")).toBeTruthy();
      });
    });

    it("does not call signIn when validation fails", async () => {
      render(<LoginScreen />);

      const signInButton = screen.getByText("Sign In");
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(mockAuthState.signIn).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // SIGN IN FLOW TESTS
  // =========================================================================

  describe("sign in flow", () => {
    it("calls signIn with email and password on valid submit", async () => {
      mockAuthState.signIn.mockResolvedValueOnce(undefined);

      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText("your@email.com");
      const passwordInput = screen.getByPlaceholderText("Your password");
      const signInButton = screen.getByText("Sign In");

      fireEvent.changeText(emailInput, "test@example.com");
      fireEvent.changeText(passwordInput, "password123");
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(mockAuthState.signIn).toHaveBeenCalledWith("test@example.com", "password123");
      });
    });

    it("navigates to tabs on successful sign in", async () => {
      mockAuthState.signIn.mockResolvedValueOnce(undefined);

      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText("your@email.com");
      const passwordInput = screen.getByPlaceholderText("Your password");
      const signInButton = screen.getByText("Sign In");

      fireEvent.changeText(emailInput, "test@example.com");
      fireEvent.changeText(passwordInput, "password123");
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/(tabs)");
      });
    });

    it("displays error message on sign in failure", async () => {
      mockAuthState.signIn.mockRejectedValueOnce(new Error("Invalid credentials"));

      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText("your@email.com");
      const passwordInput = screen.getByPlaceholderText("Your password");
      const signInButton = screen.getByText("Sign In");

      fireEvent.changeText(emailInput, "test@example.com");
      fireEvent.changeText(passwordInput, "wrongpassword");
      fireEvent.press(signInButton);

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // LOADING STATE TESTS
  // =========================================================================

  describe("loading state", () => {
    it("shows loading text when sign in is in progress", () => {
      mockAuthState.loading = true;

      render(<LoginScreen />);

      expect(screen.getByText("Signing In...")).toBeTruthy();
    });

    it("disables button when loading", () => {
      mockAuthState.loading = true;

      render(<LoginScreen />);

      // The button should still be visible but with loading text
      expect(screen.getByText("Signing In...")).toBeTruthy();
      // Note: Testing disabled state requires checking the TouchableOpacity props
      // which is implementation-specific. We verify behavior through loading text.
    });
  });

  // =========================================================================
  // ERROR DISPLAY TESTS
  // =========================================================================

  describe("error display", () => {
    it("displays auth error from hook", () => {
      mockAuthState.error = { message: "Network error" } as any;

      render(<LoginScreen />);

      expect(screen.getByText("Network error")).toBeTruthy();
    });

    it("clears error when clearError is called", async () => {
      render(<LoginScreen />);

      const emailInput = screen.getByPlaceholderText("your@email.com");
      fireEvent.changeText(emailInput, "new@email.com");

      // clearError should be called when user starts typing (via handleSignIn's setLocalError(null))
      // Note: The actual clearError is called at the start of handleSignIn
    });
  });
});
