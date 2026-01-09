// src/services/notifications.ts
// Notifications service - read only (server creates notifications)

import { supabase, withAuth } from "@/lib/supabase";

// =============================================================================
// TYPES
// =============================================================================

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

// =============================================================================
// SERVICE
// =============================================================================

export const notificationsService = {
  /**
   * Get all notifications for current user
   * CONTRACT: RLS enforces user can only see their own
   */
  async getNotifications(): Promise<Notification[]> {
    return withAuth(async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    });
  },

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    return withAuth(async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);

      if (error) throw error;
      return count || 0;
    });
  },

  /**
   * Mark a notification as read
   * CONTRACT: RLS enforces user can only update their own
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) throw error;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    return withAuth(async (userId) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;
    });
  },
};
