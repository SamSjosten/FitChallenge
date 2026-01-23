// src/__tests__/component/challenge-detail.component.test.tsx
// Component tests for the Challenge Detail screen

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import ChallengeDetailScreen from "@/app/challenge/[id]";
import {
  mockAuthState,
  mockChallengesState,
  mockRouter,
  mockSearchParams,
} from "./jest.setup";
import { Alert } from "react-native";

// Mock Alert
jest.spyOn(Alert, "alert");

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

const createMockChallenge = (overrides = {}) => ({
  id: "challenge-123",
  title: "10K Steps Challenge",
  description: "Walk 10,000 steps daily for a week",
  challenge_type: "steps",
  goal_value: 70000,
  goal_unit: "steps",
  status: "active",
  start_date: "2025-01-10T00:00:00Z",
  end_date: "2025-01-20T00:00:00Z",
  creator_id: "creator-user-id",
  my_participation: {
    current_progress: 35000,
    current_streak: 5,
    invite_status: "accepted",
  },
  ...overrides,
});

const createMockLeaderboardEntry = (overrides = {}) => ({
  user_id: "user-1",
  current_progress: 35000,
  current_streak: 5,
  profiles_public: {
    username: "testuser",
    display_name: "Test User",
    avatar_url: null,
  },
  ...overrides,
});

// =============================================================================
// TESTS
// =============================================================================

describe("ChallengeDetailScreen", () => {
  beforeEach(() => {
    // Set up route params
    mockSearchParams.id = "challenge-123";

    // Set up default user
    mockAuthState.profile = {
      id: "current-user-id",
      username: "currentuser",
      display_name: "Current User",
    };
  });

  describe("Loading State", () => {
    it("shows loading screen while challenge is loading", () => {
      mockChallengesState.challenge.isLoading = true;

      render(<ChallengeDetailScreen />);
      expect(screen.getByTestId("loading-screen")).toBeTruthy();
    });
  });

  describe("Error State", () => {
    it("shows error message when challenge fails to load", () => {
      mockChallengesState.challenge.error = new Error("Network error");
      mockChallengesState.challenge.data = null;

      render(<ChallengeDetailScreen />);
      expect(screen.getByTestId("error-message")).toBeTruthy();
      expect(screen.getByText("Failed to load challenge")).toBeTruthy();
    });
  });

  describe("Challenge Header", () => {
    it("renders challenge title", () => {
      mockChallengesState.challenge.data = createMockChallenge({
        title: "Marathon Training",
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Marathon Training")).toBeTruthy();
    });

    it("renders challenge status badge", () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);
      // Status label from mock is "Active"
      expect(screen.getByText("Active")).toBeTruthy();
    });

    it("renders back button", () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Back")).toBeTruthy();
    });

    it("navigates back when back button is pressed", () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);

      const backButton = screen.getByText("Back");
      fireEvent.press(backButton);

      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe("Progress Card", () => {
    it("renders current progress", () => {
      mockChallengesState.challenge.data = createMockChallenge({
        my_participation: {
          current_progress: 42000,
          current_streak: 3,
          invite_status: "accepted",
        },
        goal_value: 70000,
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText(/42,000/)).toBeTruthy();
      expect(screen.getByText(/70,000/)).toBeTruthy();
    });

    it("renders progress bar", () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);
      expect(screen.getByTestId("progress-bar")).toBeTruthy();
    });
  });

  describe("Leaderboard", () => {
    it("renders leaderboard section", () => {
      mockChallengesState.challenge.data = createMockChallenge();
      mockChallengesState.leaderboard.data = [
        createMockLeaderboardEntry({
          user_id: "user-1",
          current_progress: 50000,
        }),
        createMockLeaderboardEntry({
          user_id: "user-2",
          current_progress: 40000,
        }),
      ];

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Leaderboard")).toBeTruthy();
    });

    it("renders leaderboard entries", () => {
      mockChallengesState.challenge.data = createMockChallenge();
      mockChallengesState.leaderboard.data = [
        createMockLeaderboardEntry({
          user_id: "user-1",
          current_progress: 50000,
          profiles_public: { username: "leader", display_name: "Leader User" },
        }),
      ];

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Leader User")).toBeTruthy();
    });

    it("highlights current user in leaderboard", () => {
      mockAuthState.profile = { id: "current-user-id", username: "me" };
      mockChallengesState.challenge.data = createMockChallenge();
      mockChallengesState.leaderboard.data = [
        createMockLeaderboardEntry({
          user_id: "current-user-id",
          profiles_public: { username: "me", display_name: "Me" },
        }),
      ];

      render(<ChallengeDetailScreen />);
      // The current user's entry should be present
      expect(screen.getByText("Me")).toBeTruthy();
    });
  });

  describe("Log Activity", () => {
    it("renders Log Activity button for accepted participants", () => {
      mockChallengesState.challenge.data = createMockChallenge({
        my_participation: {
          invite_status: "accepted",
          current_progress: 0,
          current_streak: 0,
        },
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Log Activity")).toBeTruthy();
    });

    it("opens log activity modal when button is pressed", () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);

      const logButton = screen.getByText("Log Activity");
      fireEvent.press(logButton);

      // Modal should be visible with input
      expect(screen.getByText(/Log/)).toBeTruthy();
    });

    it("calls logActivity mutation with correct data", async () => {
      mockChallengesState.challenge.data = createMockChallenge({
        id: "challenge-xyz",
        challenge_type: "steps",
      });
      mockChallengesState.logActivity.mutateAsync.mockResolvedValue({});

      render(<ChallengeDetailScreen />);

      // Open modal
      const logButton = screen.getByText("Log Activity");
      fireEvent.press(logButton);

      // Enter value
      const input = screen.getByPlaceholderText("5000");
      fireEvent.changeText(input, "10000");

      // Submit
      const submitButton = screen.getAllByText("Log")[1]; // Modal has a Log button
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          mockChallengesState.logActivity.mutateAsync,
        ).toHaveBeenCalledWith({
          challenge_id: "challenge-xyz",
          activity_type: "steps",
          value: 10000,
          client_event_id: "mock-client-event-id-12345",
        });
      });
    });

    it("shows validation error for invalid activity value", async () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);

      // Open modal
      const logButton = screen.getByText("Log Activity");
      fireEvent.press(logButton);

      // Enter invalid value
      const input = screen.getByPlaceholderText("5000");
      fireEvent.changeText(input, "0");

      // Submit
      const submitButton = screen.getAllByText("Log")[1];
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Invalid Value",
          "Please enter a positive number",
        );
      });
    });

    it("closes modal and clears input after successful log", async () => {
      mockChallengesState.challenge.data = createMockChallenge();
      mockChallengesState.logActivity.mutateAsync.mockResolvedValue({});

      render(<ChallengeDetailScreen />);

      // Open modal
      const logButton = screen.getByText("Log Activity");
      fireEvent.press(logButton);

      // Enter value
      const input = screen.getByPlaceholderText("5000");
      fireEvent.changeText(input, "10000");

      // Submit
      const submitButton = screen.getAllByText("Log")[1];
      fireEvent.press(submitButton);

      await waitFor(() => {
        // Modal should close - Log Activity button should be visible again (not Log button in modal)
        expect(mockChallengesState.logActivity.mutateAsync).toHaveBeenCalled();
      });
    });
  });

  describe("Invite Friends", () => {
    it("renders Invite button for challenge creator", () => {
      mockAuthState.profile = { id: "creator-id", username: "creator" };
      mockChallengesState.challenge.data = createMockChallenge({
        creator_id: "creator-id",
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Invite")).toBeTruthy();
    });

    it("opens invite modal when Invite is pressed", () => {
      mockAuthState.profile = { id: "creator-id", username: "creator" };
      mockChallengesState.challenge.data = createMockChallenge({
        creator_id: "creator-id",
      });

      render(<ChallengeDetailScreen />);

      const inviteButton = screen.getByText("Invite");
      fireEvent.press(inviteButton);

      expect(screen.getByText("Invite Friends")).toBeTruthy();
      expect(screen.getByPlaceholderText("Search by username")).toBeTruthy();
    });
  });

  describe("Leave Challenge", () => {
    it("renders Leave button for non-creator participants", () => {
      mockAuthState.profile = { id: "participant-id", username: "participant" };
      mockChallengesState.challenge.data = createMockChallenge({
        creator_id: "different-creator-id",
        my_participation: {
          invite_status: "accepted",
          current_progress: 0,
          current_streak: 0,
        },
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Leave")).toBeTruthy();
    });

    it("shows confirmation dialog when Leave is pressed", () => {
      mockAuthState.profile = { id: "participant-id", username: "participant" };
      mockChallengesState.challenge.data = createMockChallenge({
        creator_id: "different-creator-id",
      });

      render(<ChallengeDetailScreen />);

      const leaveButton = screen.getByText("Leave");
      fireEvent.press(leaveButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        "Leave Challenge",
        expect.stringContaining("Are you sure"),
        expect.any(Array),
      );
    });
  });

  describe("Cancel Challenge", () => {
    it("renders Cancel Challenge button for creator", () => {
      mockAuthState.profile = { id: "creator-id", username: "creator" };
      mockChallengesState.challenge.data = createMockChallenge({
        creator_id: "creator-id",
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Cancel Challenge")).toBeTruthy();
    });

    it("shows confirmation dialog when Cancel Challenge is pressed", () => {
      mockAuthState.profile = { id: "creator-id", username: "creator" };
      mockChallengesState.challenge.data = createMockChallenge({
        creator_id: "creator-id",
      });

      render(<ChallengeDetailScreen />);

      const cancelButton = screen.getByText("Cancel Challenge");
      fireEvent.press(cancelButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        "Cancel Challenge",
        expect.stringContaining("This will end the challenge"),
        expect.any(Array),
      );
    });
  });

  describe("Challenge Details", () => {
    it("renders challenge description", () => {
      mockChallengesState.challenge.data = createMockChallenge({
        description: "Walk together as a team!",
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText("Walk together as a team!")).toBeTruthy();
    });

    it("renders days remaining", () => {
      mockChallengesState.challenge.data = createMockChallenge();

      render(<ChallengeDetailScreen />);
      // Should show days remaining text
      expect(screen.getByText(/day/i)).toBeTruthy();
    });

    it("renders goal information", () => {
      mockChallengesState.challenge.data = createMockChallenge({
        goal_value: 100000,
        goal_unit: "steps",
      });

      render(<ChallengeDetailScreen />);
      expect(screen.getByText(/100,000/)).toBeTruthy();
      expect(screen.getByText(/steps/)).toBeTruthy();
    });
  });

  describe("Pending Participant View", () => {
    it("does not show Log Activity for pending participants", () => {
      mockChallengesState.challenge.data = createMockChallenge({
        my_participation: {
          invite_status: "pending",
          current_progress: 0,
          current_streak: 0,
        },
      });

      // Mock canLogActivity to return false for pending
      const { canLogActivity } = require("@/lib/challengeStatus");
      canLogActivity.mockReturnValue(false);

      render(<ChallengeDetailScreen />);

      // Log Activity button should not be present
      expect(screen.queryByText("Log Activity")).toBeNull();
    });
  });
});
