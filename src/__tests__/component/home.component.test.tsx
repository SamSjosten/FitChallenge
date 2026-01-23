// src/__tests__/component/home.component.test.tsx
// Component tests for the Home/Dashboard screen

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import HomeScreen from "@/app/(tabs)/index";
import { mockChallengesState, mockRouter } from "./jest.setup";
import { createMockChallenge, createMockInvite } from "../factories/index";
import {
  setupAuthenticatedUser,
  setupUnauthenticatedUser,
  setupHomeScreen,
  setupHomeLoading,
  setupSuccessfulMutations,
} from "../factories/testHelpers";

// =============================================================================
// TESTS
// =============================================================================

describe("HomeScreen", () => {
  describe("Rendering", () => {
    it("renders the FitChallenge header", () => {
      // Arrange
      setupAuthenticatedUser();

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("FitChallenge")).toBeTruthy();
    });

    it("renders greeting with user display name", () => {
      // Arrange
      setupAuthenticatedUser({
        id: "user-1",
        display_name: "Sarah",
        username: "sarah_fit",
        current_streak: 5,
      });

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("Hello, Sarah!")).toBeTruthy();
    });

    it("renders greeting with username when no display name", () => {
      // Arrange
      setupAuthenticatedUser({
        id: "user-1",
        username: "sarah_fit",
        display_name: undefined,
        current_streak: 0,
      });

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("Hello, sarah_fit!")).toBeTruthy();
    });

    it("renders default greeting when no profile", () => {
      // Arrange
      setupUnauthenticatedUser();

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("Hello, Athlete!")).toBeTruthy();
    });
  });

  describe("Loading State", () => {
    it("shows loading screen when both active and pending are loading", () => {
      // Arrange
      setupAuthenticatedUser();
      setupHomeLoading();

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByTestId("loading-screen")).toBeTruthy();
    });

    it("does not show loading when only active is loading", () => {
      // Arrange
      setupHomeScreen();
      mockChallengesState.activeChallenges.isLoading = true;
      mockChallengesState.pendingInvites.isLoading = false;

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.queryByTestId("loading-screen")).toBeNull();
    });
  });

  describe("Streak Banner", () => {
    it("shows current streak when user has one", () => {
      // Arrange
      setupHomeScreen({ userStreak: 7 });

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("7 Day Streak!")).toBeTruthy();
      expect(screen.getByText("Keep it going tomorrow")).toBeTruthy();
    });

    it("shows start streak prompt when no streak", () => {
      // Arrange
      setupHomeScreen({ userStreak: 0 });

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("Start Your Streak!")).toBeTruthy();
      expect(screen.getByText("Log activity to begin")).toBeTruthy();
    });
  });

  describe("Active Challenges", () => {
    it("renders active challenges section with challenges", () => {
      // Arrange
      setupHomeScreen({ activeChallengesCount: 2 });
      // Override with specific titles
      mockChallengesState.activeChallenges.data = [
        createMockChallenge({ id: "c1", title: "Step Challenge" }),
        createMockChallenge({ id: "c2", title: "Workout Challenge" }),
      ];

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("Active Challenges")).toBeTruthy();
      expect(screen.getByText("Step Challenge")).toBeTruthy();
      expect(screen.getByText("Workout Challenge")).toBeTruthy();
    });

    it("shows empty state when no active challenges", () => {
      // Arrange
      setupHomeScreen({ activeChallengesCount: 0 });

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("No Active Challenges")).toBeTruthy();
      expect(screen.getByText("Create one to get started")).toBeTruthy();
    });

    it("displays challenge rank correctly", () => {
      // Arrange
      setupHomeScreen();
      mockChallengesState.activeChallenges.data = [
        createMockChallenge({ my_rank: 1 }),
      ];

      // Act
      render(<HomeScreen />);

      // Assert
      const rankElements = screen.getAllByText("1st");
      expect(rankElements.length).toBeGreaterThan(0);
    });

    it("navigates to challenge detail when View Challenge is pressed", async () => {
      // Arrange
      setupHomeScreen();
      mockChallengesState.activeChallenges.data = [
        createMockChallenge({ id: "challenge-123" }),
      ];

      // Act
      render(<HomeScreen />);
      const viewButton = screen.getByText("View Challenge");
      fireEvent.press(viewButton);

      // Assert
      expect(mockRouter.push).toHaveBeenCalledWith("/challenge/challenge-123");
    });

    it("navigates to create when empty state card is pressed", () => {
      // Arrange
      setupHomeScreen({ activeChallengesCount: 0 });

      // Act
      render(<HomeScreen />);

      // Assert
      const createPrompt = screen.getByText("Create one to get started");
      expect(createPrompt).toBeTruthy();
    });
  });

  describe("Pending Invites", () => {
    it("renders pending invites section when invites exist", () => {
      // Arrange
      setupHomeScreen({ pendingInvitesCount: 1 });
      mockChallengesState.pendingInvites.data = [createMockInvite()];

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("Pending Invites")).toBeTruthy();
      expect(screen.getByText("Marathon Training")).toBeTruthy();
    });

    it("does not render pending invites section when empty", () => {
      // Arrange
      setupHomeScreen({ pendingInvitesCount: 0 });

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.queryByText("Pending Invites")).toBeNull();
    });

    it("calls accept mutation when Accept is pressed", async () => {
      // Arrange
      setupHomeScreen({ pendingInvitesCount: 1 });
      mockChallengesState.pendingInvites.data = [createMockInvite()];
      setupSuccessfulMutations();

      // Act
      render(<HomeScreen />);
      const acceptButton = screen.getByText("Accept");
      fireEvent.press(acceptButton);

      // Assert
      await waitFor(() => {
        expect(
          mockChallengesState.respondToInvite.mutateAsync,
        ).toHaveBeenCalledWith({
          challenge_id: "invite-1",
          response: "accepted",
        });
      });
    });

    it("calls decline mutation when Decline is pressed", async () => {
      // Arrange
      setupHomeScreen({ pendingInvitesCount: 1 });
      mockChallengesState.pendingInvites.data = [createMockInvite()];
      setupSuccessfulMutations();

      // Act
      render(<HomeScreen />);
      const declineButton = screen.getByText("Decline");
      fireEvent.press(declineButton);

      // Assert
      await waitFor(() => {
        expect(
          mockChallengesState.respondToInvite.mutateAsync,
        ).toHaveBeenCalledWith({
          challenge_id: "invite-1",
          response: "declined",
        });
      });
    });
  });

  describe("Completed Challenges", () => {
    it("renders View Completed toggle when completed exist", () => {
      // Arrange
      setupHomeScreen({ completedChallengesCount: 1 });
      mockChallengesState.completedChallenges.data = [
        createMockChallenge({
          id: "completed-1",
          status: "completed",
          title: "Past Challenge",
        }),
      ];

      // Act
      render(<HomeScreen />);

      // Assert
      expect(screen.getByText("View Completed")).toBeTruthy();
    });

    it("expands completed section when toggled", () => {
      // Arrange
      setupHomeScreen({ completedChallengesCount: 1 });
      mockChallengesState.completedChallenges.data = [
        createMockChallenge({
          id: "completed-1",
          status: "completed",
          title: "January Challenge",
        }),
      ];

      // Act
      render(<HomeScreen />);
      const completedToggle = screen.getByText("View Completed");
      fireEvent.press(completedToggle);

      // Assert
      expect(screen.getByText("January Challenge")).toBeTruthy();
    });
  });
});
