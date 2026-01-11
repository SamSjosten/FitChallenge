// src/lib/__tests__/challengeStatus.test.ts
import {
  getEffectiveStatus,
  canLogActivity,
  getStatusLabel,
  getStatusColor,
  EffectiveStatus,
} from "../challengeStatus";

describe("challengeStatus", () => {
  // =============================================================================
  // FIXED BASE TIME - All tests are deterministic
  // =============================================================================
  const BASE_NOW = new Date("2025-01-10T12:00:00Z");
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * ONE_HOUR_MS;

  // Helper to create challenges relative to BASE_NOW
  const makeChallenge = (
    status: string,
    startOffsetMs: number,
    endOffsetMs: number
  ) => ({
    status,
    start_date: new Date(BASE_NOW.getTime() + startOffsetMs).toISOString(),
    end_date: new Date(BASE_NOW.getTime() + endOffsetMs).toISOString(),
  });

  // =============================================================================
  // getEffectiveStatus
  // =============================================================================
  describe("getEffectiveStatus", () => {
    describe("time-based status (half-open interval [start, end))", () => {
      test("returns 'upcoming' when now is before start", () => {
        const challenge = makeChallenge("pending", ONE_DAY_MS, ONE_DAY_MS * 7);
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("upcoming");
      });

      test("returns 'active' when now equals start (start-inclusive)", () => {
        const challenge = makeChallenge("pending", 0, ONE_DAY_MS * 7);
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("active");
      });

      test("returns 'active' when now is between start and end", () => {
        const challenge = makeChallenge("pending", -ONE_DAY_MS, ONE_DAY_MS * 6);
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("active");
      });

      test("returns 'active' 1ms before end", () => {
        const challenge = makeChallenge("pending", -ONE_DAY_MS, 1);
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("active");
      });

      test("returns 'completed' when now equals end (end-exclusive)", () => {
        const challenge = makeChallenge("pending", -ONE_DAY_MS, 0);
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("completed");
      });

      test("returns 'completed' when now is after end", () => {
        const challenge = makeChallenge(
          "pending",
          -ONE_DAY_MS * 7,
          -ONE_HOUR_MS
        );
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("completed");
      });
    });

    describe("override statuses take precedence over time", () => {
      test("returns 'cancelled' regardless of time", () => {
        // Time says active, but status is cancelled
        const challenge = makeChallenge(
          "cancelled",
          -ONE_DAY_MS,
          ONE_DAY_MS * 6
        );
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("cancelled");
      });

      test("returns 'archived' regardless of time", () => {
        // Time says active, but status is archived
        const challenge = makeChallenge(
          "archived",
          -ONE_DAY_MS,
          ONE_DAY_MS * 6
        );
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("archived");
      });

      test("cancelled takes precedence for upcoming challenges", () => {
        const challenge = makeChallenge(
          "cancelled",
          ONE_DAY_MS,
          ONE_DAY_MS * 7
        );
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("cancelled");
      });

      test("archived takes precedence for completed challenges", () => {
        const challenge = makeChallenge(
          "archived",
          -ONE_DAY_MS * 7,
          -ONE_HOUR_MS
        );
        expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("archived");
      });
    });

    describe("non-override statuses use time-based logic", () => {
      // DB column values (except cancelled/archived) are ignored - time bounds rule
      const nonOverrideStatuses = ["pending", "active", "completed", "draft"];

      test.each(nonOverrideStatuses)(
        "stored status '%s' derives from time bounds",
        (storedStatus) => {
          // All these should return "active" based on time, not stored status
          const challenge = makeChallenge(
            storedStatus,
            -ONE_DAY_MS,
            ONE_DAY_MS * 6
          );
          expect(getEffectiveStatus(challenge, BASE_NOW)).toBe("active");
        }
      );
    });
  });

  // =============================================================================
  // canLogActivity
  // =============================================================================
  describe("canLogActivity", () => {
    test("returns true only when effective status is active", () => {
      const challenge = makeChallenge("pending", -ONE_DAY_MS, ONE_DAY_MS * 6);
      expect(canLogActivity(challenge, BASE_NOW)).toBe(true);
    });

    test("returns false for upcoming challenges", () => {
      const challenge = makeChallenge("pending", ONE_DAY_MS, ONE_DAY_MS * 7);
      expect(canLogActivity(challenge, BASE_NOW)).toBe(false);
    });

    test("returns false for completed challenges", () => {
      const challenge = makeChallenge("pending", -ONE_DAY_MS * 7, -ONE_HOUR_MS);
      expect(canLogActivity(challenge, BASE_NOW)).toBe(false);
    });

    test("returns false for cancelled challenges", () => {
      const challenge = makeChallenge("cancelled", -ONE_DAY_MS, ONE_DAY_MS * 6);
      expect(canLogActivity(challenge, BASE_NOW)).toBe(false);
    });

    test("returns false for archived challenges", () => {
      const challenge = makeChallenge("archived", -ONE_DAY_MS, ONE_DAY_MS * 6);
      expect(canLogActivity(challenge, BASE_NOW)).toBe(false);
    });

    test("uses injected now even if device time would differ", () => {
      // Challenge from the past (device time would say completed)
      const pastChallenge = {
        status: "pending",
        start_date: "2020-01-01T00:00:00Z",
        end_date: "2020-01-08T00:00:00Z",
      };
      // Device time (2025+) would say completed
      expect(canLogActivity(pastChallenge)).toBe(false);
      // But injected time in Jan 2020 says active
      const injectedNow = new Date("2020-01-04T12:00:00Z");
      expect(canLogActivity(pastChallenge, injectedNow)).toBe(true);
    });
  });

  // =============================================================================
  // UI Helpers (locks down label/color consistency)
  // =============================================================================
  describe("getStatusLabel", () => {
    const cases: [EffectiveStatus, string][] = [
      ["upcoming", "Starting Soon"],
      ["active", "Active"],
      ["completed", "Completed"],
      ["cancelled", "Cancelled"],
      ["archived", "Archived"],
    ];

    test.each(cases)('status "%s" returns label "%s"', (status, expected) => {
      expect(getStatusLabel(status)).toBe(expected);
    });
  });

  describe("getStatusColor", () => {
    const cases: [EffectiveStatus, string][] = [
      ["upcoming", "#FF9500"],
      ["active", "#34C759"],
      ["completed", "#007AFF"],
      ["cancelled", "#8E8E93"],
      ["archived", "#8E8E93"],
    ];

    test.each(cases)('status "%s" returns color "%s"', (status, expected) => {
      expect(getStatusColor(status)).toBe(expected);
    });
  });
});
