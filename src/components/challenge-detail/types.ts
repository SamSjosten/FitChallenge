// src/components/challenge-detail/types.ts
//
// COMPONENT CONTRACTS — ChallengeDetail Modularization
//
// These types define the interfaces between extracted sub-components.
// Design principle: if a component needs a concern to render correctly,
// that concern is a REQUIRED prop — not something it computes internally.
//
// This means:
// - Forgetting to pass status → type error (not a runtime oversight)
// - Using device time instead of server time → type error (not a contract violation)
// - Rendering without viewer role awareness → type error (not a dead-end UX)

import type { ChallengeWithParticipation, LeaderboardEntry } from "@/services/challenges";
import type { ProfilePublic } from "@/types/database";
import type { EffectiveStatus } from "@/lib/challengeStatus";

// =============================================================================
// FIRST-CLASS CONCERNS
// =============================================================================

/**
 * The viewer's relationship to this challenge.
 * Determines what they can see and do — not a display hint, a rendering branch.
 *
 * - creator:  Full visibility, can invite, can cancel
 * - accepted: Can log activity (if active), can see leaderboard, can leave
 * - pending:  Can accept/decline, cannot see leaderboard or participants
 */
export type ViewerRole = "creator" | "accepted" | "pending";

/**
 * Pre-computed values derived from challenge + leaderboard data.
 * Computed ONCE in the orchestrator, threaded to sub-components that need them.
 * No sub-component should re-derive these.
 */
export interface ChallengeComputedValues {
  myProgress: number;
  myRank: number;
  goalValue: number;
  /** Clamped to [0, 100] — no component should have to clamp again */
  progressPercent: number;
  daysLeft: number;
  daysElapsed: number;
  participantCount: number;
  todayProgress: number;
  avgPerDay: number;
  showTrend: boolean;
  trend: number;
}

// =============================================================================
// HEADER CARD
// =============================================================================

export interface HeaderCardProps {
  challenge: ChallengeWithParticipation;
  computedValues: ChallengeComputedValues;

  /** Required — HeaderCard branches its entire rendering on this */
  status: EffectiveStatus;

  /** Required — determines whether Log Activity button appears */
  canLog: boolean;

  onLogActivity: () => void;
}

// =============================================================================
// PENDING INVITE BANNER
// =============================================================================

/**
 * Shown ONLY when viewerRole === "pending".
 * Replaces the dead-end UX where pending invitees see a detail screen
 * with no way to accept/decline.
 */
export interface PendingInviteBannerProps {
  challenge: ChallengeWithParticipation;
  onAccept: () => void;
  onDecline: () => void;
  isResponding: boolean;
}

// =============================================================================
// LEADERBOARD SECTION
// =============================================================================

export interface LeaderboardSectionProps {
  leaderboard: LeaderboardEntry[];
  goalValue: number;
  currentUserId: string;

  /**
   * Required — determines gating behavior.
   * When "pending", renders lock message instead of leaderboard.
   * The parent doesn't do this gating — the component owns it.
   */
  viewerRole: ViewerRole;

  showAll: boolean;
  onToggleShowAll: () => void;
}

// =============================================================================
// CHALLENGE INFO SECTION
// =============================================================================

export interface ChallengeInfoSectionProps {
  challenge: ChallengeWithParticipation;
  status: EffectiveStatus;
}

// =============================================================================
// YOUR ACTIVITY SECTION
// =============================================================================

export interface YourActivitySectionProps {
  activities: ReadonlyArray<{
    id: string;
    value: number;
    recorded_at: string;
    source: string;
  }>;
  goalUnit: string;

  /**
   * Required — server-authoritative "now" for date formatting.
   * Prevents components from calling new Date() and violating
   * the server-time contract.
   */
  serverNow: Date;
}

// =============================================================================
// LOG ACTIVITY SHEET
// =============================================================================

export interface LogActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (value: number) => void;
  onSubmitWorkout?: (workoutType: string, durationMinutes: number) => void;
  isLoading: boolean;
  goalUnit: string;
  challengeType: string;
  /** If set, restricts which workout types can be logged. null = all types. */
  allowedWorkoutTypes?: string[] | null;
}

// =============================================================================
// MORE MENU
// =============================================================================

export interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;

  /** Required — determines menu items shown */
  viewerRole: ViewerRole;

  /** Required — prevents hardcoded positioning that ignores device chrome */
  topInset: number;

  onInvite: () => void;
  onLeave: () => void;
  onCancel: () => void;
}

// =============================================================================
// INVITE MODAL
// =============================================================================

/**
 * InviteModal OWNS its own search state.
 * Parent provides challenge context and the invite action.
 * No more leaking searchQuery/searchResults/searching into the orchestrator.
 */
export interface InviteModalProps {
  visible: boolean;
  onClose: () => void;

  /** The challenge ID — used to filter existing participants */
  challengeId: string;

  /** Existing participant user IDs — modal filters these from results */
  existingParticipantIds: ReadonlyArray<string>;

  /** Fires when user taps Invite on a search result */
  onInvite: (userId: string) => Promise<void>;
}
