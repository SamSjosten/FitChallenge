#!/usr/bin/env node
/**
 * Standalone test script to verify time formatting boundary conditions
 * Run with: node scripts/verify-time-boundaries.js
 *
 * This tests the critical boundary cases that caused bugs:
 * - 59.5 minutes should show "1 hour" (not "60 min")
 * - 23.5 hours should show "Tomorrow" (not "24 hours")
 */

// Mock the server time offset (normally synced from auth)
let serverTimeOffset = 0;

function getServerNow() {
  return new Date(Date.now() + serverTimeOffset);
}

/**
 * Core formatTimeUntil implementation (copied from serverTime.ts for testing)
 */
function formatTimeUntil(targetDate, options = {}) {
  const { prefix, nowOverride } = options;

  const target =
    typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const now = nowOverride ?? getServerNow();
  const diffMs = target.getTime() - now.getTime();

  // Past dates
  if (diffMs <= 0) {
    return prefix ? `${prefix} now` : "Now";
  }

  const diffMinutes = diffMs / (1000 * 60);
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Less than 1 hour - show minutes
  if (diffMinutes < 60) {
    const mins = Math.round(diffMinutes);
    // Handle edge case: 59.5 min rounds to 60, show "1 hour" instead
    if (mins >= 60) {
      return prefix ? `${prefix} in 1 hour` : "1 hour";
    }
    return prefix ? `${prefix} in ${mins} min` : `${mins} min`;
  }

  // Less than 24 hours - show hours
  if (diffHours < 24) {
    const hours = Math.round(diffHours);
    // Handle edge case: 23.5 hours rounds to 24, show "Tomorrow" instead
    if (hours >= 24) {
      return prefix ? `${prefix} tomorrow` : "Tomorrow";
    }
    const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
    return prefix ? `${prefix} in ${hourText}` : hourText;
  }

  // Tomorrow check (within next 48 hours and target is next calendar day)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  if (target >= tomorrow && target < dayAfterTomorrow) {
    return prefix ? `${prefix} tomorrow` : "Tomorrow";
  }

  // Days (using floor for "X days")
  const days = Math.floor(diffDays);
  if (days === 1) {
    return prefix ? `${prefix} in 1 day` : "1 day";
  }
  return prefix ? `${prefix} in ${days} days` : `${days} days`;
}

/**
 * Helper to create ISO date string from offset
 */
function isoFromNow(amount, unit, now = new Date()) {
  const ms = {
    sec: 1000,
    min: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() + amount * ms[unit]).toISOString();
}

// Test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Expected: ${e.expected}`);
    console.log(`  Actual:   ${e.actual}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        const e = new Error();
        e.expected = expected;
        e.actual = actual;
        throw e;
      }
    },
  };
}

console.log("\n=== Time Formatting Boundary Tests ===\n");

// CRITICAL BOUNDARY TESTS
console.log("--- Critical Boundary Cases ---");

test('59.5 minutes rounds to "1 hour" (not "60 min")', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(59.5, "min", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("1 hour");
});

test('23.5 hours rounds to "Tomorrow" (not "24 hours")', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(23.5, "hour", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("Tomorrow");
});

test('59.4 minutes shows "59 min"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(59.4, "min", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("59 min");
});

test('23.4 hours shows "23 hours"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(23.4, "hour", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("23 hours");
});

// STANDARD CASES
console.log("\n--- Standard Cases ---");

test('30 seconds shows "1 min"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(30, "sec", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("1 min");
});

test('5 minutes shows "5 min"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(5, "min", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("5 min");
});

test('1 hour shows "1 hour"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(1, "hour", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("1 hour");
});

test('6 hours shows "6 hours"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(6, "hour", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("6 hours");
});

test('3 days shows "3 days"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(3, "day", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("3 days");
});

// PREFIX TESTS
console.log("\n--- Prefix Tests ---");

test('with prefix "Starts": "Starts in 5 min"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(5, "min", now);
  expect(formatTimeUntil(target, { prefix: "Starts", nowOverride: now })).toBe(
    "Starts in 5 min",
  );
});

test('with prefix at 59.5 min: "Starts in 1 hour"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(59.5, "min", now);
  expect(formatTimeUntil(target, { prefix: "Starts", nowOverride: now })).toBe(
    "Starts in 1 hour",
  );
});

test('with prefix at 23.5 hours: "Starts tomorrow"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(23.5, "hour", now);
  expect(formatTimeUntil(target, { prefix: "Starts", nowOverride: now })).toBe(
    "Starts tomorrow",
  );
});

// EDGE CASES
console.log("\n--- Edge Cases ---");

test('past date shows "Now"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  const target = isoFromNow(-5, "min", now);
  expect(formatTimeUntil(target, { nowOverride: now })).toBe("Now");
});

test('exactly 0 diff shows "Now"', () => {
  const now = new Date("2025-01-15T12:00:00Z");
  expect(formatTimeUntil(now.toISOString(), { nowOverride: now })).toBe("Now");
});

// SUMMARY
console.log("\n=== Results ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("");

if (failed > 0) {
  console.log("❌ TESTS FAILED - Boundary conditions not properly handled");
  process.exit(1);
} else {
  console.log("✅ ALL TESTS PASSED - Time formatting is correct");
  process.exit(0);
}
