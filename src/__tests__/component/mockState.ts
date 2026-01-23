import type {
  ChallengeWithParticipation,
  LeaderboardEntry,
  PendingInvite,
} from "@/services/challenges";

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

export const mockSearchParams: Record<string, string> = {};

export const mockAuthState = {
  session: null as unknown,
  user: null as unknown,
  profile: null as unknown,
  loading: false,
  error: null as unknown,
  pendingEmailConfirmation: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
  clearError: jest.fn(),
};

export const mockChallengesState = {
  activeChallenges: {
    data: [] as ChallengeWithParticipation[],
    isLoading: false,
    error: null as Error | null,
    refetch: jest.fn(),
  },
  completedChallenges: {
    data: [] as ChallengeWithParticipation[],
    isLoading: false,
    error: null as Error | null,
    refetch: jest.fn(),
  },
  pendingInvites: {
    data: [] as PendingInvite[],
    isLoading: false,
    error: null as Error | null,
    refetch: jest.fn(),
  },
  challenge: {
    data: null as ChallengeWithParticipation | null,
    isLoading: false,
    error: null as Error | null,
    refetch: jest.fn(),
  },
  leaderboard: {
    data: [] as LeaderboardEntry[],
    isLoading: false,
    error: null as Error | null,
    refetch: jest.fn(),
  },
  respondToInvite: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  createChallenge: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  logActivity: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  inviteUser: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  leaveChallenge: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
  cancelChallenge: {
    mutateAsync: jest.fn(),
    isPending: false,
  },
};
