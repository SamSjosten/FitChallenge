// src/lib/__tests__/formatters.test.ts
// Tests for shared formatting utilities
//
// These are display-only functions — bugs here cause UI glitches,
// not data corruption. Still worth covering since they're pure functions.

// Mock serverTime to avoid react-native import chain
// (formatters.ts re-exports formatTimeAgo from serverTime.ts → supabase.ts → react-native-url-polyfill)
jest.mock("../serverTime", () => ({
  formatTimeAgo: jest.fn(),
}));

import { formatNumber, formatShortDate } from "../formatters";

// =============================================================================
// formatNumber
// =============================================================================

describe("formatNumber", () => {
  // formatNumber uses toLocaleString() which respects device locale.
  // Tests must not assume en-US comma formatting — a German device
  // produces "1.234.567" and that's correct behavior.

  test("returns a string", () => {
    expect(typeof formatNumber(1234567)).toBe("string");
  });

  test("output differs from raw number string for large values", () => {
    // Any locale will add some separator for 1,234,567
    const result = formatNumber(1234567);
    expect(result).not.toBe("1234567");
    expect(result.length).toBeGreaterThan("1234567".length);
  });

  test("leaves small numbers unchanged", () => {
    // Numbers under 1000 have no separators in any locale
    expect(formatNumber(999)).toBe("999");
  });

  test("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  test("handles negative numbers", () => {
    const result = formatNumber(-1234);
    expect(result).toContain("1234".substring(0, 1)); // at minimum contains digits
    expect(result.length).toBeGreaterThan(2); // has separator or sign
  });

  test("is consistent across calls (deterministic)", () => {
    expect(formatNumber(50000)).toBe(formatNumber(50000));
  });
});

// =============================================================================
// formatShortDate
// =============================================================================

describe("formatShortDate", () => {
  test("formats ISO date string to short format", () => {
    // Use a fixed date to avoid timezone flakiness
    const result = formatShortDate("2025-01-15T12:00:00.000Z");
    expect(result).toMatch(/Jan\s+15/);
  });

  test("formats different months correctly", () => {
    expect(formatShortDate("2025-06-01T12:00:00.000Z")).toMatch(/Jun\s+1/);
    expect(formatShortDate("2025-12-25T12:00:00.000Z")).toMatch(/Dec\s+25/);
  });

  test("handles date strings without time component", () => {
    // new Date("2025-03-10") is valid — should not throw
    const result = formatShortDate("2025-03-10");
    expect(result).toMatch(/Mar\s+10/);
  });

  test("returns a string (not undefined/null)", () => {
    const result = formatShortDate("2025-01-01T00:00:00.000Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});