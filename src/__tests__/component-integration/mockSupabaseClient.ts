// src/__tests__/component-integration/mockSupabaseClient.ts
// Mock Supabase client factory with chainable API support
// Used by component-integration tests to mock at the network boundary only

import type { SupabaseClient, Session, User } from "@supabase/supabase-js";

// =============================================================================
// TYPES
// =============================================================================

type MockResponse<T> = { data: T; error: null } | { data: null; error: Error };

interface MockQueryBuilder {
  select: jest.Mock<MockQueryBuilder>;
  insert: jest.Mock<MockQueryBuilder>;
  update: jest.Mock<MockQueryBuilder>;
  delete: jest.Mock<MockQueryBuilder>;
  eq: jest.Mock<MockQueryBuilder>;
  neq: jest.Mock<MockQueryBuilder>;
  or: jest.Mock<MockQueryBuilder>;
  in: jest.Mock<MockQueryBuilder>;
  ilike: jest.Mock<MockQueryBuilder>;
  order: jest.Mock<MockQueryBuilder>;
  limit: jest.Mock<MockQueryBuilder>;
  single: jest.Mock<Promise<MockResponse<unknown>>>;
  maybeSingle: jest.Mock<Promise<MockResponse<unknown>>>;
  // Terminal method - returns promise
  then: jest.Mock;
  // Internal: track configured result
  __result?: MockResponse<unknown>;
}

interface MockAuthStateChangeCallback {
  (event: string, session: Session | null): void;
}

interface MockAuthSubscription {
  unsubscribe: jest.Mock;
}

export interface MockSupabaseClient {
  auth: {
    getSession: jest.Mock<Promise<MockResponse<{ session: Session | null }>>>;
    getUser: jest.Mock<Promise<MockResponse<{ user: User | null }>>>;
    signInWithPassword: jest.Mock<Promise<MockResponse<{ session: Session }>>>;
    signUp: jest.Mock<
      Promise<MockResponse<{ session: Session | null; user: User | null }>>
    >;
    signOut: jest.Mock<Promise<MockResponse<null>>>;
    onAuthStateChange: jest.Mock<{
      data: { subscription: MockAuthSubscription };
    }>;
  };
  from: jest.Mock<MockQueryBuilder>;
  rpc: jest.Mock<Promise<MockResponse<unknown>>>;
  // Test utilities
  __triggerAuthStateChange: (event: string, session: Session | null) => void;
  __reset: () => void;
  __setSession: (session: Session | null) => void;
  __setUser: (user: User | null) => void;
  __setTableData: (table: string, data: unknown, error?: Error | null) => void;
}

// =============================================================================
// MOCK FACTORY
// =============================================================================

/**
 * Creates a mock Supabase client with chainable query builder.
 * All methods return jest.fn() for easy assertion and customization.
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  let currentSession: Session | null = null;
  let currentUser: User | null = null;
  const authListeners: MockAuthStateChangeCallback[] = [];

  // Store table-specific data for queries
  const tableData: Map<string, { data: unknown; error: Error | null }> =
    new Map();

  // Create chainable query builder for a specific table
  const createQueryBuilder = (tableName: string): MockQueryBuilder => {
    const getResult = (): MockResponse<unknown> => {
      const stored = tableData.get(tableName);
      if (stored) {
        return stored.error
          ? { data: null, error: stored.error }
          : { data: stored.data, error: null };
      }
      return { data: null, error: null };
    };

    const builder: MockQueryBuilder = {
      select: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      or: jest.fn(() => builder),
      in: jest.fn(() => builder),
      ilike: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(getResult())),
      maybeSingle: jest.fn(() => Promise.resolve(getResult())),
      then: jest.fn((resolve) => {
        const result = getResult();
        if (resolve) resolve(result);
        return Promise.resolve(result);
      }),
    };

    return builder;
  };

  const mockClient: MockSupabaseClient = {
    auth: {
      getSession: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: { session: currentSession }, error: null }),
        ),
      getUser: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: { user: currentUser }, error: null }),
        ),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signUp: jest.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({ data: null, error: null }),
      onAuthStateChange: jest.fn((callback: MockAuthStateChangeCallback) => {
        authListeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(() => {
                const index = authListeners.indexOf(callback);
                if (index > -1) authListeners.splice(index, 1);
              }),
            },
          },
        };
      }),
    },
    from: jest.fn((tableName: string) => createQueryBuilder(tableName)),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),

    // Test utilities
    __triggerAuthStateChange: (event: string, session: Session | null) => {
      currentSession = session;
      currentUser = session?.user ?? null;
      authListeners.forEach((listener) => listener(event, session));
    },

    __reset: () => {
      currentSession = null;
      currentUser = null;
      authListeners.length = 0;
      tableData.clear();
      jest.clearAllMocks();
    },

    __setSession: (session: Session | null) => {
      currentSession = session;
      currentUser = session?.user ?? null;
    },

    __setUser: (user: User | null) => {
      currentUser = user;
    },

    __setTableData: (
      table: string,
      data: unknown,
      error: Error | null = null,
    ) => {
      tableData.set(table, { data, error });
    },
  };

  return mockClient;
}

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

/**
 * Create a mock Supabase session
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  const userId = overrides.user?.id ?? "test-user-id";
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: { username: "testuser" },
      ...overrides.user,
    },
    ...overrides,
  } as Session;
}

/**
 * Create a mock user
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { username: "testuser" },
    ...overrides,
  } as User;
}

// =============================================================================
// STATE BUILDERS (for consistent test setup)
// =============================================================================

export interface MockProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  xp_total: number;
  current_streak: number;
  longest_streak: number;
  is_premium: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface MockChallenge {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  goal_value: number;
  goal_unit: string;
  win_condition: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  my_participation?: MockParticipation;
}

export interface MockParticipation {
  id: string;
  challenge_id: string;
  user_id: string;
  invite_status: "pending" | "accepted" | "declined";
  current_progress: number;
  current_streak: number;
  joined_at: string;
}

export interface MockLeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_progress: number;
  rank: number;
  today_change: number;
}

export interface MockProfilePublic {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Create a mock profile with sensible defaults
 */
export function createMockProfile(
  overrides: Partial<MockProfile> = {},
): MockProfile {
  return {
    id: overrides.id ?? "test-user-id",
    username: overrides.username ?? "testuser",
    display_name:
      "display_name" in overrides ? overrides.display_name! : "Test User",
    avatar_url: "avatar_url" in overrides ? overrides.avatar_url! : null,
    xp_total: overrides.xp_total ?? 1000,
    current_streak: overrides.current_streak ?? 5,
    longest_streak: overrides.longest_streak ?? 10,
    is_premium: overrides.is_premium ?? false,
    timezone: overrides.timezone ?? "America/New_York",
    created_at: overrides.created_at ?? "2025-01-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2025-01-01T00:00:00Z",
  };
}

/**
 * Create a mock challenge with sensible defaults
 */
export function createMockChallenge(
  overrides: Partial<MockChallenge> = {},
): MockChallenge {
  const now = new Date();
  const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const endDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

  return {
    id: overrides.id ?? "challenge-1",
    creator_id: overrides.creator_id ?? "test-user-id",
    title: overrides.title ?? "Test Challenge",
    description: overrides.description ?? "A test challenge description",
    challenge_type: overrides.challenge_type ?? "steps",
    goal_value: overrides.goal_value ?? 10000,
    goal_unit: overrides.goal_unit ?? "steps",
    win_condition: overrides.win_condition ?? "highest_total",
    start_date: overrides.start_date ?? startDate.toISOString(),
    end_date: overrides.end_date ?? endDate.toISOString(),
    status: overrides.status ?? "active",
    created_at: overrides.created_at ?? "2025-01-01T00:00:00Z",
    updated_at: overrides.updated_at ?? "2025-01-01T00:00:00Z",
    my_participation: overrides.my_participation,
  };
}

/**
 * Create a mock participation record
 */
export function createMockParticipation(
  overrides: Partial<MockParticipation> = {},
): MockParticipation {
  return {
    id: overrides.id ?? "participation-1",
    challenge_id: overrides.challenge_id ?? "challenge-1",
    user_id: overrides.user_id ?? "test-user-id",
    invite_status: overrides.invite_status ?? "accepted",
    current_progress: overrides.current_progress ?? 5000,
    current_streak: overrides.current_streak ?? 3,
    joined_at: overrides.joined_at ?? "2025-01-01T00:00:00Z",
  };
}

/**
 * Create a mock leaderboard entry
 */
export function createMockLeaderboardEntry(
  overrides: Partial<MockLeaderboardEntry> = {},
): MockLeaderboardEntry {
  return {
    user_id: overrides.user_id ?? "user-1",
    username: overrides.username ?? "user1",
    display_name: overrides.display_name ?? "User One",
    avatar_url: overrides.avatar_url ?? null,
    current_progress: overrides.current_progress ?? 5000,
    rank: overrides.rank ?? 1,
    today_change: overrides.today_change ?? 0,
  };
}

/**
 * Seed authenticated user state in mock client.
 * Sets up session, user, and profile data.
 */
export function seedAuthenticatedUser(
  client: MockSupabaseClient,
  profileOverrides: Partial<MockProfile> = {},
): { profile: MockProfile; session: Session } {
  const profile = createMockProfile(profileOverrides);
  const session = createMockSession({
    user: createMockUser({ id: profile.id }),
  });

  client.__setSession(session);
  client.__setTableData("profiles", profile);

  return { profile, session };
}

/**
 * Seed challenge data with optional participation.
 * Configures table data mock to return challenge data in the format expected by getChallenge.
 * The getChallenge service expects challenge_participants nested array in the response.
 */
export function seedChallenge(
  client: MockSupabaseClient,
  challengeOverrides: Partial<MockChallenge> = {},
  participationOverrides?: Partial<MockParticipation>,
): MockChallenge {
  const participation = participationOverrides
    ? createMockParticipation(participationOverrides)
    : createMockParticipation();

  const challenge = createMockChallenge({
    ...challengeOverrides,
    my_participation: participation,
  });

  // Mock the challenges table for direct queries
  // getChallenge expects response with nested challenge_participants array
  const tableResponse = {
    ...challenge,
    challenge_participants: [
      {
        invite_status: participation.invite_status,
        current_progress: participation.current_progress,
      },
    ],
  };
  client.__setTableData("challenges", tableResponse);

  return challenge;
}

/**
 * Seed leaderboard data for a challenge.
 * Returns array of leaderboard entries.
 */
export function seedLeaderboard(
  client: MockSupabaseClient,
  entries: Partial<MockLeaderboardEntry>[] = [],
): MockLeaderboardEntry[] {
  const leaderboard =
    entries.length > 0
      ? entries.map((e, i) =>
          createMockLeaderboardEntry({ ...e, rank: e.rank ?? i + 1 }),
        )
      : [
          createMockLeaderboardEntry({
            user_id: "user-1",
            username: "leader",
            current_progress: 8000,
            rank: 1,
          }),
          createMockLeaderboardEntry({
            user_id: "user-2",
            username: "second",
            current_progress: 6000,
            rank: 2,
          }),
          createMockLeaderboardEntry({
            user_id: "test-user-id",
            username: "testuser",
            current_progress: 5000,
            rank: 3,
          }),
        ];

  return leaderboard;
}

/**
 * Seed user search results for invite flow.
 */
export function seedSearchResults(
  client: MockSupabaseClient,
  users: Partial<MockProfilePublic>[] = [],
): MockProfilePublic[] {
  const results: MockProfilePublic[] =
    users.length > 0
      ? users.map((u, i) => ({
          id: u.id ?? `search-user-${i}`,
          username: u.username ?? `searchuser${i}`,
          display_name: u.display_name ?? `Search User ${i}`,
          avatar_url: u.avatar_url ?? null,
        }))
      : [
          {
            id: "search-1",
            username: "alice",
            display_name: "Alice Smith",
            avatar_url: null,
          },
          {
            id: "search-2",
            username: "bob",
            display_name: "Bob Jones",
            avatar_url: null,
          },
        ];

  return results;
}
