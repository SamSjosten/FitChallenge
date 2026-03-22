// src/lib/__tests__/sentry.test.ts
// Unit tests for Sentry error filtering

// Set __DEV__ for test environment (React Native global)
(global as typeof global & { __DEV__?: boolean }).__DEV__ = true;

import * as Sentry from "@sentry/react-native";
import { initSentry, captureError, setUserContext, addBreadcrumb, installGlobalErrorHandlers } from "../sentry";

// Mock @sentry/react-native before importing sentry.ts
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  mobileReplayIntegration: jest.fn(() => ({})),
  feedbackIntegration: jest.fn(() => ({})),
}));

// Mock config
jest.mock("@/constants/config", () => ({
  Config: {
    sentryDsn: "https://test@sentry.io/123",
  },
}));

// =============================================================================
// TESTS
// =============================================================================

describe("initSentry", () => {
  const origDev = (global as typeof global & { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    // initSentry() skips when __DEV__ is true, so disable it for this block
    (global as typeof global & { __DEV__?: boolean }).__DEV__ = false;
  });

  afterEach(() => {
    (global as typeof global & { __DEV__?: boolean }).__DEV__ = origDev;
  });

  it("should call Sentry.init with correct config", () => {
    initSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://test@sentry.io/123",
        environment: expect.any(String),
        beforeSend: expect.any(Function),
      }),
    );
  });
});

describe("captureError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("should NOT capture expected errors", () => {
    it("should ignore JWT expired errors", () => {
      captureError(new Error("JWT expired"));
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore authentication required errors", () => {
      captureError(new Error("Authentication required"));
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore permission denied errors", () => {
      captureError(new Error("Permission denied for table challenges"));
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore RLS errors", () => {
      captureError(new Error("new row violates row-level security policy"));
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore duplicate key errors", () => {
      captureError({ code: "23505", message: "duplicate key violation" });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore foreign key errors", () => {
      captureError({ code: "23503", message: "foreign key violation" });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore not found errors (PGRST116)", () => {
      captureError({ code: "PGRST116", message: "No rows returned" });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore network errors", () => {
      captureError(new Error("Network request failed"));
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("should ignore validation failed errors", () => {
      captureError(new Error("Validation failed"));
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe("should capture unexpected errors", () => {
    it("should capture generic errors", () => {
      captureError(new Error("Something unexpected happened"));
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
    });

    it("should capture errors with context", () => {
      const error = new Error("Unexpected error");
      captureError(error, { operation: "fetchData" });

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { operation: "fetchData" },
      });
    });

    it("should capture server errors", () => {
      captureError({ status: 500, message: "Internal server error" });
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it("should capture unknown error codes", () => {
      captureError({ code: "UNKNOWN", message: "Unknown error" });
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });
});

describe("setUserContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should set user with id", () => {
    setUserContext({ id: "user-123" });
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: "user-123" });
  });

  it("should clear user on logout", () => {
    setUserContext(null);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });
});

describe("addBreadcrumb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should add breadcrumb with message", () => {
    addBreadcrumb("challenge_created");

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: "challenge_created",
      data: undefined,
      level: "info",
    });
  });

  it("should add breadcrumb with data", () => {
    addBreadcrumb("activity_logged", { challengeId: "abc-123" });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: "activity_logged",
      data: { challengeId: "abc-123" },
      level: "info",
    });
  });
});

describe("installGlobalErrorHandlers", () => {
  const origDev = (global as typeof global & { __DEV__?: boolean }).__DEV__;
  let mockOriginalHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as typeof global & { __DEV__?: boolean }).__DEV__ = false;
    mockOriginalHandler = jest.fn();
    (global as typeof global & { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: jest.fn(() => mockOriginalHandler),
      setGlobalHandler: jest.fn(),
    };
  });

  afterEach(() => {
    (global as typeof global & { __DEV__?: boolean }).__DEV__ = origDev;
  });

  it("should install a global handler that chains to the original", () => {
    installGlobalErrorHandlers();

    const ErrorUtilsMock = (global as typeof global & { ErrorUtils: { setGlobalHandler: jest.Mock } }).ErrorUtils;
    expect(ErrorUtilsMock.setGlobalHandler).toHaveBeenCalledWith(expect.any(Function));

    // Simulate an uncaught error
    const handler = ErrorUtilsMock.setGlobalHandler.mock.calls[0][0];
    const error = new Error("Unexpected crash");
    handler(error, true);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { fatal: "true" },
    });
    expect(mockOriginalHandler).toHaveBeenCalledWith(error, true);
  });

  it("should respect shouldIgnoreError filter", () => {
    installGlobalErrorHandlers();

    const ErrorUtilsMock = (global as typeof global & { ErrorUtils: { setGlobalHandler: jest.Mock } }).ErrorUtils;
    const handler = ErrorUtilsMock.setGlobalHandler.mock.calls[0][0];

    // This should be filtered (JWT expired is in IGNORED_ERROR_PATTERNS)
    handler(new Error("JWT expired"), false);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(mockOriginalHandler).toHaveBeenCalled();
  });

  it("should skip installation in __DEV__ mode", () => {
    (global as typeof global & { __DEV__?: boolean }).__DEV__ = true;
    installGlobalErrorHandlers();

    const ErrorUtilsMock = (global as typeof global & { ErrorUtils: { setGlobalHandler: jest.Mock } }).ErrorUtils;
    expect(ErrorUtilsMock.setGlobalHandler).not.toHaveBeenCalled();
  });

  it("should no-op when ErrorUtils is absent (non-RN runtime)", () => {
    // Remove ErrorUtils from global to simulate a non-RN environment
    const saved = (global as typeof global & { ErrorUtils?: unknown }).ErrorUtils;
    delete (global as typeof global & { ErrorUtils?: unknown }).ErrorUtils;

    expect(() => installGlobalErrorHandlers()).not.toThrow();
    expect(Sentry.captureException).not.toHaveBeenCalled();

    // Restore for other tests
    (global as typeof global & { ErrorUtils?: unknown }).ErrorUtils = saved;
  });
});

describe("error filtering edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle null error", () => {
    captureError(null);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("should handle undefined error", () => {
    captureError(undefined);
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("should handle string error", () => {
    captureError("Some error string");
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("should handle error with only code (no message)", () => {
    captureError({ code: "23505" }); // Should be filtered by code
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("should be case-insensitive for message patterns", () => {
    captureError(new Error("JWT EXPIRED")); // Uppercase
    expect(Sentry.captureException).not.toHaveBeenCalled();

    captureError(new Error("permission DENIED"));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
