// src/__tests__/unit/notificationGrouping.test.ts
// Unit tests for groupNotificationsByTime — validates server time usage

// Mock server time to a fixed date: 2026-03-15 12:00:00 UTC
const MOCK_NOW = new Date("2026-03-15T12:00:00.000Z");

jest.mock("@/lib/serverTime", () => ({
  getServerNow: () => MOCK_NOW,
}));

import { groupNotificationsByTime } from "@/lib/notificationGrouping";

function makeNotification(created_at: string) {
  return { created_at };
}

describe("groupNotificationsByTime", () => {
  it('groups a notification created today as "Today"', () => {
    const notifications = [makeNotification("2026-03-15T08:00:00.000Z")];
    const groups = groupNotificationsByTime(notifications);

    expect(groups["Today"]).toHaveLength(1);
    expect(groups["Yesterday"]).toBeUndefined();
  });

  it('groups a notification created yesterday as "Yesterday"', () => {
    const notifications = [makeNotification("2026-03-14T20:00:00.000Z")];
    const groups = groupNotificationsByTime(notifications);

    expect(groups["Yesterday"]).toHaveLength(1);
    expect(groups["Today"]).toBeUndefined();
  });

  it('groups a notification created 3 days ago as "This Week"', () => {
    const notifications = [makeNotification("2026-03-12T10:00:00.000Z")];
    const groups = groupNotificationsByTime(notifications);

    expect(groups["This Week"]).toHaveLength(1);
    expect(groups["Today"]).toBeUndefined();
    expect(groups["Yesterday"]).toBeUndefined();
  });

  it('groups a notification created 10 days ago as "Earlier"', () => {
    const notifications = [makeNotification("2026-03-05T10:00:00.000Z")];
    const groups = groupNotificationsByTime(notifications);

    expect(groups["Earlier"]).toHaveLength(1);
    expect(groups["Today"]).toBeUndefined();
    expect(groups["This Week"]).toBeUndefined();
  });

  it("correctly distributes multiple notifications across groups", () => {
    const notifications = [
      makeNotification("2026-03-15T09:00:00.000Z"), // Today
      makeNotification("2026-03-14T15:00:00.000Z"), // Yesterday
      makeNotification("2026-03-11T10:00:00.000Z"), // This Week
      makeNotification("2026-03-01T10:00:00.000Z"), // Earlier
    ];
    const groups = groupNotificationsByTime(notifications);

    expect(groups["Today"]).toHaveLength(1);
    expect(groups["Yesterday"]).toHaveLength(1);
    expect(groups["This Week"]).toHaveLength(1);
    expect(groups["Earlier"]).toHaveLength(1);
  });
});
