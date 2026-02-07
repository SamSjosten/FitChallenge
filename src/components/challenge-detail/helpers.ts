// src/components/challenge-detail/helpers.ts
//
// Shared helpers for ChallengeDetail sub-components.
// All time-dependent functions require explicit serverNow parameter —
// they never call new Date() or getServerNow() internally,
// so the caller must provide server-authoritative time.

/**
 * Format large numbers with K suffix.
 * Example: 1500 → "1.5K", 800 → "800"
 */
export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Human-readable win condition label.
 */
export function formatWinCondition(condition: string): string {
  const labels: Record<string, string> = {
    highest_total: "Highest Total",
    first_to_goal: "First to Goal",
    longest_streak: "Longest Streak",
    all_complete: "All Complete",
  };
  return labels[condition] || condition;
}

/**
 * Calculate elapsed days since a start date.
 * Requires server-authoritative now — never uses device clock.
 */
export function getDaysElapsed(
  startDate: string | Date,
  serverNow: Date,
): number {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const diffMs = serverNow.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Format an activity timestamp relative to server-authoritative "now".
 *
 * Returns:
 * - "Today, 2:30 PM" if same day as serverNow
 * - "Yesterday, 10:15 AM" if previous day
 * - "Jan 5, 2:30 PM" otherwise
 *
 * Uses serverNow for day boundary calculation (contract compliance),
 * but formats the activity's local time as-is (display convenience).
 */
export function formatActivityDate(dateStr: string, serverNow: Date): string {
  const date = new Date(dateStr);

  // Day boundaries based on server time, not device time
  const today = new Date(
    serverNow.getFullYear(),
    serverNow.getMonth(),
    serverNow.getDate(),
  );
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date >= today) {
    return `Today, ${timeStr}`;
  } else if (date >= yesterday) {
    return `Yesterday, ${timeStr}`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

/**
 * Format the "days left" / status badge text based on effective status.
 * Handles the edge cases that the old code got wrong:
 * - completed: "Completed" (not "0 days left")
 * - upcoming: "Starts in X days" (not "X days left")
 * - active, 0 days: "Last day!" (not "0 days left")
 * - active, 1 day: "1 day left" (not "1 days left")
 */
export function formatTimeRemaining(
  status: "upcoming" | "active" | "completed" | "cancelled" | "archived",
  daysLeft: number,
  daysUntilStart?: number,
): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "archived":
      return "Archived";
    case "upcoming": {
      if (daysUntilStart !== undefined && daysUntilStart > 0) {
        return daysUntilStart === 1
          ? "Starts tomorrow"
          : `Starts in ${daysUntilStart} days`;
      }
      return "Starting soon";
    }
    case "active": {
      if (daysLeft <= 0) return "Last day!";
      return daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
    }
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const ACTIVITY_ICONS: Record<string, string> = {
  steps: "👟",
  active_minutes: "⏱️",
  workouts: "💪",
  distance: "🏃",
  custom: "🎯",
};

export const RANK_EMOJI: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export const LEADERBOARD_DISPLAY_LIMIT = 5;
export const TREND_THRESHOLD_DAYS = 4;
