// src/__tests__/component-integration/challengeCreate.integration.test.tsx
// Integration component tests for Create Challenge screen
//
// These tests verify that the create challenge screen renders correctly
// with real providers. Validation and form submission tests are excluded
// due to complex async interactions with the test environment.

import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import CreateChallengeScreen from "../../../app/challenge/create";
import { mockSupabaseClient, TestWrapper } from "./jest.setup";
import { seedAuthenticatedUser } from "./mockSupabaseClient";

// =============================================================================
// TEST SETUP
// =============================================================================

function setupAuthenticatedState() {
  const { profile, session } = seedAuthenticatedUser(mockSupabaseClient);
  mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });
  return { profile, session };
}

// =============================================================================
// TESTS
// =============================================================================

describe("CreateChallengeScreen Integration", () => {
  beforeEach(() => {
    setupAuthenticatedState();
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders activity type icons", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("👟")).toBeTruthy(); // Steps
        expect(screen.getByText("⏱️")).toBeTruthy(); // Active Minutes
        expect(screen.getByText("💪")).toBeTruthy(); // Workouts
        expect(screen.getByText("🏃")).toBeTruthy(); // Distance
        expect(screen.getByText("✨")).toBeTruthy(); // Custom
      });
    });

    it("renders activity type labels", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Steps")).toBeTruthy();
        expect(screen.getByText("Active Minutes")).toBeTruthy();
        expect(screen.getByText("Workouts")).toBeTruthy();
        expect(screen.getByText("Distance")).toBeTruthy();
        // Note: "Custom" appears twice (activity type and duration preset)
        // so we verify indirectly through the icon test above
      });
    });

    it("renders duration preset buttons", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("7 days")).toBeTruthy();
        expect(screen.getByText("14 days")).toBeTruthy();
        expect(screen.getByText("30 days")).toBeTruthy();
      });
    });

    it("renders Challenge Summary card", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Challenge Summary")).toBeTruthy();
        expect(screen.getByText("Starts:")).toBeTruthy();
        expect(screen.getByText("Ends:")).toBeTruthy();
      });
    });

    it("renders Cancel button", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeTruthy();
      });
    });

    it("renders title input with placeholder", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("e.g., Summer Step Challenge"),
        ).toBeTruthy();
      });
    });

    it("renders goal input with placeholder", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("e.g., 10000")).toBeTruthy();
      });
    });

    it("renders scheduling options", async () => {
      render(<CreateChallengeScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        // Default is "Start Now" mode
        expect(screen.getByText("Start Now")).toBeTruthy();
        expect(screen.getByText("Schedule")).toBeTruthy();
      });
    });
  });
});
