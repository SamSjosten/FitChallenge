// src/__tests__/component/factories/index.ts
// Centralized test data factories for component tests
// Ensures consistent mock data structures across all test files

import type { ChallengeType } from "@/types/database";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface MockChallenge {
  id: string;
  title: string;
  description: string;
  challenge_type: ChallengeType;
  goal_value: number;
  goal_unit: string;
  status: string;
  start_date: string;
  end_date: string;
  creator_id: string;
  participant_count?: number;
  my_rank?: number;
  my_participation?: {
    current_progress: number;
    current_streak: number;
    invite_status: "pending" | "accepted" | "declined" | "removed";
  };
}

export interface MockInvite {
  challenge: {
    id: string;
    title: string;
    description: string;
    challenge_type: ChallengeType;
    goal_value: number;
    goal_unit: string;
    status: string;
    start_date: string;
    end_date: string;
    creator_id: string;
  };
  creator: {
    username: string;
    display_name: string;
  };
  my_participation: {
    invite_status: "pending";
  };
}

export interface MockProfilePublic {
  username: string;
  display_name: string;
  avatar_url: string | null;
}

/**
 * Leaderboard entry structure - IMPORTANT: uses `profile` not `profiles_public`
 * This matches the actual API response and component expectations
 */
export interface MockLeaderboardEntry {
  user_id: string;
  current_progress: number;
  current_streak: number;
  profile: MockProfilePublic; // NOT profiles_public!
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a mock challenge with sensible defaults
 * Use for active challenges on home screen and challenge detail
 */
export function createMockChallenge(
  overrides: Partial<MockChallenge> = {},
): MockChallenge {
  return {
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
  };
}

/**
 * Create a mock pending invite
 * Structure matches usePendingInvites() hook response
 */
export function createMockInvite(
  overrides: Partial<MockInvite> = {},
): MockInvite {
  const base: MockInvite = {
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
  };

  return {
    ...base,
    ...overrides,
    challenge: { ...base.challenge, ...overrides.challenge },
    creator: { ...base.creator, ...overrides.creator },
    my_participation: {
      ...base.my_participation,
      ...overrides.my_participation,
    },
  };
}

/**
 * Create a mock leaderboard entry
 * CRITICAL: Uses `profile` property, NOT `profiles_public`
 * This matches the actual component expectations in app/challenge/[id].tsx
 */
export function createMockLeaderboardEntry(
  overrides: Partial<MockLeaderboardEntry> & {
    profile?: Partial<MockProfilePublic>;
  } = {},
): MockLeaderboardEntry {
  const { profile: profileOverrides, ...rest } = overrides;

  return {
    user_id: "user-1",
    current_progress: 35000,
    current_streak: 5,
    profile: {
      username: "testuser",
      display_name: "Test User",
      avatar_url: null,
      ...profileOverrides,
    },
    ...rest,
  };
}

/**
 * Create a mock user profile (for auth state)
 */
export function createMockProfile(
  overrides: Partial<{
    id: string;
    username: string;
    display_name: string;
    current_streak: number;
  }> = {},
) {
  return {
    id: "user-1",
    username: "testuser",
    display_name: "Test User",
    current_streak: 0,
    ...overrides,
  };
}

// =============================================================================
// CHALLENGE DETAIL SPECIFIC FACTORIES
// =============================================================================

/**
 * Create a challenge suitable for detail view testing
 * Includes all fields needed by the challenge detail screen
 */
export function createMockChallengeForDetail(
  overrides: Partial<MockChallenge> = {},
): MockChallenge {
  return createMockChallenge({
    id: "challenge-123",
    title: "10K Steps Challenge",
    description: "Walk 10,000 steps daily for a week",
    start_date: "2025-01-10T00:00:00Z",
    end_date: "2025-01-20T00:00:00Z",
    creator_id: "creator-user-id",
    ...overrides,
  });
}

// =============================================================================
// BATCH FACTORIES
// =============================================================================

/**
 * Create multiple leaderboard entries for testing
 */
export function createMockLeaderboard(
  count: number,
  customEntries?: Array<Partial<MockLeaderboardEntry>>,
): MockLeaderboardEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const custom = customEntries?.[i] || {};
    return createMockLeaderboardEntry({
      user_id: `user-${i + 1}`,
      current_progress: (count - i) * 10000, // Descending progress
      profile: {
        username: `user${i + 1}`,
        display_name: `User ${i + 1}`,
        avatar_url: null,
      },
      ...custom,
    });
  });
}

/**
 * Create multiple challenges for list testing
 */
export function createMockChallengeList(
  count: number,
  customChallenges?: Array<Partial<MockChallenge>>,
): MockChallenge[] {
  return Array.from({ length: count }, (_, i) => {
    const custom = customChallenges?.[i] || {};
    return createMockChallenge({
      id: `challenge-${i + 1}`,
      title: `Challenge ${i + 1}`,
      my_rank: i + 1,
      ...custom,
    });
  });
}
