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
