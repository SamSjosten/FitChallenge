import { getSupabaseClient, withAuth } from "@/lib/supabase";
import type { Notification as DbNotification } from "@/types/database";

export interface Notification extends Omit<DbNotification, "data"> {
  data: Record<string, unknown>;
}

function mapNotification(db: DbNotification): Notification {
  const { data, ...rest } = db;
  return {
    ...rest,
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
        .limit(50);

      if (error) throw error;
      return (data || []).map(mapNotification);
    });
  },

  async getUnreadCount(): Promise<number> {
    return withAuth(async () => {
      const { count, error } = await getSupabaseClient()
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);

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
};
