// src/lib/__tests__/biometricSignIn.test.ts
// Unit tests for biometric sign-in functionality
//
// These tests verify:
// - Capability detection (hardware, enrollment)
// - Setup flow (authentication, credential storage)
// - Sign-in flow (retrieval, AuthProvider integration)
// - Error handling (cancellation, lockout, corruption)
// - Cleanup (disable, credential deletion)

import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

// =============================================================================
// MOCKS
// =============================================================================

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Import after mocks
import {
  checkBiometricCapability,
  isBiometricSignInEnabled,
  setupBiometricSignIn,
  disableBiometricSignIn,
  performBiometricSignIn,
  type SignInFunction,
} from "../biometricSignIn";

// =============================================================================
// TEST HELPERS
// =============================================================================

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockLocalAuth = LocalAuthentication as jest.Mocked<
  typeof LocalAuthentication
>;

const mockSignIn: SignInFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (mockSignIn as jest.Mock).mockReset();
});

// =============================================================================
// checkBiometricCapability TESTS
// =============================================================================

describe("checkBiometricCapability", () => {
  it("returns not available when no hardware", async () => {
    mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);

    const result = await checkBiometricCapability();

    expect(result).toEqual({
      isAvailable: false,
      biometricType: "none",
      displayName: "Not Available",
    });
  });

  it("returns not set up when hardware exists but not enrolled", async () => {
    mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
    mockLocalAuth.isEnrolledAsync.mockResolvedValue(false);

    const result = await checkBiometricCapability();

    expect(result).toEqual({
      isAvailable: false,
      biometricType: "none",
      displayName: "Not Set Up",
    });
  });

  it("returns Face ID when facial recognition is available", async () => {
    mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
    mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
    mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);

    const result = await checkBiometricCapability();

    expect(result).toEqual({
      isAvailable: true,
      biometricType: "face",
      displayName: "Face ID",
    });
  });

  it("returns Touch ID when fingerprint is available", async () => {
    mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
    mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
    mockLocalAuth.supportedAuthenticationTypesAsync.mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);

    const result = await checkBiometricCapability();

    expect(result).toEqual({
      isAvailable: true,
      biometricType: "fingerprint",
      displayName: "Touch ID",
    });
  });

  it("handles errors gracefully", async () => {
    mockLocalAuth.hasHardwareAsync.mockRejectedValue(
      new Error("Hardware check failed"),
    );

    const result = await checkBiometricCapability();

    expect(result).toEqual({
      isAvailable: false,
      biometricType: "none",
      displayName: "Error",
    });
  });
});

// =============================================================================
// isBiometricSignInEnabled TESTS
// =============================================================================

describe("isBiometricSignInEnabled", () => {
  it("returns true when enabled flag is 'true'", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("true");

    const result = await isBiometricSignInEnabled();

    expect(result).toBe(true);
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      "fitchallenge_biometric_signin_enabled",
    );
  });

  it("returns false when enabled flag is null", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const result = await isBiometricSignInEnabled();

    expect(result).toBe(false);
  });

  it("returns false when enabled flag is 'false'", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("false");

    const result = await isBiometricSignInEnabled();

    expect(result).toBe(false);
  });

  it("returns false on error", async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error("Storage error"));

    const result = await isBiometricSignInEnabled();

    expect(result).toBe(false);
  });
});

// =============================================================================
// setupBiometricSignIn TESTS
// =============================================================================

describe("setupBiometricSignIn", () => {
  const testEmail = "test@example.com";
  const testPassword = "password123";

  it("successfully sets up biometric sign-in", async () => {
    mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true } as any);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);

    const result = await setupBiometricSignIn(testEmail, testPassword);

    expect(result).toEqual({ success: true });
    expect(mockLocalAuth.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: "Authenticate to enable quick sign-in",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use Passcode",
    });
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(2);
  });

  it("returns cancelled when user cancels authentication", async () => {
    mockLocalAuth.authenticateAsync.mockResolvedValue({
      success: false,
      error: "user_cancel",
    } as any);

    const result = await setupBiometricSignIn(testEmail, testPassword);

    expect(result).toEqual({
      success: false,
      cancelled: true,
      error: "Cancelled",
    });
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("returns error when authentication fails", async () => {
    mockLocalAuth.authenticateAsync.mockResolvedValue({
      success: false,
      error: "authentication_failed",
    } as any);

    const result = await setupBiometricSignIn(testEmail, testPassword);

    expect(result).toEqual({
      success: false,
      cancelled: false,
      error: "Authentication failed. Please try again.",
    });
  });

  it("handles lockout error", async () => {
    mockLocalAuth.authenticateAsync.mockResolvedValue({
      success: false,
      error: "lockout",
    } as any);

    const result = await setupBiometricSignIn(testEmail, testPassword);

    expect(result).toEqual({
      success: false,
      error: "Too many failed attempts. Please try again later.",
    });
  });

  it("handles storage errors", async () => {
    mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true } as any);
    mockSecureStore.setItemAsync.mockRejectedValue(new Error("Storage full"));

    const result = await setupBiometricSignIn(testEmail, testPassword);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Storage full");
  });
});

// =============================================================================
// disableBiometricSignIn TESTS
// =============================================================================

describe("disableBiometricSignIn", () => {
  it("deletes enabled flag and credentials", async () => {
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    await disableBiometricSignIn();

    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "fitchallenge_biometric_signin_enabled",
    );
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "fitchallenge_biometric_credentials",
    );
  });

  it("continues even if credential deletion fails", async () => {
    mockSecureStore.deleteItemAsync
      .mockResolvedValueOnce(undefined) // enabled flag succeeds
      .mockRejectedValueOnce(new Error("Auth required")); // credentials fails
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    // Should not throw
    await expect(disableBiometricSignIn()).resolves.not.toThrow();
  });
});

// =============================================================================
// performBiometricSignIn TESTS
// =============================================================================

describe("performBiometricSignIn", () => {
  const validCredentials = JSON.stringify({
    email: "test@example.com",
    password: "password123",
  });

  it("successfully signs in with valid credentials through AuthProvider", async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce("true") // isBiometricSignInEnabled
      .mockResolvedValueOnce(validCredentials); // getCredentials
    (mockSignIn as jest.Mock).mockResolvedValue(undefined);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result).toEqual({ success: true });
    expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("returns error when not enabled", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result).toEqual({
      success: false,
      error: "Biometric sign-in not set up",
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("handles missing credentials by disabling biometric", async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce("true") // isBiometricSignInEnabled
      .mockResolvedValueOnce(null); // getCredentials - missing
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it("handles corrupted credentials by disabling biometric", async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce("true") // isBiometricSignInEnabled
      .mockResolvedValueOnce("not valid json"); // getCredentials - corrupted
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("corrupted");
  });

  it("handles invalid credential format by disabling biometric", async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce("true") // isBiometricSignInEnabled
      .mockResolvedValueOnce(JSON.stringify({ email: "test@example.com" })); // missing password
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("corrupted");
  });

  it("handles password changed error", async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce("true")
      .mockResolvedValueOnce(validCredentials);
    (mockSignIn as jest.Mock).mockRejectedValue(
      new Error("Invalid login credentials"),
    );
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("password has changed");
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it("handles user cancellation", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("true");
    mockSecureStore.getItemAsync.mockRejectedValueOnce(
      new Error("User canceled"),
    );

    const result = await performBiometricSignIn(mockSignIn);

    expect(result).toEqual({
      success: false,
      cancelled: true,
      error: "Cancelled",
    });
  });

  it("handles biometric lockout", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("true");
    mockSecureStore.getItemAsync.mockRejectedValueOnce(
      new Error("Device is locked out due to too many failed attempts"),
    );

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many failed attempts");
  });

  it("handles biometric not available", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("true");
    mockSecureStore.getItemAsync.mockRejectedValueOnce(
      new Error("Biometric authentication not available"),
    );
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("no longer available");
  });

  it("handles generic sign-in errors", async () => {
    mockSecureStore.getItemAsync
      .mockResolvedValueOnce("true")
      .mockResolvedValueOnce(validCredentials);
    (mockSignIn as jest.Mock).mockRejectedValue(new Error("Network error"));

    const result = await performBiometricSignIn(mockSignIn);

    expect(result).toEqual({
      success: false,
      error: "Network error",
    });
  });

  it("handles LAErrorUserCancel from iOS", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("true");
    mockSecureStore.getItemAsync.mockRejectedValueOnce(
      new Error("LAErrorUserCancel"),
    );

    const result = await performBiometricSignIn(mockSignIn);

    expect(result).toEqual({
      success: false,
      cancelled: true,
      error: "Cancelled",
    });
  });

  it("handles LAErrorBiometryLockout from iOS", async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce("true");
    mockSecureStore.getItemAsync.mockRejectedValueOnce(
      new Error("LAErrorBiometryLockout"),
    );

    const result = await performBiometricSignIn(mockSignIn);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many failed attempts");
  });
});
