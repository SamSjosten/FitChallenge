// src/services/__tests__/pushTokens.test.ts
// Unit tests for push token service — disableCurrentToken() orchestration
//
// Validates H4 fix: disableCurrentToken() must use withAuth() and scope the
// update query by (user_id, token) for defense-in-depth alongside RLS.
//
// Why unit tests (not integration):
// The service method depends on platform modules (expo-notifications,
// expo-device, expo-constants) that cannot run in Node.js. Integration tests
// cover the database behavior separately in push-tokens.integration.test.ts.
// Together, both tiers prove the full contract.

// Mock platform modules BEFORE imports
jest.mock("react-native-url-polyfill/auto", () => {});

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-device — controls isNotificationSupported()
const mockIsDevice = jest.fn<boolean, []>();
jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice();
  },
}));

// Mock expo-constants — projectId for push token
jest.mock("expo-constants", () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: "test-project-id",
      },
    },
  },
}));

// Mock expo-notifications — getExpoPushTokenAsync
const mockGetExpoPushTokenAsync = jest.fn();
jest.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

// Mock Supabase client chain — tracks .eq() calls in order
const mockEqCalls: Array<[string, unknown]> = [];
const mockUpdate = jest.fn();
const mockFrom = jest.fn();

const mockSupabaseClient = {
  from: mockFrom,
};

// Track the chain for assertions
function setupChainMock(error: unknown = null) {
  mockEqCalls.length = 0;

  // Second .eq() returns the final promise
  const secondEq = jest.fn().mockImplementation((field: string, value: unknown) => {
    mockEqCalls.push([field, value]);
    return Promise.resolve({ error });
  });

  // First .eq() returns object with second .eq()
  const firstEq = jest.fn().mockImplementation((field: string, value: unknown) => {
    mockEqCalls.push([field, value]);
    return { eq: secondEq };
  });

  mockUpdate.mockReturnValue({ eq: firstEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
}

// Mock @/lib/supabase
const mockWithAuth = jest.fn();
const mockGetSupabaseClient = jest.fn(() => mockSupabaseClient);

jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Import AFTER mocks
import { pushTokenService } from "../pushTokens";

describe("pushTokenService.disableCurrentToken", () => {
  const TEST_USER_ID = "user-123-abc";
  const TEST_TOKEN = "ExponentPushToken[test_abc123]";

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: device supported, token available
    mockIsDevice.mockReturnValue(true);
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: TEST_TOKEN });

    // Default: withAuth calls the operation with test user ID
    mockWithAuth.mockImplementation(async (operation: (userId: string) => Promise<void>) => {
      return operation(TEST_USER_ID);
    });

    // Default: successful DB update
    setupChainMock(null);
  });

  // ===========================================================================
  // HAPPY PATH
  // ===========================================================================

  it("calls withAuth and updates with user_id + token filter", async () => {
    await pushTokenService.disableCurrentToken();

    // Should call withAuth
    expect(mockWithAuth).toHaveBeenCalledTimes(1);
    expect(mockWithAuth).toHaveBeenCalledWith(expect.any(Function));

    // Should query push_tokens table
    expect(mockFrom).toHaveBeenCalledWith("push_tokens");

    // Should call update with disabled_at
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ disabled_at: expect.any(String) }),
    );

    // Should have both eq filters (user_id and token)
    expect(mockEqCalls).toContainEqual(["user_id", TEST_USER_ID]);
    expect(mockEqCalls).toContainEqual(["token", TEST_TOKEN]);
  });

  it("passes correct user_id from withAuth to the eq filter", async () => {
    const CUSTOM_USER_ID = "different-user-456";
    mockWithAuth.mockImplementation(async (operation: (userId: string) => Promise<void>) => {
      return operation(CUSTOM_USER_ID);
    });

    await pushTokenService.disableCurrentToken();

    expect(mockEqCalls).toContainEqual(["user_id", CUSTOM_USER_ID]);
  });

  // ===========================================================================
  // EARLY EXIT PATHS
  // ===========================================================================

  it("returns early without DB call when device is not supported", async () => {
    mockIsDevice.mockReturnValue(false);

    await pushTokenService.disableCurrentToken();

    expect(mockWithAuth).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns early without DB call when no token is available", async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "" });

    await pushTokenService.disableCurrentToken();

    expect(mockWithAuth).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  it("logs warning but does not throw on DB error (non-fatal for sign-out)", async () => {
    const dbError = { message: "some database error", code: "42000" };
    setupChainMock(dbError);

    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    // Should not throw
    await expect(pushTokenService.disableCurrentToken()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith("Failed to disable push token:", dbError);
    warnSpy.mockRestore();
  });

  it("catches withAuth error gracefully (session expired during sign-out)", async () => {
    mockWithAuth.mockRejectedValue(new Error("Authentication required"));

    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    // Should not throw — outer catch handles it
    await expect(pushTokenService.disableCurrentToken()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      "Error disabling push token:",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
