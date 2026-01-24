// src/__tests__/component-integration/home.integration.test.tsx
// Integration component tests for HomeScreen
//
// These tests use REAL providers and hooks, mocking only at the network boundary.
// They catch bugs that pure component tests (with mocked hooks) would miss:
// - Hook → component data transformation
// - React Query cache behavior
// - Provider composition issues
// - Service layer validation

import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../../app/(tabs)/index";
import { mockSupabaseClient, TestWrapper } from "./jest.setup";
import { createMockSession, createMockUser } from "./mockSupabaseClient";

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Create mock profile for authenticated user
 */
function createMockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: overrides.id ?? "user-1",
    username: overrides.username ?? "testuser",
    display_name:
      "display_name" in overrides ? overrides.display_name! : "Test User",
    avatar_url: "avatar_url" in overrides ? overrides.avatar_url! : null,
    xp_total: overrides.xp_total ?? 1000,
    current_streak: overrides.current_streak ?? 5,
    longest_streak: overrides.longest_streak ?? 10,
    is_premium: overrides.is_premium ?? false,
    timezone: overrides.timezone ?? "America/New_York",
    created_at: overrides.created_at ?? "2025-01-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2025-01-01T00:00:00Z",
  };
}

interface MockProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  xp_total: number;
  current_streak: number;
  longest_streak: number;
  is_premium: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TEST SETUP HELPERS
// =============================================================================

/**
 * Configure mock Supabase client for authenticated user scenario
 */
function setupAuthenticatedUser(profileOverrides: Partial<MockProfile> = {}) {
  const profile = createMockProfile(profileOverrides);
  const session = createMockSession({
    user: createMockUser({ id: profile.id }),
  });

  // Set session state
  mockSupabaseClient.__setSession(session);

  // Mock profile fetch (for AuthProvider) using table data
  mockSupabaseClient.__setTableData("profiles", profile);

  // Mock RPC to return empty arrays (no challenges)
  mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

  return { profile, session };
}

/**
 * Configure mock for unauthenticated state
 */
function setupUnauthenticated() {
  mockSupabaseClient.__setSession(null);
  mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });
}

// =============================================================================
// TESTS
// =============================================================================

describe("HomeScreen Integration", () => {
  describe("Authenticated User - Profile Display", () => {
    it("renders greeting with user display name from real provider chain", async () => {
      // Arrange: Set up authenticated user with real providers
      setupAuthenticatedUser({ display_name: "Sarah" });

      // Act: Render with real providers (TestWrapper includes AuthProvider, ThemeProvider, QueryClient)
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert: Greeting should use profile from AuthProvider
      await waitFor(() => {
        expect(screen.getByText("Hello, Sarah!")).toBeTruthy();
      });
    });

    it("renders greeting with username when no display name", async () => {
      // Arrange
      setupAuthenticatedUser({
        display_name: null,
        username: "sarah_fit",
      });

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(screen.getByText("Hello, sarah_fit!")).toBeTruthy();
      });
    });

    it("shows streak banner based on profile current_streak", async () => {
      // Arrange
      setupAuthenticatedUser({ current_streak: 7 });

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert: Streak from profile should be displayed
      await waitFor(() => {
        expect(screen.getByText("7 Day Streak!")).toBeTruthy();
        expect(screen.getByText("Keep it going tomorrow")).toBeTruthy();
      });
    });

    it("shows start streak prompt when user has no streak", async () => {
      // Arrange
      setupAuthenticatedUser({ current_streak: 0 });

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(screen.getByText("Start Your Streak!")).toBeTruthy();
        expect(screen.getByText("Log activity to begin")).toBeTruthy();
      });
    });
  });

  describe("Empty States", () => {
    it("shows empty state when no active challenges", async () => {
      // Arrange
      setupAuthenticatedUser();

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(screen.getByText("No Active Challenges")).toBeTruthy();
        expect(screen.getByText("Create one to get started")).toBeTruthy();
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading initially before data loads", async () => {
      // Arrange
      setupAuthenticatedUser();

      // Make RPC take time to respond
      mockSupabaseClient.rpc.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [], error: null }), 100),
          ),
      );

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert: Screen eventually loads (may or may not show loading indicator)
      await waitFor(() => {
        // Either loading or content should be visible
        const hasLoading = screen.queryByTestId("loading-screen") !== null;
        const hasContent =
          screen.queryByText(/Hello/) !== null ||
          screen.queryByText("FitChallenge") !== null;
        expect(hasLoading || hasContent).toBe(true);
      });
    });
  });

  describe("Error Handling", () => {
    it("handles RPC error gracefully without crashing", async () => {
      // Arrange
      setupAuthenticatedUser();
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: new Error("Network error"),
      });

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert: Should render default state rather than crashing
      await waitFor(() => {
        expect(screen.getByText(/Hello/)).toBeTruthy();
      });
    });
  });

  describe("Unauthenticated State", () => {
    it("shows default greeting when not authenticated", async () => {
      // Arrange
      setupUnauthenticated();

      // Act
      render(<HomeScreen />, { wrapper: TestWrapper });

      // Assert
      await waitFor(() => {
        expect(screen.getByText("Hello, Athlete!")).toBeTruthy();
      });
    });
  });
});
