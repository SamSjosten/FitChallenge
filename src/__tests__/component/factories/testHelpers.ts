import type {
  ChallengeWithParticipation,
  LeaderboardEntry,
  PendingInvite,
} from "@/services/challenges";
import type { Profile } from "@/types/database";
import {
  mockAuthState,
  mockChallengesState,
  mockSearchParams,
} from "../mockState";

export const resetAllMockState = (): void => {
  jest.clearAllMocks();

  mockAuthState.session = null;
  mockAuthState.user = null;
  mockAuthState.profile = null;
  mockAuthState.loading = false;
  mockAuthState.error = null;
  mockAuthState.pendingEmailConfirmation = false;

  mockChallengesState.activeChallenges.data = [];
  mockChallengesState.activeChallenges.isLoading = false;
  mockChallengesState.activeChallenges.error = null;

  mockChallengesState.completedChallenges.data = [];
  mockChallengesState.completedChallenges.isLoading = false;
  mockChallengesState.completedChallenges.error = null;

  mockChallengesState.pendingInvites.data = [];
  mockChallengesState.pendingInvites.isLoading = false;
  mockChallengesState.pendingInvites.error = null;

  mockChallengesState.challenge.data = null;
  mockChallengesState.challenge.isLoading = false;
  mockChallengesState.challenge.error = null;

  mockChallengesState.leaderboard.data = [];
  mockChallengesState.leaderboard.isLoading = false;
  mockChallengesState.leaderboard.error = null;

  mockChallengesState.respondToInvite.isPending = false;
  mockChallengesState.createChallenge.isPending = false;
  mockChallengesState.logActivity.isPending = false;
  mockChallengesState.inviteUser.isPending = false;
  mockChallengesState.leaveChallenge.isPending = false;
  mockChallengesState.cancelChallenge.isPending = false;

  Object.keys(mockSearchParams).forEach((key) => delete mockSearchParams[key]);
};

export const setupAuthenticatedUser = (profile: Profile): void => {
  mockAuthState.profile = profile;
};

export const setupChallengeState = (options: {
  challenge?: ChallengeWithParticipation | null;
  leaderboard?: LeaderboardEntry[];
  isLoading?: boolean;
  error?: Error | null;
}): void => {
  mockChallengesState.challenge.data = options.challenge ?? null;
  mockChallengesState.challenge.isLoading = options.isLoading ?? false;
  mockChallengesState.challenge.error = options.error ?? null;
  mockChallengesState.leaderboard.data = options.leaderboard ?? [];
};

export const setupActiveChallenges = (
  challenges: ChallengeWithParticipation[],
): void => {
  mockChallengesState.activeChallenges.data = challenges;
  mockChallengesState.activeChallenges.isLoading = false;
  mockChallengesState.activeChallenges.error = null;
};

export const setupPendingInvites = (invites: PendingInvite[]): void => {
  mockChallengesState.pendingInvites.data = invites;
  mockChallengesState.pendingInvites.isLoading = false;
  mockChallengesState.pendingInvites.error = null;
};
