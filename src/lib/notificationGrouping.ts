// src/lib/notificationGrouping.ts
// Pure utility for grouping notifications by time — extracted for testability

import { getServerNow } from "@/lib/serverTime";

export function groupNotificationsByTime<T extends { created_at: string }>(
  notifications: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const now = getServerNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  for (const notification of notifications) {
    const date = new Date(notification.created_at);
    let group: string;

    if (date >= today) {
      group = "Today";
    } else if (date >= yesterday) {
      group = "Yesterday";
    } else if (date >= weekAgo) {
      group = "This Week";
    } else {
      group = "Earlier";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(notification);
  }

  return groups;
}
