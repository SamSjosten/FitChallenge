// src/components/v2/index.ts
// Barrel exports for V2 components

export { LoadingState } from "./LoadingState";
export type { LoadingStateProps, LoadingVariant } from "./LoadingState";

export { ErrorState } from "./ErrorState";
export type { ErrorStateProps, ErrorVariant } from "./ErrorState";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps, EmptyStateVariant } from "./EmptyState";

export { ChallengeCard, CompletedChallengeRow } from "./ChallengeCard";
export type {
  ChallengeCardProps,
  CompletedChallengeRowProps,
} from "./ChallengeCard";

export { InviteCard, InviteRow } from "./InviteCard";
export type { InviteCardProps, InviteRowProps } from "./InviteCard";

export { FriendRow, FriendRequestRow, SearchResultRow } from "./FriendRow";
export type {
  FriendRowProps,
  FriendRequestRowProps,
  SearchResultRowProps,
} from "./FriendRow";

// Phase 3A components
export { StreakBanner } from "./StreakBanner";
export type { StreakBannerProps } from "./StreakBanner";

export {
  ChallengeFilter,
  ActiveFilterBadge,
  CHALLENGE_FILTERS,
} from "./ChallengeFilter";
export type {
  ChallengeFilterProps,
  ChallengeFilterType,
  ActiveFilterBadgeProps,
  FilterOption,
} from "./ChallengeFilter";

export {
  ActivityRow,
  ActivityRowCompact,
  RecentActivityHeader,
  NoRecentActivity,
} from "./ActivityRow";
export type { ActivityRowProps, ActivityRowCompactProps } from "./ActivityRow";

export { Toast, useToast } from "./Toast";
export type { ToastProps } from "./Toast";

// Notification components (Phase 3B)
export { NotificationRow, NotificationRowCompact } from "./NotificationRow";
export type {
  NotificationRowProps,
  NotificationRowCompactProps,
} from "./NotificationRow";
// Re-export Notification type from service for consumers
export type { Notification } from "@/services/notifications";

export {
  NotificationFilters,
  NotificationHeader,
  SwipeHint,
  NotificationGroupHeader,
  groupNotificationsByTime,
  DEFAULT_NOTIFICATION_FILTERS,
} from "./NotificationFilters";
export type {
  NotificationFiltersProps,
  NotificationFilterType,
  NotificationHeaderProps,
  NotificationGroupHeaderProps,
} from "./NotificationFilters";

// Activity components (Phase 3C)
export { ActivityCard, ActivityListItem } from "./ActivityCard";
export type { ActivityCardProps, ActivityListItemProps } from "./ActivityCard";

// Notifications screen
export { V2NotificationsScreen } from "./NotificationsScreen";
