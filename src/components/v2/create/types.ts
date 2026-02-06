// src/components/v2/create/types.ts
// Shared types for Challenge Create V2 multi-step flow

import type { ChallengeType } from "@/types/database";
import type { FriendWithProfile } from "@/services/friends";

// =============================================================================
// STEP NAVIGATION
// =============================================================================

export type CreateStep =
  | "mode"
  | "type"
  | "workoutPicker"
  | "details"
  | "invite"
  | "review"
  | "success";

export type ChallengeMode = "social" | "solo";

// =============================================================================
// FORM STATE
// =============================================================================

export type DurationPresetId = "1week" | "2weeks" | "1month" | "custom";

export type WinConditionId = "highest_total" | "first_to_goal";

export interface CreateFormData {
  name: string;
  description: string;
  goal: string;
  customActivityName: string;
  customUnit: string;
  durationPreset: DurationPresetId;
  customDurationDays: string;
  winCondition: WinConditionId;
  dailyTarget: string;
  startMode: "now" | "scheduled";
  scheduledStart: Date;
}

export const INITIAL_FORM_DATA: CreateFormData = {
  name: "",
  description: "",
  goal: "",
  customActivityName: "",
  customUnit: "",
  durationPreset: "1week",
  customDurationDays: "7",
  winCondition: "highest_total",
  dailyTarget: "",
  startMode: "now",
  scheduledStart: (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  })(),
};

// =============================================================================
// CHALLENGE TYPE CONFIG
// =============================================================================

export interface ChallengeTypeConfig {
  id: ChallengeType;
  name: string;
  desc: string;
  unit: string;
  goalHint: string;
  placeholder: string;
  autoSync: boolean;
}

export const CHALLENGE_TYPES: ChallengeTypeConfig[] = [
  {
    id: "steps",
    name: "Steps",
    desc: "Track total steps over the challenge period",
    unit: "steps",
    goalHint: "70,000 steps is typical for a week",
    placeholder: "70000",
    autoSync: true,
  },
  {
    id: "workouts",
    name: "Workouts",
    desc: "Track total workouts completed",
    unit: "workouts",
    goalHint: "4-5 workouts per week is a good target",
    placeholder: "20",
    autoSync: true,
  },
  {
    id: "distance",
    name: "Distance",
    desc: "Track kilometers across running, cycling, etc.",
    unit: "km",
    goalHint: "A 5K run = 5 kilometers",
    placeholder: "50",
    autoSync: true,
  },
  {
    id: "active_minutes",
    name: "Active Minutes",
    desc: "Track minutes of elevated activity",
    unit: "min",
    goalHint: "150 min/week is recommended",
    placeholder: "600",
    autoSync: true,
  },
  {
    id: "custom",
    name: "Custom",
    desc: "Track anything with manual logging",
    unit: "units",
    goalHint: "Set any goal that makes sense",
    placeholder: "100",
    autoSync: false,
  },
];

// =============================================================================
// DURATION PRESETS
// =============================================================================

export interface DurationPreset {
  id: DurationPresetId;
  label: string;
  days: number;
}

export const DURATION_PRESETS: DurationPreset[] = [
  { id: "1week", label: "1 Week", days: 7 },
  { id: "2weeks", label: "2 Weeks", days: 14 },
  { id: "1month", label: "1 Month", days: 30 },
  { id: "custom", label: "Custom", days: 0 },
];

// =============================================================================
// WIN CONDITIONS
// =============================================================================

export interface WinConditionConfig {
  id: WinConditionId;
  label: string;
  desc: string;
}

export const WIN_CONDITIONS: WinConditionConfig[] = [
  {
    id: "highest_total",
    label: "Highest Total",
    desc: "Most progress wins",
  },
  {
    id: "first_to_goal",
    label: "First to Goal",
    desc: "Race to the target",
  },
];

// =============================================================================
// STEP PROPS
// =============================================================================

export interface StepModeProps {
  onSelect: (mode: ChallengeMode) => void;
  onClose: () => void;
}

export interface StepTypeProps {
  mode: ChallengeMode;
  onSelect: (type: ChallengeType) => void;
  onBack: () => void;
}

export interface StepDetailsProps {
  mode: ChallengeMode;
  challengeType: ChallengeType;
  formData: CreateFormData;
  setFormData: (data: CreateFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface StepInviteProps {
  friends: FriendWithProfile[];
  friendsLoading: boolean;
  selectedFriendIds: string[];
  setSelectedFriendIds: (ids: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface StepReviewProps {
  mode: ChallengeMode;
  challengeType: ChallengeType;
  formData: CreateFormData;
  friends: FriendWithProfile[];
  selectedFriendIds: string[];
  onBack: () => void;
}

export interface StepSuccessProps {
  mode: ChallengeMode;
  challengeName: string;
  inviteCount: number;
  onDone: () => void;
}
