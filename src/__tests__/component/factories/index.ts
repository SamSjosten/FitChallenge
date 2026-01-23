import type {
  Challenge,
  ChallengeParticipant,
  ChallengeStatus,
  ChallengeType,
  Profile,
  ProfilePublic,
} from "@/types/database";
import type {
  ChallengeWithParticipation,
  LeaderboardEntry,
  MyParticipation,
  PendingInvite,
} from "@/services/challenges";

let idCounter = 0;

const nextId = (prefix: string) => {
  idCounter += 1;
  return `test-${prefix}-${idCounter}`;
};

export const createMockProfile = (
  overrides: Partial<Profile> = {},
): Profile => ({
  id: nextId("profile"),
  username: "testuser",
  display_name: "Test User",
  avatar_url: null,
  current_streak: 0,
  xp_total: 0,
  timezone: "UTC",
  is_premium: false,
  created_at: null,
  updated_at: null,
  last_activity_date: null,
  longest_streak: null,
  preferred_language: null,
  ...overrides,
});

export const createMockProfilePublic = (
  overrides: Partial<ProfilePublic> = {},
): ProfilePublic => ({
  id: nextId("profile-public"),
  username: "publicuser",
  display_name: "Public User",
  avatar_url: null,
  updated_at: null,
  ...overrides,
});

export const createMockChallenge = (
  overrides: Partial<Challenge> = {},
): Challenge => ({
  id: nextId("challenge"),
  title: "10K Steps Challenge",
  description: "Walk 10,000 steps daily",
  challenge_type: "steps" as ChallengeType,
  goal_value: 10000,
  goal_unit: "steps",
  status: "active" as ChallengeStatus,
  start_date: "2025-01-01T00:00:00Z",
  end_date: "2025-01-22T00:00:00Z",
  creator_id: nextId("user"),
  created_at: null,
  updated_at: null,
  custom_activity_name: null,
  daily_target: null,
  is_public: null,
  max_participants: null,
  win_condition: "highest_total",
  xp_reward: null,
  ...overrides,
});

export const createMockParticipation = (
  overrides: Partial<MyParticipation> = {},
): MyParticipation => ({
  current_progress: 0,
  invite_status: "accepted" as ChallengeParticipant["invite_status"],
  ...overrides,
});

export const createMockChallengeWithParticipation = (
  overrides: Partial<ChallengeWithParticipation> = {},
): ChallengeWithParticipation => ({
  ...createMockChallenge(),
  my_participation: createMockParticipation(),
  participant_count: 1,
  my_rank: 1,
  ...overrides,
});

export const createMockLeaderboardEntry = (
  overrides: Partial<LeaderboardEntry> = {},
): LeaderboardEntry => {
  const userId = overrides.user_id ?? nextId("leaderboard-user");
  const profile = overrides.profile ??
    createMockProfilePublic({ id: userId, username: "leader", display_name: "Leader User" });

  return {
    user_id: userId,
    current_progress: 0,
    current_streak: 0,
    rank: 1,
    profile,
    ...overrides,
  };
};

export const createMockInvite = (
  overrides: Partial<PendingInvite> = {},
): PendingInvite => ({
  challenge: createMockChallenge(),
  creator: createMockProfilePublic({ username: "inviter", display_name: "Inviter" }),
  invited_at: "2025-01-15T12:00:00Z",
  ...overrides,
});

export const createMockChallengeAsCreator = (
  userId: string,
  overrides: Partial<ChallengeWithParticipation> = {},
): ChallengeWithParticipation =>
  createMockChallengeWithParticipation({
    creator_id: userId,
    my_participation: createMockParticipation({ invite_status: "accepted" }),
    ...overrides,
  });

export const createMockChallengeAsParticipant = (
  userId: string,
  overrides: Partial<ChallengeWithParticipation> = {},
): ChallengeWithParticipation =>
  createMockChallengeWithParticipation({
    creator_id: nextId("creator"),
    my_participation: createMockParticipation({ invite_status: "accepted" }),
    ...overrides,
  });

export const createMockPendingInvite = (
  overrides: Partial<PendingInvite> = {},
): PendingInvite =>
  createMockInvite({
    invited_at: "2025-01-15T12:00:00Z",
    ...overrides,
  });

export const createMockLeaderboard = (
  count: number,
  overrides: Partial<LeaderboardEntry> = {},
): LeaderboardEntry[] =>
  Array.from({ length: count }, (_, index) =>
    createMockLeaderboardEntry({
      user_id: nextId("leaderboard-user"),
      rank: index + 1,
      ...overrides,
    }),
  );

export * from "./queries";
export * from "./testHelpers";
