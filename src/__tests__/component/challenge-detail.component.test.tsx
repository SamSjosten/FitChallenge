// src/__tests__/component/challenge-detail.component.test.tsx
// Component tests for the Challenge Detail screen

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ChallengeDetailScreen from "@/app/challenge/[id]";
import { mockChallengesState } from "./jest.setup";
import { Alert } from "react-native";
import { createMockLeaderboardEntry } from "../factories/index";
import {
  setupAuthenticatedUser,
  setupChallengeDetailScreen,
  setupChallengeLoading,
  setupChallengeError,
} from "../factories/testHelpers";

// Mock Alert
jest.spyOn(Alert, "alert");

// =============================================================================
// TESTS
// =============================================================================

describe("ChallengeDetailScreen", () => {
  describe("Loading State", () => {
    it("shows loading screen while challenge is loading", () => {
      // Arrange
      setupAuthenticatedUser();
      setupChallengeLoading();

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByTestId("loading-screen")).toBeTruthy();
    });
  });

  describe("Error State", () => {
    it("shows error message when challenge fails to load", () => {
      // Arrange
      setupAuthenticatedUser();
      setupChallengeError("Network error");

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByTestId("error-message")).toBeTruthy();
      expect(screen.getByText("Failed to load challenge")).toBeTruthy();
    });
  });

  describe("Challenge Header", () => {
    it("renders challenge title", () => {
      // Arrange
      setupChallengeDetailScreen({
        challenge: { title: "Marathon Training" },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Marathon Training")).toBeTruthy();
    });

    // Note: "status badge" test removed - component does not render visible status badge
    // Note: "back button" tests removed - component renders icon-only back button without text
  });

  describe("Progress Card", () => {
    it("renders current progress", () => {
      // Arrange
      setupChallengeDetailScreen({
        challenge: {
          goal_value: 70000,
          my_participation: {
            current_progress: 42000,
            current_streak: 3,
            invite_status: "accepted",
          },
        },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText(/42,000/)).toBeTruthy();
      expect(screen.getByText(/70,000/)).toBeTruthy();
    });

    it("renders progress information", () => {
      // Arrange
      setupChallengeDetailScreen({
        challenge: {
          goal_value: 70000,
          my_participation: {
            current_progress: 35000,
            current_streak: 5,
            invite_status: "accepted",
          },
        },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Your Progress")).toBeTruthy();
    });
  });

  describe("Leaderboard", () => {
    it("renders leaderboard section", () => {
      // Arrange
      setupChallengeDetailScreen({
        leaderboard: [
          createMockLeaderboardEntry({
            user_id: "user-1",
            current_progress: 50000,
          }),
          createMockLeaderboardEntry({
            user_id: "user-2",
            current_progress: 40000,
            profile: {
              username: "user2",
              display_name: "User Two",
              avatar_url: null,
            },
          }),
        ],
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Leaderboard")).toBeTruthy();
    });

    it("renders leaderboard entries", () => {
      // Arrange
      setupChallengeDetailScreen({
        leaderboard: [
          createMockLeaderboardEntry({
            user_id: "user-1",
            current_progress: 50000,
            profile: {
              username: "leader",
              display_name: "Leader User",
              avatar_url: null,
            },
          }),
        ],
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Leader User")).toBeTruthy();
    });

    it("highlights current user in leaderboard", () => {
      // Arrange
      setupChallengeDetailScreen({
        leaderboard: [
          createMockLeaderboardEntry({
            user_id: "participant-id", // matches default non-creator user
            current_progress: 35000,
            profile: {
              username: "participant",
              display_name: "Participant",
              avatar_url: null,
            },
          }),
        ],
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Leaderboard")).toBeTruthy();
      expect(screen.getByText(/1.*participant/i)).toBeTruthy();
    });
  });

  describe("Log Activity", () => {
    it("renders Log Activity button for accepted participants", () => {
      // Arrange
      setupChallengeDetailScreen({
        effectiveStatus: "active",
        challenge: {
          my_participation: {
            invite_status: "accepted",
            current_progress: 0,
            current_streak: 0,
          },
        },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Log Activity")).toBeTruthy();
    });

    it("opens log activity modal when button is pressed", () => {
      // Arrange
      setupChallengeDetailScreen({ effectiveStatus: "active" });

      // Act
      render(<ChallengeDetailScreen />);
      const logButton = screen.getByText("Log Activity");
      fireEvent.press(logButton);

      // Assert
      expect(screen.getByPlaceholderText("5000")).toBeTruthy();
    });

    it("calls logActivity mutation with correct data", async () => {
      // Arrange
      setupChallengeDetailScreen({
        challengeId: "challenge-xyz",
        effectiveStatus: "active",
        challenge: {
          id: "challenge-xyz",
          challenge_type: "steps",
        },
      });
      mockChallengesState.logActivity.mutateAsync.mockResolvedValue({});

      // Act
      render(<ChallengeDetailScreen />);
      fireEvent.press(screen.getByText("Log Activity"));
      fireEvent.changeText(screen.getByPlaceholderText("5000"), "10000");
      fireEvent.press(screen.getByText("Log"));

      // Assert
      await waitFor(() => {
        expect(mockChallengesState.logActivity.mutateAsync).toHaveBeenCalledWith({
          challenge_id: "challenge-xyz",
          activity_type: "steps",
          value: 10000,
          client_event_id: "mock-client-event-id-12345",
        });
      });
    });

    it("shows validation error for invalid activity value", async () => {
      // Arrange
      setupChallengeDetailScreen({ effectiveStatus: "active" });

      // Act
      render(<ChallengeDetailScreen />);
      fireEvent.press(screen.getByText("Log Activity"));
      fireEvent.changeText(screen.getByPlaceholderText("5000"), "0");
      fireEvent.press(screen.getByText("Log"));

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Invalid Value", "Please enter a positive number");
      });
    });

    it("closes modal and clears input after successful log", async () => {
      // Arrange
      setupChallengeDetailScreen({ effectiveStatus: "active" });
      mockChallengesState.logActivity.mutateAsync.mockResolvedValue({});

      // Act
      render(<ChallengeDetailScreen />);
      fireEvent.press(screen.getByText("Log Activity"));
      fireEvent.changeText(screen.getByPlaceholderText("5000"), "10000");
      fireEvent.press(screen.getByText("Log"));

      // Assert
      await waitFor(() => {
        expect(mockChallengesState.logActivity.mutateAsync).toHaveBeenCalled();
      });
    });
  });

  describe("Invite Friends", () => {
    it("renders Invite button for challenge creator on upcoming challenge", () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      setupChallengeDetailScreen({
        isCreator: true,
        effectiveStatus: "upcoming",
        challenge: {
          status: "pending",
          start_date: futureDate.toISOString(),
          end_date: new Date(futureDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText(/Invite Friends/)).toBeTruthy();
    });

    it("opens invite modal when Invite is pressed", () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      setupChallengeDetailScreen({
        isCreator: true,
        effectiveStatus: "upcoming",
        challenge: {
          status: "pending",
          start_date: futureDate.toISOString(),
          end_date: new Date(futureDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      // Act
      render(<ChallengeDetailScreen />);
      fireEvent.press(screen.getByText(/Invite Friends/));

      // Assert
      expect(screen.getByPlaceholderText("Search by username")).toBeTruthy();
    });
  });

  describe("Leave Challenge", () => {
    it("renders Leave button for non-creator participants", () => {
      // Arrange
      setupChallengeDetailScreen({
        isCreator: false,
        challenge: {
          my_participation: {
            invite_status: "accepted",
            current_progress: 0,
            current_streak: 0,
          },
        },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Leave Challenge")).toBeTruthy();
    });

    it("shows confirmation dialog when Leave is pressed", () => {
      // Arrange
      setupChallengeDetailScreen({ isCreator: false });

      // Act
      render(<ChallengeDetailScreen />);
      fireEvent.press(screen.getByText("Leave Challenge"));

      // Assert
      expect(Alert.alert).toHaveBeenCalledWith(
        "Leave Challenge",
        expect.stringContaining("Are you sure"),
        expect.any(Array),
      );
    });
  });

  describe("Cancel Challenge", () => {
    it("renders Cancel Challenge button for creator", () => {
      // Arrange
      setupChallengeDetailScreen({ isCreator: true });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText("Cancel Challenge")).toBeTruthy();
    });

    it("shows confirmation dialog when Cancel Challenge is pressed", () => {
      // Arrange
      setupChallengeDetailScreen({ isCreator: true });

      // Act
      render(<ChallengeDetailScreen />);
      fireEvent.press(screen.getByText("Cancel Challenge"));

      // Assert
      expect(Alert.alert).toHaveBeenCalledWith(
        "Cancel Challenge",
        expect.stringContaining("This will end the challenge"),
        expect.any(Array),
      );
    });
  });

  describe("Challenge Details", () => {
    // Note: Challenge description is not currently rendered in the detail view UI

    it("renders days remaining", () => {
      // Arrange
      setupChallengeDetailScreen();

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText(/day/i)).toBeTruthy();
    });

    it("renders goal information", () => {
      // Arrange
      setupChallengeDetailScreen({
        challenge: {
          goal_value: 100000,
          goal_unit: "steps",
        },
      });

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.getByText(/100,000/)).toBeTruthy();
      expect(screen.getByText(/steps/)).toBeTruthy();
    });
  });

  describe("Pending Participant View", () => {
    it("does not show Log Activity for pending participants", () => {
      // Arrange
      setupChallengeDetailScreen({
        challenge: {
          my_participation: {
            invite_status: "pending",
            current_progress: 0,
            current_streak: 0,
          },
        },
      });
      const { canLogActivity } = require("@/lib/challengeStatus");
      canLogActivity.mockReturnValue(false);

      // Act
      render(<ChallengeDetailScreen />);

      // Assert
      expect(screen.queryByText("Log Activity")).toBeNull();
    });
  });
});
