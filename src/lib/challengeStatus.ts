// src/lib/challengeStatus.ts
// Effective status derived from time bounds
// Mirrors the DB function: challenge_effective_status()
//
// BOUNDARY CONVENTION: Half-open interval [start, end)
//   Active range: start_date <= now < end_date
//   This matches activity log queries: recorded_at >= start AND recorded_at < end

export type EffectiveStatus =
  | "upcoming"
  | "active"
  | "completed"
  | "cancelled"
  | "archived";

/**
 * Get effective challenge status from time bounds
 * Single source of truth - same logic as DB function
 */
export function getEffectiveStatus(challenge: {
  status: string | null;
  start_date: string;
  end_date: string;
}): EffectiveStatus {
  // Overrides take precedence
  if (challenge.status === "cancelled" || challenge.status === "archived") {
    return challenge.status as EffectiveStatus;
  }

  const now = new Date();
  const start = new Date(challenge.start_date);
  const end = new Date(challenge.end_date);

  if (now < start) return "upcoming";
  if (now >= end) return "completed";
  return "active";
}

/**
 * Check if activity logging is allowed
 */
export function canLogActivity(challenge: {
  status: string | null;
  start_date: string;
  end_date: string;
}): boolean {
  return getEffectiveStatus(challenge) === "active";
}

/**
 * Get display label for status
 */
export function getStatusLabel(status: EffectiveStatus): string {
  switch (status) {
    case "upcoming":
      return "Starting Soon";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "archived":
      return "Archived";
  }
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: EffectiveStatus): string {
  switch (status) {
    case "upcoming":
      return "#FF9500"; // Orange
    case "active":
      return "#34C759"; // Green
    case "completed":
      return "#007AFF"; // Blue
    case "cancelled":
    case "archived":
      return "#8E8E93"; // Gray
  }
}

