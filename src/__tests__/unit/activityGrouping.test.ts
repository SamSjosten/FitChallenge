const mockGetServerNow = jest.fn();

jest.mock("@/lib/serverTime", () => ({
  getServerNow: () => mockGetServerNow(),
}));

import { groupActivitiesByDate } from "@/lib/activityGrouping";

describe("groupActivitiesByDate", () => {
  const fixedNow = new Date("2025-03-20T12:00:00Z");

  beforeEach(() => {
    mockGetServerNow.mockReturnValue(fixedNow);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('groups activities into "Today", "Yesterday", and formatted older dates', () => {
    const olderRecordedAt = new Date(
      fixedNow.getFullYear(),
      fixedNow.getMonth(),
      fixedNow.getDate() - 2,
      12,
      0,
      0,
    ).toISOString();
    const expectedOlderLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date(olderRecordedAt));

    const grouped = groupActivitiesByDate([
      {
        id: "today",
        recorded_at: new Date(
          fixedNow.getFullYear(),
          fixedNow.getMonth(),
          fixedNow.getDate(),
          9,
          30,
          0,
        ).toISOString(),
      },
      {
        id: "yesterday",
        recorded_at: new Date(
          fixedNow.getFullYear(),
          fixedNow.getMonth(),
          fixedNow.getDate() - 1,
          15,
          0,
          0,
        ).toISOString(),
      },
      {
        id: "older",
        recorded_at: olderRecordedAt,
      },
    ]);

    expect(grouped.Today?.map((activity) => activity.id)).toEqual(["today"]);
    expect(grouped.Yesterday?.map((activity) => activity.id)).toEqual(["yesterday"]);
    expect(grouped[expectedOlderLabel]?.map((activity) => activity.id)).toEqual(["older"]);
  });

  test("keeps near-midnight activities on the correct local day boundary", () => {
    const grouped = groupActivitiesByDate([
      {
        id: "today-early",
        recorded_at: new Date(
          fixedNow.getFullYear(),
          fixedNow.getMonth(),
          fixedNow.getDate(),
          0,
          5,
          0,
        ).toISOString(),
      },
      {
        id: "yesterday-late",
        recorded_at: new Date(
          fixedNow.getFullYear(),
          fixedNow.getMonth(),
          fixedNow.getDate() - 1,
          23,
          55,
          0,
        ).toISOString(),
      },
    ]);

    expect(grouped.Today?.map((activity) => activity.id)).toEqual(["today-early"]);
    expect(grouped.Yesterday?.map((activity) => activity.id)).toEqual(["yesterday-late"]);
  });
});
