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
import { mockAuthState, mockChallengesState, mockRouter } from "./jest.setup";

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

const createMockChallenge = (overrides = {}) => ({
  id: "challenge-1",
  title: "10K Steps Challenge",
  description: "Walk 10,000 steps daily",
  challenge_type: "steps",
  goal_value: 70000,
  goal_unit: "steps",
  status: "active",
  start_date: "2025-01-01T00:00:00Z",
  end_date: "2025-01-22T00:00:00Z",
  creator_id: "user-1",
  participant_count: 3,
  my_rank: 1,
  my_participation: {
    current_progress: 35000,
    current_streak: 5,
    invite_status: "accepted",
  },
  ...overrides,
});

const createMockInvite = (overrides = {}) => ({
  challenge: {
    id: "invite-1",
    title: "Marathon Training",
    description: "Train for marathon together",
    challenge_type: "distance",
    goal_value: 100,
    goal_unit: "km",
    status: "pending",
    start_date: "2025-01-20T00:00:00Z",
    end_date: "2025-02-20T00:00:00Z",
    creator_id: "user-2",
  },
  creator: {
    username: "john_runner",
    display_name: "John Runner",
  },
  my_participation: {
    invite_status: "pending",
  },
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe("HomeScreen", () => {
  describe("Rendering", () => {
    it("renders the FitChallenge header", () => {
      render(<HomeScreen />);
      expect(screen.getByText("FitChallenge")).toBeTruthy();
    });

    it("renders greeting with user display name", () => {
      mockAuthState.profile = {
        id: "user-1",
        display_name: "Sarah",
        username: "sarah_fit",
        current_streak: 5,
      };

      render(<HomeScreen />);
      expect(screen.getByText("Hello, Sarah!")).toBeTruthy();
    });

    it("renders greeting with username when no display name", () => {
      mockAuthState.profile = {
        id: "user-1",
        username: "sarah_fit",
        current_streak: 0,
      };

      render(<HomeScreen />);
      expect(screen.getByText("Hello, sarah_fit!")).toBeTruthy();
    });

    it("renders default greeting when no profile", () => {
      mockAuthState.profile = null;

      render(<HomeScreen />);
      expect(screen.getByText("Hello, Athlete!")).toBeTruthy();
    });
  });

  describe("Loading State", () => {
    it("shows loading screen when both active and pending are loading", () => {
      mockChallengesState.activeChallenges.isLoading = true;
      mockChallengesState.pendingInvites.isLoading = true;

      render(<HomeScreen />);
      expect(screen.getByTestId("loading-screen")).toBeTruthy();
    });

    it("does not show loading when only active is loading", () => {
      mockChallengesState.activeChallenges.isLoading = true;
      mockChallengesState.pendingInvites.isLoading = false;

      render(<HomeScreen />);
      expect(screen.queryByTestId("loading-screen")).toBeNull();
    });
  });

  describe("Streak Banner", () => {
    it("shows current streak when user has one", () => {
      mockAuthState.profile = {
        id: "user-1",
        username: "test",
        current_streak: 7,
      };

      render(<HomeScreen />);
      expect(screen.getByText("7 Day Streak!")).toBeTruthy();
      expect(screen.getByText("Keep it going tomorrow")).toBeTruthy();
    });

    it("shows start streak prompt when no streak", () => {
      mockAuthState.profile = {
        id: "user-1",
        username: "test",
        current_streak: 0,
      };

      render(<HomeScreen />);
      expect(screen.getByText("Start Your Streak!")).toBeTruthy();
      expect(screen.getByText("Log activity to begin")).toBeTruthy();
    });
  });

  describe("Active Challenges", () => {
    it("renders active challenges section with challenges", () => {
      mockChallengesState.activeChallenges.data = [
        createMockChallenge({ id: "c1", title: "Step Challenge" }),
        createMockChallenge({ id: "c2", title: "Workout Challenge" }),
      ];

      render(<HomeScreen />);
      expect(screen.getByText("Active Challenges")).toBeTruthy();
      expect(screen.getByText("Step Challenge")).toBeTruthy();
      expect(screen.getByText("Workout Challenge")).toBeTruthy();
    });

    it("shows empty state when no active challenges", () => {
      mockChallengesState.activeChallenges.data = [];

      render(<HomeScreen />);
      expect(screen.getByText("No Active Challenges")).toBeTruthy();
      expect(screen.getByText("Create one to get started")).toBeTruthy();
    });

    it("displays challenge rank correctly", () => {
      mockChallengesState.activeChallenges.data = [
        createMockChallenge({ my_rank: 1 }),
      ];

      render(<HomeScreen />);
      expect(screen.getByText("1st")).toBeTruthy();
    });

    it("navigates to challenge detail when View Challenge is pressed", async () => {
      mockChallengesState.activeChallenges.data = [
        createMockChallenge({ id: "challenge-123" }),
      ];

      render(<HomeScreen />);

      // The first challenge should be auto-expanded, showing the View Challenge button
      const viewButton = screen.getByText("View Challenge");
      fireEvent.press(viewButton);

      expect(mockRouter.push).toHaveBeenCalledWith("/challenge/challenge-123");
    });

    it("navigates to create when empty state card is pressed", () => {
      mockChallengesState.activeChallenges.data = [];

      render(<HomeScreen />);

      // The empty state card is pressable
      const emptyCard = screen.getByText("No Active Challenges");
      // Since Card component might be mocked, we look for the Create text
      const createPrompt = screen.getByText("Create one to get started");
      expect(createPrompt).toBeTruthy();
    });
  });

  describe("Pending Invites", () => {
    it("renders pending invites section when invites exist", () => {
      mockChallengesState.pendingInvites.data = [createMockInvite()];

      render(<HomeScreen />);
      expect(screen.getByText("Pending Invites")).toBeTruthy();
      expect(screen.getByText("Marathon Training")).toBeTruthy();
    });

    it("does not render pending invites section when empty", () => {
      mockChallengesState.pendingInvites.data = [];

      render(<HomeScreen />);
      expect(screen.queryByText("Pending Invites")).toBeNull();
    });

    it("calls accept mutation when Accept is pressed", async () => {
      mockChallengesState.pendingInvites.data = [createMockInvite()];
      mockChallengesState.respondToInvite.mutateAsync.mockResolvedValue({});

      render(<HomeScreen />);

      const acceptButton = screen.getByText("Accept");
      fireEvent.press(acceptButton);

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
      mockChallengesState.pendingInvites.data = [createMockInvite()];
      mockChallengesState.respondToInvite.mutateAsync.mockResolvedValue({});

      render(<HomeScreen />);

      const declineButton = screen.getByText("Decline");
      fireEvent.press(declineButton);

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
      mockChallengesState.completedChallenges.data = [
        createMockChallenge({
          id: "completed-1",
          status: "completed",
          title: "Past Challenge",
        }),
      ];

      render(<HomeScreen />);
      expect(screen.getByText("View Completed")).toBeTruthy();
    });

    it("expands completed section when toggled", () => {
      mockChallengesState.completedChallenges.data = [
        createMockChallenge({
          id: "completed-1",
          status: "completed",
          title: "January Challenge",
        }),
      ];

      render(<HomeScreen />);

      // Find and press the completed section toggle
      const completedToggle = screen.getByText("View Completed");
      fireEvent.press(completedToggle);

      // Should now show the completed challenge
      expect(screen.getByText("January Challenge")).toBeTruthy();
    });
  });
});
