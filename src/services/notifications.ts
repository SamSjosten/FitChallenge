import { getSupabaseClient, withAuth } from "@/lib/supabase";
import type { Notification as DbNotification } from "@/types/database-helpers";

// Service-level Notification type with guaranteed non-null fields.
// Migration 026 adds NOT NULL to created_at. After regenerating types,
// the Omit and assertion below become redundant but remain as defensive code.
export interface Notification extends Omit<
  DbNotification,
  "data" | "created_at"
> {
  data: Record<string, unknown>;
  created_at: string; // NOT NULL enforced by migration 026
  dismissed_at: string | null; // Added by migration 028
}

function mapNotification(db: DbNotification): Notification {
  // Defensive assertion - migration 026 enforces NOT NULL, but this catches
  // any edge cases until types are regenerated
  if (!db.created_at) {
    throw new Error(
      `Notification ${db.id} has null created_at - data integrity issue`,
    );
  }

  const { data, ...rest } = db;
  return {
    ...rest,
    created_at: db.created_at,
    dismissed_at:
      (db as DbNotification & { dismissed_at?: string | null }).dismissed_at ??
      null,
    data:
      data !== null && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {},
  };
}

export const notificationsService = {
  async getNotifications(): Promise<Notification[]> {
    return withAuth(async () => {
      const { data, error } = await getSupabaseClient()
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100); // Increased to accommodate archived items

      if (error) throw error;
      return (data || []).map(mapNotification);
    });
  },

  async getUnreadCount(): Promise<number> {
    return withAuth(async () => {
      // Only count active (non-archived) unread notifications
      const { count, error } = await getSupabaseClient()
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null)
        .is("dismissed_at", null);

      if (error) throw error;
      return count || 0;
    });
  },

  async markAsRead(notificationId: string): Promise<void> {
    return withAuth(async () => {
      const { error } = await getSupabaseClient().rpc(
        "mark_notification_read",
        {
          p_notification_id: notificationId,
        },
      );

      if (error) throw error;
    });
  },

  async markAllAsRead(): Promise<void> {
    return withAuth(async () => {
      const { error } = await getSupabaseClient().rpc(
        "mark_all_notifications_read",
      );

      if (error) throw error;
    });
  },

  /**
   * Archive a notification (mark as read + dismissed)
   * Used for swipe-to-archive in Unread/All tabs
   */
  async archiveNotification(notificationId: string): Promise<void> {
    return withAuth(async () => {
      const { error } = await getSupabaseClient().rpc("archive_notification", {
        p_notification_id: notificationId,
      });

      if (error) throw error;
    });
  },

  /**
   * Restore an archived notification back to active
   * Used for swipe-to-restore in Archived tab
   */
  async restoreNotification(notificationId: string): Promise<void> {
    return withAuth(async () => {
      const { error } = await getSupabaseClient().rpc("restore_notification", {
        p_notification_id: notificationId,
      });

      if (error) throw error;
    });
  },
};
