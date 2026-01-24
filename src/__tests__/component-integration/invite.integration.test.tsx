// src/__tests__/component-integration/invite.integration.test.tsx
// Integration tests for invite functionality
//
// Tests the invite button visibility and modal interactions on ChallengeDetailScreen.

import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import ChallengeDetailScreen from "../../../app/challenge/[id]";
import {
  mockSupabaseClient,
  TestWrapper,
  mockSearchParams,
} from "./jest.setup";
import {
  seedAuthenticatedUser,
  seedChallenge,
  createMockLeaderboardEntry,
} from "./mockSupabaseClient";

// =============================================================================
// TEST SETUP
// =============================================================================

// Server time is mocked to 2025-01-15T12:00:00Z in jest.setup.ts
// We need to use dates relative to this to get correct effective status

function setupCreatorWithUpcomingChallenge() {
  const { profile, session } = seedAuthenticatedUser(mockSupabaseClient);

  // Create an upcoming challenge (starts after mocked server time)
  const challenge = seedChallenge(
    mockSupabaseClient,
    {
      title: "Upcoming Challenge",
      goal_value: 10000,
      creator_id: profile.id, // Current user IS the creator
      status: "pending",
      // Starts 2 days after mocked server time
      start_date: "2025-01-17T00:00:00Z",
      end_date: "2025-01-24T00:00:00Z",
    },
    { invite_status: "accepted", current_progress: 0 },
  );

  mockSearchParams.id = challenge.id;

  // Mock leaderboard RPC
  const leaderboardData = [
    createMockLeaderboardEntry({
      user_id: profile.id,
      username: profile.username,
      current_progress: 0,
      rank: 1,
    }),
  ];
  mockSupabaseClient.rpc.mockResolvedValue({
    data: leaderboardData,
    error: null,
  });

  return { profile, challenge };
}

function setupNonCreatorParticipant() {
  const { profile, session } = seedAuthenticatedUser(mockSupabaseClient);

  // Active challenge - current time is within range
  const challenge = seedChallenge(
    mockSupabaseClient,
    {
      title: "10K Steps Challenge",
      goal_value: 10000,
      creator_id: "other-user-id", // Different user is creator
      status: "active",
      // Server time (2025-01-15) is between these dates = active
      start_date: "2025-01-10T00:00:00Z",
      end_date: "2025-01-20T00:00:00Z",
    },
    { invite_status: "accepted", current_progress: 5000 },
  );

  mockSearchParams.id = challenge.id;

  // Mock leaderboard RPC
  const leaderboardData = [
    createMockLeaderboardEntry({
      user_id: profile.id,
      username: profile.username,
      current_progress: 5000,
      rank: 1,
    }),
  ];
  mockSupabaseClient.rpc.mockResolvedValue({
    data: leaderboardData,
    error: null,
  });

  return { profile, challenge };
}

function setupCreatorWithActiveChallenge() {
  const { profile, session } = seedAuthenticatedUser(mockSupabaseClient);

  const challenge = seedChallenge(
    mockSupabaseClient,
    {
      title: "Active Challenge",
      goal_value: 10000,
      creator_id: profile.id, // Current user IS the creator
      status: "active",
      // Server time (2025-01-15) is between these dates = active
      start_date: "2025-01-10T00:00:00Z",
      end_date: "2025-01-20T00:00:00Z",
    },
    { invite_status: "accepted", current_progress: 5000 },
  );

  mockSearchParams.id = challenge.id;

  // Mock leaderboard RPC
  const leaderboardData = [
    createMockLeaderboardEntry({
      user_id: profile.id,
      username: profile.username,
      current_progress: 5000,
      rank: 1,
    }),
  ];
  mockSupabaseClient.rpc.mockResolvedValue({
    data: leaderboardData,
    error: null,
  });

  return { profile, challenge };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Invite Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.__reset();
    Object.keys(mockSearchParams).forEach(
      (key) => delete mockSearchParams[key],
    );
  });

  describe("Invite Button Visibility", () => {
    it("shows Invite Friends button for creator of upcoming challenge", async () => {
      setupCreatorWithUpcomingChallenge();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          expect(screen.getByText("Upcoming Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Creator of upcoming challenge should see Invite Friends button
      await waitFor(
        () => {
          const inviteButton =
            screen.queryByText("Invite Friends") ||
            screen.queryByText("+ Invite Friends");
          expect(inviteButton).toBeTruthy();
        },
        { timeout: 3000 },
      );
    });

    it("hides Invite Friends button when user is not creator", async () => {
      setupNonCreatorParticipant();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          expect(screen.getByText("10K Steps Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Non-creator should NOT see Invite Friends button
      expect(screen.queryByText("Invite Friends")).toBeNull();
      expect(screen.queryByText("+ Invite Friends")).toBeNull();
    });

    it("hides Invite Friends button for active challenge (even as creator)", async () => {
      setupCreatorWithActiveChallenge();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          expect(screen.getByText("Active Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Creator of ACTIVE challenge should NOT see invite button
      // (invites only allowed for upcoming challenges per effectiveStatus === "upcoming")
      expect(screen.queryByText("Invite Friends")).toBeNull();
      expect(screen.queryByText("+ Invite Friends")).toBeNull();
    });
  });
});
