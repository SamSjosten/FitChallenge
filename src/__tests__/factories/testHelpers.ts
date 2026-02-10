// src/__tests__/component/factories/testHelpers.ts
// Composite setup utilities for common test scenarios
// Reduces boilerplate by combining factory + state setup in one call

import {
  mockAuthState,
  mockChallengesState,
  mockSearchParams,
  mockChallengeStatus,
} from "../component/jest.setup";
import {
  createMockChallenge,
  createMockInvite,
  createMockLeaderboardEntry,
  createMockProfile,
  MockChallenge,
  MockInvite,
  MockLeaderboardEntry,
} from "./index";

// =============================================================================
// AUTH SETUP HELPERS
// =============================================================================

/**
 * Set up an authenticated user with profile
 */
export function setupAuthenticatedUser(
  overrides: Partial<ReturnType<typeof createMockProfile>> = {},
) {
  const profile = createMockProfile({
    id: "current-user-id",
    username: "currentuser",
    display_name: "Current User",
    ...overrides,
  });

  mockAuthState.session = { user: { id: profile.id } };
  mockAuthState.user = { id: profile.id };
  mockAuthState.profile = profile;
  mockAuthState.loading = false;
  mockAuthState.error = null;

  return profile;
}

/**
 * Set up unauthenticated state
 */
export function setupUnauthenticatedUser(): void {
  mockAuthState.session = null;
  mockAuthState.user = null;
  mockAuthState.profile = null;
  mockAuthState.loading = false;
  mockAuthState.error = null;
}

// =============================================================================
// CHALLENGE STATE HELPERS
// =============================================================================

/**
 * Set up challenge detail screen with all required state
 */
export function setupChallengeDetailScreen(
  options: {
    challengeId?: string;
    challenge?: Partial<MockChallenge>;
    leaderboard?: MockLeaderboardEntry[];
    isCreator?: boolean;
    effectiveStatus?: "upcoming" | "active" | "completed";
  } = {},
) {
  const {
    challengeId = "challenge-123",
    challenge: challengeOverrides = {},
    leaderboard,
    isCreator = false,
    effectiveStatus = "active",
  } = options;

  // Set route params
  mockSearchParams.id = challengeId;

  // Set up user
  const userId = isCreator ? "creator-id" : "participant-id";
  const profile = setupAuthenticatedUser({
    id: userId,
    username: isCreator ? "creator" : "participant",
  });

  // Set up challenge
  const challenge = createMockChallenge({
    id: challengeId,
    creator_id: isCreator ? userId : "other-creator-id",
    ...challengeOverrides,
  });
  mockChallengesState.challenge.data = challenge;
  mockChallengesState.challenge.isLoading = false;
  mockChallengesState.challenge.error = null;

  // Set up leaderboard
  mockChallengesState.leaderboard.data = leaderboard || [
    createMockLeaderboardEntry({
      user_id: userId,
      current_progress: 35000,
      profile: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: null,
      },
    }),
  ];
  mockChallengesState.leaderboard.isLoading = false;

  // Set effective status
  mockChallengeStatus.effectiveStatus = effectiveStatus;
  mockChallengeStatus.canLog = effectiveStatus === "active";

  return {
    profile,
    challenge,
    leaderboard: mockChallengesState.leaderboard.data,
  };
}

/**
 * Set up home screen with challenges and invites
 */
export function setupHomeScreen(
  options: {
    activeChallengesCount?: number;
    pendingInvitesCount?: number;
    completedChallengesCount?: number;
    userStreak?: number;
  } = {},
) {
  const {
    activeChallengesCount = 0,
    pendingInvitesCount = 0,
    completedChallengesCount = 0,
    userStreak = 0,
  } = options;

  // Set up user
  const profile = setupAuthenticatedUser({ current_streak: userStreak });

  // Set up active challenges
  const activeChallenges = Array.from({ length: activeChallengesCount }, (_, i) =>
    createMockChallenge({
      id: `active-${i + 1}`,
      title: `Active Challenge ${i + 1}`,
      my_rank: i + 1,
    }),
  );
  mockChallengesState.activeChallenges.data = activeChallenges;
  mockChallengesState.activeChallenges.isLoading = false;

  // Set up pending invites
  const pendingInvites = Array.from({ length: pendingInvitesCount }, (_, i) =>
    createMockInvite({
      challenge: { id: `invite-${i + 1}`, title: `Invite ${i + 1}` },
    }),
  );
  mockChallengesState.pendingInvites.data = pendingInvites;
  mockChallengesState.pendingInvites.isLoading = false;

  // Set up completed challenges
  const completedChallenges = Array.from({ length: completedChallengesCount }, (_, i) =>
    createMockChallenge({
      id: `completed-${i + 1}`,
      title: `Completed Challenge ${i + 1}`,
      status: "completed",
    }),
  );
  mockChallengesState.completedChallenges.data = completedChallenges;
  mockChallengesState.completedChallenges.isLoading = false;

  return { profile, activeChallenges, pendingInvites, completedChallenges };
}

// =============================================================================
// LOADING/ERROR STATE HELPERS
// =============================================================================

/**
 * Set up loading state for challenge detail
 */
export function setupChallengeLoading(): void {
  mockChallengesState.challenge.data = null;
  mockChallengesState.challenge.isLoading = true;
  mockChallengesState.challenge.error = null;
}

/**
 * Set up error state for challenge detail
 */
export function setupChallengeError(message: string = "Network error"): void {
  mockChallengesState.challenge.data = null;
  mockChallengesState.challenge.isLoading = false;
  mockChallengesState.challenge.error = new Error(message);
}

/**
 * Set up loading state for home screen
 */
export function setupHomeLoading(): void {
  mockChallengesState.activeChallenges.isLoading = true;
  mockChallengesState.pendingInvites.isLoading = true;
  mockChallengesState.completedChallenges.isLoading = true;
}

// =============================================================================
// MUTATION HELPERS
// =============================================================================

/**
 * Set up all mutations to resolve successfully
 */
export function setupSuccessfulMutations(): void {
  mockChallengesState.respondToInvite.mutateAsync.mockResolvedValue({});
  mockChallengesState.createChallenge.mutateAsync.mockResolvedValue({
    id: "new-challenge-id",
  });
  mockChallengesState.logActivity.mutateAsync.mockResolvedValue({});
  mockChallengesState.inviteUser.mutateAsync.mockResolvedValue({});
  mockChallengesState.leaveChallenge.mutateAsync.mockResolvedValue({});
  mockChallengesState.cancelChallenge.mutateAsync.mockResolvedValue({});
}

/**
 * Set up a mutation to fail
 */
export function setupMutationFailure(
  mutation: keyof Pick<
    typeof mockChallengesState,
    | "respondToInvite"
    | "createChallenge"
    | "logActivity"
    | "inviteUser"
    | "leaveChallenge"
    | "cancelChallenge"
  >,
  errorMessage: string = "Mutation failed",
): void {
  mockChallengesState[mutation].mutateAsync.mockRejectedValue(new Error(errorMessage));
}

/**
 * Set mutation to pending state
 */
export function setupMutationPending(
  mutation: keyof Pick<
    typeof mockChallengesState,
    | "respondToInvite"
    | "createChallenge"
    | "logActivity"
    | "inviteUser"
    | "leaveChallenge"
    | "cancelChallenge"
  >,
): void {
  mockChallengesState[mutation].isPending = true;
}
