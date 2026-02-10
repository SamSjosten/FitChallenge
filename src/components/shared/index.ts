// src/components/shared/index.ts
// Shared components used across multiple features

// Feedback states
export { LoadingState } from "./LoadingState";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";

// Primitives (extracted from ui.tsx)
export { Avatar, type AvatarProps } from "./Avatar";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";
// Challenge components (used by challenges + home screens)
export {
  ChallengeCard,
  CompletedChallengeRow,
  type ChallengeCardProps,
  type CompletedChallengeRowProps,
} from "./ChallengeCard";
export {
  ChallengeFilter,
  ActiveFilterBadge,
  CHALLENGE_FILTERS,
  type ChallengeFilterType,
  type ChallengeFilterProps,
  type ActiveFilterBadgeProps,
} from "./ChallengeFilter";
export {
  InviteCard,
  InviteRow,
  type InviteCardProps,
  type InviteRowProps,
} from "./InviteCard";

// Friends components
export {
  FriendRow,
  FriendRequestRow,
  SearchResultRow,
  type FriendRowProps,
  type FriendRequestRowProps,
  type SearchResultRowProps,
} from "./FriendRow";

// Activity components
export {
  ActivityCard,
  ActivityListItem,
  type ActivityCardProps,
  type ActivityListItemProps,
} from "./ActivityCard";
