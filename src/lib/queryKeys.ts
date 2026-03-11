// src/lib/queryKeys.ts
// Centralized React Query key factories.
//
// M1: Moved from individual hook files to avoid hook-to-hook import coupling.
// Each hook re-exports its keys for backward compatibility.
// New code should import from this module directly.
//
// healthQueryKeys intentionally excluded — self-contained in health service.

// =============================================================================
// CHALLENGE KEYS
// =============================================================================

export const challengeKeys = {
  all: ["challenges"] as const,
  active: () => [...challengeKeys.all, "active"] as const,
  pending: () => [...challengeKeys.all, "pending"] as const,
  startingSoon: () => [...challengeKeys.all, "startingSoon"] as const,
  detail: (id: string) => [...challengeKeys.all, "detail", id] as const,
  leaderboard: (id: string) =>
    [...challengeKeys.all, "leaderboard", id] as const,
};

// =============================================================================
// ACTIVITY KEYS
// =============================================================================

export const activityKeys = {
  all: ["activities"] as const,
  recent: (userId: string, limit?: number) =>
    [...activityKeys.all, "recent", userId, limit] as const,
  forChallenge: (userId: string, challengeId: string) =>
    [...activityKeys.all, "challenge", userId, challengeId] as const,
  summary: (userId: string, challengeId: string) =>
    [...activityKeys.all, "summary", userId, challengeId] as const,
};

// =============================================================================
// NOTIFICATION KEYS
// =============================================================================

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationsKeys.all, "list"] as const,
  unreadCount: () => [...notificationsKeys.all, "unreadCount"] as const,
};

// =============================================================================
// FRIENDS KEYS
// =============================================================================

export const friendsKeys = {
  all: ["friends"] as const,
  list: () => [...friendsKeys.all, "list"] as const,
  pending: () => [...friendsKeys.all, "pending"] as const,
};
