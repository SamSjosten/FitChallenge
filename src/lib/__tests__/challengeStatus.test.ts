// src/lib/__tests__/challengeStatus.test.ts
import {
  getEffectiveStatus,
  canLogActivity,
  getStatusLabel,
  getStatusColor,
  EffectiveStatus,
} from "../challengeStatus";

describe("challengeStatus", () => {
  // Helper to create challenge objects
  const makeChallenge = (
    status: string,
    startOffset: number, // milliseconds from now
    endOffset: number
  ) => ({
    status,
    start_date: new Date(Date.now() + startOffset).toISOString(),
    end_date: new Date(Date.now() + endOffset).toISOString(),
  });

  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  describe("getEffectiveStatus", () => {
    describe("time-based status", () => {
      test('returns "upcoming" when start_date is in future', () => {
        const challenge = makeChallenge("pending", ONE_DAY, ONE_DAY * 7);
        expect(getEffectiveStatus(challenge)).toBe("upcoming");
      });

      test('returns "active" when now is between start and end', () => {
        const challenge = makeChallenge("pending", -ONE_DAY, ONE_DAY * 6);
        expect(getEffectiveStatus(challenge)).toBe("active");
      });

      test('returns "completed" when end_date is in past', () => {
        const challenge = makeChallenge("pending", -ONE_DAY * 7, -ONE_HOUR);
        expect(getEffectiveStatus(challenge)).toBe("completed");
      });
    });

    describe("boundary conditions (half-open interval [start, end))", () => {
      test('returns "active" when now equals start_date (start-inclusive)', () => {
        // Create challenge where start is exactly now
        const now = Date.now();
        const challenge = {
          status: "pending",
          start_date: new Date(now).toISOString(),
          end_date: new Date(now + ONE_DAY).toISOString(),
        };
        expect(getEffectiveStatus(challenge)).toBe("active");
      });

      test('returns "completed" when now equals end_date (end-exclusive)', () => {
        // Create challenge where end is exactly now
        const now = Date.now();
        const challenge = {
          status: "pending",
          start_date: new Date(now - ONE_DAY).toISOString(),
          end_date: new Date(now).toISOString(),
        };
        expect(getEffectiveStatus(challenge)).toBe("completed");
      });

      test('returns "active" 1ms before end_date', () => {
        const now = Date.now();
        const challenge = {
          status: "pending",
          start_date: new Date(now - ONE_DAY).toISOString(),
          end_date: new Date(now + 1).toISOString(), // 1ms from now
        };
        expect(getEffectiveStatus(challenge)).toBe("active");
      });
    });

    describe("override statuses take precedence", () => {
      test('returns "cancelled" regardless of time when status is cancelled', () => {
        // Time says active, but status is cancelled
        const challenge = makeChallenge("cancelled", -ONE_DAY, ONE_DAY * 6);
        expect(getEffectiveStatus(challenge)).toBe("cancelled");
      });

      test('returns "archived" regardless of time when status is archived', () => {
        // Time says active, but status is archived
        const challenge = makeChallenge("archived", -ONE_DAY, ONE_DAY * 6);
        expect(getEffectiveStatus(challenge)).toBe("archived");
      });

      test("cancelled takes precedence even for upcoming challenges", () => {
        const challenge = makeChallenge("cancelled", ONE_DAY, ONE_DAY * 7);
        expect(getEffectiveStatus(challenge)).toBe("cancelled");
      });

      test("archived takes precedence even for completed challenges", () => {
        const challenge = makeChallenge("archived", -ONE_DAY * 7, -ONE_HOUR);
        expect(getEffectiveStatus(challenge)).toBe("archived");
      });
    });

    describe("non-override statuses use time-based logic", () => {
      test("pending status uses time-based logic", () => {
        expect(
          getEffectiveStatus(makeChallenge("pending", ONE_DAY, ONE_DAY * 7))
        ).toBe("upcoming");
        expect(
          getEffectiveStatus(makeChallenge("pending", -ONE_DAY, ONE_DAY * 6))
        ).toBe("active");
        expect(
          getEffectiveStatus(makeChallenge("pending", -ONE_DAY * 7, -ONE_HOUR))
        ).toBe("completed");
      });

      test("active status (column) still uses time-based logic", () => {
        // Even if DB status column says 'active', we derive from time
        expect(
          getEffectiveStatus(makeChallenge("active", ONE_DAY, ONE_DAY * 7))
        ).toBe("upcoming");
        expect(
          getEffectiveStatus(makeChallenge("active", -ONE_DAY * 7, -ONE_HOUR))
        ).toBe("completed");
      });

      test("completed status (column) still uses time-based logic", () => {
        // Even if DB status column says 'completed', we derive from time
        // (unless it's cancelled/archived)
        expect(
          getEffectiveStatus(makeChallenge("completed", -ONE_DAY, ONE_DAY * 6))
        ).toBe("active");
      });
    });
  });

  describe("canLogActivity", () => {
    test("returns true only when effective status is active", () => {
      // Active challenge
      expect(
        canLogActivity(makeChallenge("pending", -ONE_DAY, ONE_DAY * 6))
      ).toBe(true);
    });

    test("returns false for upcoming challenges", () => {
      expect(
        canLogActivity(makeChallenge("pending", ONE_DAY, ONE_DAY * 7))
      ).toBe(false);
    });

    test("returns false for completed challenges", () => {
      expect(
        canLogActivity(makeChallenge("pending", -ONE_DAY * 7, -ONE_HOUR))
      ).toBe(false);
    });

    test("returns false for cancelled challenges", () => {
      expect(
        canLogActivity(makeChallenge("cancelled", -ONE_DAY, ONE_DAY * 6))
      ).toBe(false);
    });

    test("returns false for archived challenges", () => {
      expect(
        canLogActivity(makeChallenge("archived", -ONE_DAY, ONE_DAY * 6))
      ).toBe(false);
    });
  });

  describe("getStatusLabel", () => {
    const cases: [EffectiveStatus, string][] = [
      ["upcoming", "Starting Soon"],
      ["active", "Active"],
      ["completed", "Completed"],
      ["cancelled", "Cancelled"],
      ["archived", "Archived"],
    ];

    test.each(cases)('returns "%s" for status "%s"', (status, expected) => {
      expect(getStatusLabel(status)).toBe(expected);
    });
  });

  describe("getStatusColor", () => {
    test("returns orange for upcoming", () => {
      expect(getStatusColor("upcoming")).toBe("#FF9500");
    });

    test("returns green for active", () => {
      expect(getStatusColor("active")).toBe("#34C759");
    });

    test("returns blue for completed", () => {
      expect(getStatusColor("completed")).toBe("#007AFF");
    });

    test("returns gray for cancelled", () => {
      expect(getStatusColor("cancelled")).toBe("#8E8E93");
    });

    test("returns gray for archived", () => {
      expect(getStatusColor("archived")).toBe("#8E8E93");
    });
  });
});
