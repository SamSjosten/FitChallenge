// src/__tests__/component-integration/challengeDetail.integration.test.tsx
// Integration component tests for Challenge Detail screen
//
// These tests verify rendering with real providers, mocking at network boundary.

import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
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

function setupAcceptedParticipant() {
  const { profile, session } = seedAuthenticatedUser(mockSupabaseClient);

  const challenge = seedChallenge(
    mockSupabaseClient,
    {
      title: "10K Steps Challenge",
      goal_value: 10000,
      goal_unit: "steps",
      status: "active",
      // Server time (2025-01-15) is between these dates = active
      start_date: "2025-01-10T00:00:00Z",
      end_date: "2025-01-20T00:00:00Z",
    },
    { invite_status: "accepted", current_progress: 5000 },
  );

  mockSearchParams.id = challenge.id;

  // Mock leaderboard RPC - accepted participants see entries
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

function setupPendingInvitee() {
  const { profile, session } = seedAuthenticatedUser(mockSupabaseClient);

  const challenge = seedChallenge(
    mockSupabaseClient,
    {
      title: "10K Steps Challenge",
      goal_value: 10000,
      status: "active",
      // Server time (2025-01-15) is between these dates = active
      start_date: "2025-01-10T00:00:00Z",
      end_date: "2025-01-20T00:00:00Z",
    },
    { invite_status: "pending", current_progress: 0 },
  );

  mockSearchParams.id = challenge.id;

  // Mock leaderboard RPC - pending invitees get empty due to RLS
  mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

  return { profile, challenge };
}

// =============================================================================
// TESTS
// =============================================================================

describe("ChallengeDetailScreen Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.__reset();
    Object.keys(mockSearchParams).forEach(
      (key) => delete mockSearchParams[key],
    );
  });

  describe("Accepted Participant View", () => {
    it("renders challenge title", async () => {
      setupAcceptedParticipant();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          expect(screen.getByText("10K Steps Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("renders goal information", async () => {
      setupAcceptedParticipant();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          // Look for goal value in the UI
          expect(screen.getByText(/10,?000/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("shows Log Activity button for accepted participant in active challenge", async () => {
      setupAcceptedParticipant();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          expect(screen.getByText("10K Steps Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Accepted participant in active challenge should see Log Activity button
      expect(screen.getByText("Log Activity")).toBeTruthy();
    });
  });

  describe("Pending Invitee View", () => {
    it("renders challenge title for pending invitee", async () => {
      setupPendingInvitee();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      await waitFor(
        () => {
          expect(screen.getByText("10K Steps Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("does NOT show Log Activity button for pending invitee", async () => {
      setupPendingInvitee();

      render(<ChallengeDetailScreen />, { wrapper: TestWrapper });

      // Wait for challenge to load
      await waitFor(
        () => {
          expect(screen.getByText("10K Steps Challenge")).toBeTruthy();
        },
        { timeout: 5000 },
      );

      // Pending invitee should not see Log Activity
      expect(screen.queryByText("Log Activity")).toBeNull();
    });
  });
});
