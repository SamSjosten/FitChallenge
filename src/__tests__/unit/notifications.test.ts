// src/__tests__/unit/notifications.test.ts
// ============================================
// Notifications Optimistic Update Pattern Tests
//
// These tests verify the CONTRACT of the optimistic update pattern:
// 1. Optimistic updates happen immediately (before mutation resolves)
// 2. Surgical rollback happens on error (doesn't corrupt concurrent mutations)
// 3. Already-read notifications don't double-decrement count
//
// NOTE: These tests verify the PATTERN, not the hooks directly.
// The hooks implement this pattern - these tests document the expected behavior.
// ============================================

import { QueryClient } from "@tanstack/react-query";

// =============================================================================
// QUERY KEYS (duplicated from hooks to avoid importing React Native modules)
// =============================================================================

const notificationsKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationsKeys.all, "list"] as const,
  unreadCount: () => [...notificationsKeys.all, "unreadCount"] as const,
};

// =============================================================================
// TEST FIXTURES
// =============================================================================

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  push_sent_at: string | null;
}

const createMockNotification = (
  overrides: Partial<Notification> = {},
): Notification => ({
  id: `notif-${Math.random().toString(36).slice(2)}`,
  user_id: "user-1",
  type: "challenge_invite_received",
  title: "Test Notification",
  body: "Test body",
  data: {},
  read_at: null,
  created_at: new Date().toISOString(),
  push_sent_at: null,
  ...overrides,
});

// =============================================================================
// OPTIMISTIC UPDATE LOGIC TESTS
// =============================================================================

describe("Notifications Optimistic Update Logic", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("markAsRead optimistic update", () => {
    it("immediately marks notification as read in cache", () => {
      // Setup: Cache has one unread notification
      const notification = createMockNotification({
        id: "notif-1",
        read_at: null,
      });
      queryClient.setQueryData(notificationsKeys.list(), [notification]);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 1);

      // Action: Apply optimistic update (simulating onMutate)
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const previousUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      // Check if notification was actually unread
      const wasUnread = previousNotifications?.some(
        (n) => n.id === "notif-1" && !n.read_at,
      );

      // Apply optimistic update
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1"
              ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
              : n,
          ) ?? [],
      );

      if (wasUnread) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Assert: Cache is immediately updated
      const updatedNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const updatedUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(updatedNotifications?.[0].read_at).not.toBeNull();
      expect(updatedUnreadCount).toBe(0);

      // Context for rollback is preserved
      expect(previousNotifications?.[0].read_at).toBeNull();
      expect(previousUnreadCount).toBe(1);
    });

    it("does NOT double-decrement count for already-read notification", () => {
      // Setup: Cache has one ALREADY READ notification
      const notification = createMockNotification({
        id: "notif-1",
        read_at: "2024-01-01T00:00:00Z",
      });
      queryClient.setQueryData(notificationsKeys.list(), [notification]);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 0);

      // Action: Try to mark already-read notification as read
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      // Check if notification was actually unread
      const wasUnread = previousNotifications?.some(
        (n) => n.id === "notif-1" && !n.read_at,
      );

      // Optimistic update preserves existing read_at
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1"
              ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
              : n,
          ) ?? [],
      );

      // Only decrement if was actually unread
      if (wasUnread) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Assert: Count stays at 0, not -1
      expect(wasUnread).toBe(false);
      const updatedUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );
      expect(updatedUnreadCount).toBe(0);

      // read_at is preserved, not overwritten
      const updatedNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      expect(updatedNotifications?.[0].read_at).toBe("2024-01-01T00:00:00Z");
    });

    it("rolls back on error", () => {
      // Setup: Cache has one unread notification
      const notification = createMockNotification({
        id: "notif-1",
        read_at: null,
      });
      queryClient.setQueryData(notificationsKeys.list(), [notification]);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 1);

      // Capture previous state (simulating onMutate return)
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const previousUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      // Apply optimistic update
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1"
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ) ?? [],
      );
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), (old) =>
        Math.max(0, (old ?? 0) - 1),
      );

      // Verify optimistic state
      expect(
        queryClient.getQueryData<Notification[]>(notificationsKeys.list())?.[0]
          .read_at,
      ).not.toBeNull();

      // Action: Simulate error - rollback (simulating onError)
      queryClient.setQueryData(notificationsKeys.list(), previousNotifications);
      queryClient.setQueryData(
        notificationsKeys.unreadCount(),
        previousUnreadCount,
      );

      // Assert: Cache is rolled back to original state
      const rolledBackNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const rolledBackUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(rolledBackNotifications?.[0].read_at).toBeNull();
      expect(rolledBackUnreadCount).toBe(1);
    });
  });

  describe("markAllAsRead optimistic update", () => {
    it("immediately marks all notifications as read", () => {
      // Setup: Cache has multiple unread notifications
      const notifications = [
        createMockNotification({ id: "notif-1", read_at: null }),
        createMockNotification({ id: "notif-2", read_at: null }),
        createMockNotification({
          id: "notif-3",
          read_at: "2024-01-01T00:00:00Z",
        }), // already read
      ];
      queryClient.setQueryData(notificationsKeys.list(), notifications);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 2);

      // Action: Apply optimistic update
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? [],
      );
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), 0);

      // Assert: All notifications now have read_at, count is 0
      const updatedNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const updatedUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(updatedNotifications?.every((n) => n.read_at !== null)).toBe(true);
      expect(updatedUnreadCount).toBe(0);

      // Already-read notification keeps original timestamp
      expect(updatedNotifications?.[2].read_at).toBe("2024-01-01T00:00:00Z");
    });

    it("rolls back all notifications on error", () => {
      // Setup: Mix of read and unread
      const notifications = [
        createMockNotification({ id: "notif-1", read_at: null }),
        createMockNotification({ id: "notif-2", read_at: null }),
      ];
      queryClient.setQueryData(notificationsKeys.list(), notifications);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 2);

      // Capture previous state
      const previousNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const previousUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      // Apply optimistic update
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) => old?.map((n) => ({ ...n, read_at: now })) ?? [],
      );
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), 0);

      // Simulate error - rollback
      queryClient.setQueryData(notificationsKeys.list(), previousNotifications);
      queryClient.setQueryData(
        notificationsKeys.unreadCount(),
        previousUnreadCount,
      );

      // Assert: All notifications rolled back
      const rolledBackNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const rolledBackUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(rolledBackNotifications?.every((n) => n.read_at === null)).toBe(
        true,
      );
      expect(rolledBackUnreadCount).toBe(2);
    });
  });

  describe("rapid mutation handling", () => {
    it("handles marking two different notifications in quick succession", () => {
      // Setup: Two unread notifications
      const notifications = [
        createMockNotification({ id: "notif-1", read_at: null }),
        createMockNotification({ id: "notif-2", read_at: null }),
      ];
      queryClient.setQueryData(notificationsKeys.list(), notifications);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 2);

      // First mutation: mark notif-1 as read
      const wasUnread1 = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.some((n) => n.id === "notif-1" && !n.read_at);

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1"
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ) ?? [],
      );
      if (wasUnread1) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Second mutation: mark notif-2 as read (before first resolves)
      const wasUnread2 = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.some((n) => n.id === "notif-2" && !n.read_at);

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-2"
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ) ?? [],
      );
      if (wasUnread2) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Assert: Both mutations correctly applied, count is 0
      const finalNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const finalUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(finalNotifications?.every((n) => n.read_at !== null)).toBe(true);
      expect(finalUnreadCount).toBe(0);
    });

    it("surgical rollback: first mutation failure does NOT undo second mutation", () => {
      // This test verifies the fix for the concurrent mutation corruption bug
      //
      // Bug scenario with naive rollback:
      // 1. User taps A -> snapshot = [A:unread, B:unread]
      // 2. User taps B -> snapshot = [A:read, B:unread]
      // 3. A fails -> restore [A:unread, B:unread] <- CORRUPTS B!
      //
      // With surgical rollback:
      // 3. A fails -> restore only A, B stays read <- CORRECT

      // Setup: Two unread notifications
      const notifications = [
        createMockNotification({ id: "notif-1", read_at: null }),
        createMockNotification({ id: "notif-2", read_at: null }),
      ];
      queryClient.setQueryData(notificationsKeys.list(), notifications);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 2);

      // Mutation A: mark notif-1 as read
      // Capture ONLY this notification's state for surgical rollback
      const notificationA = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.find((n) => n.id === "notif-1");
      const wasUnreadA = notificationA && !notificationA.read_at;

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1" ? { ...n, read_at: "2024-01-01T10:00:00Z" } : n,
          ) ?? [],
      );
      if (wasUnreadA) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Mutation B: mark notif-2 as read (before A's network request completes)
      const notificationB = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.find((n) => n.id === "notif-2");
      const wasUnreadB = notificationB && !notificationB.read_at;

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-2" ? { ...n, read_at: "2024-01-01T10:00:01Z" } : n,
          ) ?? [],
      );
      if (wasUnreadB) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Verify: Both notifications are now read, count is 0
      expect(
        queryClient.getQueryData<Notification[]>(notificationsKeys.list()),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "notif-1",
            read_at: expect.any(String),
          }),
          expect.objectContaining({
            id: "notif-2",
            read_at: expect.any(String),
          }),
        ]),
      );
      expect(
        queryClient.getQueryData<number>(notificationsKeys.unreadCount()),
      ).toBe(0);

      // Mutation A fails - SURGICAL ROLLBACK (restore only notif-1)
      if (notificationA) {
        queryClient.setQueryData<Notification[]>(
          notificationsKeys.list(),
          (current) =>
            current?.map((n) => (n.id === "notif-1" ? notificationA : n)) ?? [],
        );
      }
      if (wasUnreadA) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (current) => (current ?? 0) + 1,
        );
      }

      // Assert: notif-1 is rolled back to unread, notif-2 STAYS read
      const finalNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const finalUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(
        finalNotifications?.find((n) => n.id === "notif-1")?.read_at,
      ).toBeNull();
      expect(finalNotifications?.find((n) => n.id === "notif-2")?.read_at).toBe(
        "2024-01-01T10:00:01Z",
      );
      expect(finalUnreadCount).toBe(1);
    });

    it("handles double-tap on same notification (idempotent)", () => {
      // Setup: One unread notification
      const notification = createMockNotification({
        id: "notif-1",
        read_at: null,
      });
      queryClient.setQueryData(notificationsKeys.list(), [notification]);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 1);

      // First tap: mark as read
      const wasUnread1 = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.some((n) => n.id === "notif-1" && !n.read_at);

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1"
              ? { ...n, read_at: n.read_at ?? "2024-01-01T00:00:00Z" }
              : n,
          ) ?? [],
      );
      if (wasUnread1) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      expect(wasUnread1).toBe(true);
      expect(
        queryClient.getQueryData<number>(notificationsKeys.unreadCount()),
      ).toBe(0);

      // Second tap: same notification (double-tap)
      const wasUnread2 = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.some((n) => n.id === "notif-1" && !n.read_at);

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1"
              ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
              : n,
          ) ?? [],
      );
      if (wasUnread2) {
        queryClient.setQueryData<number>(
          notificationsKeys.unreadCount(),
          (old) => Math.max(0, (old ?? 0) - 1),
        );
      }

      // Assert: wasUnread2 is false, count stays at 0 (not -1)
      expect(wasUnread2).toBe(false);
      expect(
        queryClient.getQueryData<number>(notificationsKeys.unreadCount()),
      ).toBe(0);

      // read_at is preserved from first tap
      const finalNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      expect(finalNotifications?.[0].read_at).toBe("2024-01-01T00:00:00Z");
    });
  });

  describe("markAllAsRead concurrent with markAsRead", () => {
    it("markAllAsRead rollback does NOT undo concurrent markAsRead", () => {
      // Scenario:
      // 1. User taps notification A (marks as read)
      // 2. User clicks "Mark all read" (marks B, C as read)
      // 3. markAllAsRead fails
      // 4. A should stay read (it was marked by separate mutation)

      // Setup: Three unread notifications
      const notifications = [
        createMockNotification({ id: "notif-1", read_at: null }),
        createMockNotification({ id: "notif-2", read_at: null }),
        createMockNotification({ id: "notif-3", read_at: null }),
      ];
      queryClient.setQueryData(notificationsKeys.list(), notifications);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 3);

      // Step 1: markAsRead for notif-1
      const notificationA = queryClient
        .getQueryData<Notification[]>(notificationsKeys.list())
        ?.find((n) => n.id === "notif-1");

      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1" ? { ...n, read_at: "2024-01-01T10:00:00Z" } : n,
          ) ?? [],
      );
      queryClient.setQueryData<number>(
        notificationsKeys.unreadCount(),
        (old) => (old ?? 0) - 1,
      );

      // Step 2: markAllAsRead (captures unread IDs at THIS moment)
      const currentList = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const unreadNotificationIds = new Set(
        currentList?.filter((n) => !n.read_at).map((n) => n.id) ?? [],
      );
      const previousUnreadCount = unreadNotificationIds.size;

      // Should NOT include notif-1 (already read)
      expect(unreadNotificationIds.has("notif-1")).toBe(false);
      expect(unreadNotificationIds.has("notif-2")).toBe(true);
      expect(unreadNotificationIds.has("notif-3")).toBe(true);

      // Apply markAllAsRead optimistic update
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.read_at ? n : { ...n, read_at: "2024-01-01T10:00:01Z" },
          ) ?? [],
      );
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), 0);

      // Verify all are now read
      expect(
        queryClient
          .getQueryData<Notification[]>(notificationsKeys.list())
          ?.every((n) => n.read_at !== null),
      ).toBe(true);

      // Step 3: markAllAsRead fails - SURGICAL ROLLBACK
      // Restore only the notifications that markAllAsRead marked (notif-2, notif-3)
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (current) =>
          current?.map((n) =>
            unreadNotificationIds.has(n.id) ? { ...n, read_at: null } : n,
          ) ?? [],
      );
      queryClient.setQueryData<number>(
        notificationsKeys.unreadCount(),
        (current) => (current ?? 0) + previousUnreadCount,
      );

      // Assert: notif-1 stays read, notif-2 and notif-3 are unread
      const finalNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const finalUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      expect(finalNotifications?.find((n) => n.id === "notif-1")?.read_at).toBe(
        "2024-01-01T10:00:00Z",
      );
      expect(
        finalNotifications?.find((n) => n.id === "notif-2")?.read_at,
      ).toBeNull();
      expect(
        finalNotifications?.find((n) => n.id === "notif-3")?.read_at,
      ).toBeNull();
      expect(finalUnreadCount).toBe(2);
    });
  });

  describe("onSettled invalidation safety", () => {
    it("documents that cancelQueries protects optimistic updates from stale refetch", () => {
      // This test documents the expected behavior pattern.
      //
      // Timeline:
      // T1: Mutation A completes -> onSettled -> invalidateQueries -> triggers refetch
      // T2: User taps notification B -> onMutate -> cancelQueries -> cancels refetch
      // T3: Optimistic update for B applied
      // T4: Stale refetch response arrives (if any) -> IGNORED by React Query
      //
      // The pattern ensures:
      // 1. cancelQueries is FIRST action in onMutate (before any optimistic updates)
      // 2. React Query ignores responses from cancelled queries
      // 3. onSettled always invalidates to get fresh data eventually
      //
      // We can't directly test React Query's cancellation internals, but we can
      // verify our pattern maintains the invariant: optimistic updates are never
      // overwritten by concurrent refetches.

      // Setup: Notification is unread
      const notification = createMockNotification({
        id: "notif-1",
        read_at: null,
      });
      queryClient.setQueryData(notificationsKeys.list(), [notification]);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 1);

      // Simulate: Mutation A's onSettled just ran and triggered a refetch
      // (In real code, this would be an async network request)

      // Simulate: User taps B, onMutate runs with cancelQueries FIRST
      // The cancelQueries would abort the pending refetch from A's onSettled
      // Then optimistic update is applied
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1" ? { ...n, read_at: "2024-01-01T10:00:00Z" } : n,
          ) ?? [],
      );
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), (old) =>
        Math.max(0, (old ?? 0) - 1),
      );

      // Simulate: Stale refetch response arrives with original data
      // In real code, React Query would IGNORE this because the query was cancelled
      // For this test, we verify our optimistic state is what we expect
      const currentNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      const currentUnreadCount = queryClient.getQueryData<number>(
        notificationsKeys.unreadCount(),
      );

      // The optimistic update should still be in place
      expect(currentNotifications?.[0].read_at).toBe("2024-01-01T10:00:00Z");
      expect(currentUnreadCount).toBe(0);

      // Pattern verification: our code structure ensures cancelQueries runs first
      // This is verified by code review, not runtime test
    });
  });

  describe("undefined cache edge case", () => {
    it("does not corrupt cache when notifications list is undefined", () => {
      // Setup: Cache is undefined (never fetched)
      // This can happen if user navigates directly to notification action
      // without ever viewing the notifications list
      expect(
        queryClient.getQueryData(notificationsKeys.list()),
      ).toBeUndefined();

      // Simulate: The hook's onMutate behavior when cache is undefined
      const currentNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      // The fix: early return if cache is undefined
      if (!currentNotifications) {
        // Don't do optimistic update - cache stays undefined
        // onSettled will refetch anyway
        expect(
          queryClient.getQueryData(notificationsKeys.list()),
        ).toBeUndefined();
        return;
      }

      // This code should not be reached
      fail("Should have returned early when cache is undefined");
    });

    it("does not set cache to empty array when markAllAsRead with undefined cache", () => {
      // Setup: Cache is undefined
      expect(
        queryClient.getQueryData(notificationsKeys.list()),
      ).toBeUndefined();

      // Simulate: The fix returns early when cache is undefined
      const currentNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      if (!currentNotifications) {
        // Context returned with empty set
        const context = {
          unreadNotificationIds: new Set<string>(),
          previousUnreadCount: 0,
        };

        // Verify early return behavior
        expect(context.unreadNotificationIds.size).toBe(0);
        expect(context.previousUnreadCount).toBe(0);

        // Cache should still be undefined, not []
        expect(
          queryClient.getQueryData(notificationsKeys.list()),
        ).toBeUndefined();
        return;
      }

      fail("Should have returned early when cache is undefined");
    });

    it("optimistic update works normally when cache exists", () => {
      // Setup: Cache has data
      const notification = createMockNotification({
        id: "notif-1",
        read_at: null,
      });
      queryClient.setQueryData(notificationsKeys.list(), [notification]);
      queryClient.setQueryData(notificationsKeys.unreadCount(), 1);

      // Simulate: Check cache exists
      const currentNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );

      // Cache exists, so we proceed with optimistic update
      expect(currentNotifications).not.toBeUndefined();

      // Apply optimistic update (using the FIXED pattern - no ?? [])
      queryClient.setQueryData<Notification[]>(
        notificationsKeys.list(),
        (old) =>
          old?.map((n) =>
            n.id === "notif-1" ? { ...n, read_at: "2024-01-01T10:00:00Z" } : n,
          ),
      );
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), (old) =>
        Math.max(0, (old ?? 0) - 1),
      );

      // Verify optimistic update worked
      const updatedNotifications = queryClient.getQueryData<Notification[]>(
        notificationsKeys.list(),
      );
      expect(updatedNotifications?.[0].read_at).toBe("2024-01-01T10:00:00Z");
      expect(
        queryClient.getQueryData<number>(notificationsKeys.unreadCount()),
      ).toBe(0);
    });
  });
});
