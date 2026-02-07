// src/components/home/index.ts
// Home screen components

export {
  LeaderboardPreview,
  MAX_LEADERBOARD_PREVIEW,
} from "./LeaderboardPreview";
export type { LeaderboardPreviewProps } from "./LeaderboardPreview";

export { ExpandableChallengeCard } from "./ExpandableChallengeCard";
export type { ExpandableChallengeCardProps } from "./ExpandableChallengeCard";

export { SectionHeader } from "./SectionHeader";
export type { SectionHeaderProps, SectionVariant } from "./SectionHeader";

export { StartingSoonCard } from "./StartingSoonCard";
export type { StartingSoonCardProps } from "./StartingSoonCard";

// Home-screen-only components
export { StreakBanner } from "./StreakBanner";
export type { StreakBannerProps } from "./StreakBanner";

export {
  ActivityRow,
  ActivityRowCompact,
  RecentActivityHeader,
  NoRecentActivity,
} from "./ActivityRow";
export type {
  ActivityRowProps,
  ActivityRowCompactProps,
  RecentActivityHeaderProps,
} from "./ActivityRow";
