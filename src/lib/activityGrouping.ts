import { getServerNow } from "@/lib/serverTime";

const olderActivityFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

export function groupActivitiesByDate<T extends { recorded_at: string }>(
  activities: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const now = getServerNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);

  for (const activity of activities) {
    const date = new Date(activity.recorded_at);
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let group: string;
    if (activityDate.getTime() === today.getTime()) {
      group = "Today";
    } else if (activityDate.getTime() === yesterday.getTime()) {
      group = "Yesterday";
    } else {
      group = olderActivityFormatter.format(activityDate);
    }

    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(activity);
  }

  return groups;
}
