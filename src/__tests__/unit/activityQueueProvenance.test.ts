// src/__tests__/unit/activityQueueProvenance.test.ts
// Tests that activity service passes queuedByUserId to offline queue.
// This is a service contract test — the store already tests cross-account
// guard behavior in src/stores/__tests__/offlineStore.test.ts.

// =============================================================================
// MOCKS (must be before imports)
// =============================================================================

jest.mock("react-native-url-polyfill/auto", () => {});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => require("crypto").randomUUID(),
}));

// Mock network — offline so queue is used
jest.mock("@/lib/network", () => ({
  checkNetworkStatus: jest.fn().mockResolvedValue(false),
}));

// Track addToQueue calls
const mockAddToQueue = jest.fn().mockReturnValue("queue-id-1");
jest.mock("@/stores/offlineStore", () => ({
  useOfflineStore: {
    getState: jest.fn(() => ({
      addToQueue: mockAddToQueue,
      queue: [],
    })),
  },
}));

// Mock supabase — getUserId returns a known user ID
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  withAuth: jest.fn(async (fn: (userId: string) => unknown) => fn("test-user-for-auth")),
  requireUserId: jest.fn().mockResolvedValue("test-user-for-auth"),
  getUserId: jest.fn().mockResolvedValue("test-user-for-queue"),
}));

// Mock server time
jest.mock("@/lib/serverTime", () => ({
  getServerNow: jest.fn(() => new Date("2026-01-15T12:00:00Z")),
}));

// Mock sentry
jest.mock("@/lib/sentry", () => ({
  addBreadcrumb: jest.fn(),
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { activityService } from "@/services/activities";

// =============================================================================
// TESTS
// =============================================================================

describe("activity service queue provenance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logActivity passes queuedByUserId when queueing offline", async () => {
    await activityService.logActivity({
      challenge_id: "00000000-0000-0000-0000-000000000001",
      activity_type: "steps",
      value: 5000,
      client_event_id: "00000000-0000-0000-0000-aaaaaaaaa123",
    });

    expect(mockAddToQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "LOG_ACTIVITY",
        payload: expect.objectContaining({
          challenge_id: "00000000-0000-0000-0000-000000000001",
          client_event_id: "00000000-0000-0000-0000-aaaaaaaaa123",
        }),
      }),
      "test-user-for-queue", // queuedByUserId from getUserId()
    );
  });

  it("logWorkout passes queuedByUserId when queueing offline", async () => {
    await activityService.logWorkout({
      challenge_id: "00000000-0000-0000-0000-000000000001",
      workout_type: "running",
      duration_minutes: 30,
      client_event_id: "00000000-0000-0000-0000-aaaaaaaaa456",
    });

    expect(mockAddToQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "LOG_WORKOUT",
        payload: expect.objectContaining({
          challenge_id: "00000000-0000-0000-0000-000000000001",
          client_event_id: "00000000-0000-0000-0000-aaaaaaaaa456",
        }),
      }),
      "test-user-for-queue", // queuedByUserId from getUserId()
    );
  });

  it("logActivity passes undefined queuedByUserId when not authenticated", async () => {
    const { getUserId } = jest.requireMock("@/lib/supabase");
    (getUserId as jest.Mock).mockResolvedValueOnce(null);

    await activityService.logActivity({
      challenge_id: "00000000-0000-0000-0000-000000000001",
      activity_type: "steps",
      value: 5000,
      client_event_id: "00000000-0000-0000-0000-aaaaaaaaa789",
    });

    expect(mockAddToQueue).toHaveBeenCalledWith(
      expect.any(Object),
      undefined, // No user session — coerced null → undefined for legacy skip behavior
    );
  });
});
