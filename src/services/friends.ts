// src/services/friends.ts
// Friends management service

import { supabase, withAuth } from "@/lib/supabase";
import type { ProfilePublic, Friend as DbFriend } from "@/types/database";

// =============================================================================
// TYPES
// =============================================================================

// DB has status as string (CHECK constraint), define proper type for service layer
export type FriendStatus = "pending" | "accepted" | "blocked";

// Mapped Friend type with proper status enum
export interface Friend extends Omit<DbFriend, "status"> {
  status: FriendStatus;
}

// Use mapped Friend type, extend with joined profile
export interface FriendWithProfile extends Friend {
  friend_profile: ProfilePublic;
}

export interface PendingRequest {
  id: string;
  requester: ProfilePublic;
  created_at: string | null; // Nullable from DB
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Cast DB friend row to typed Friend (status string -> enum)
 */
function mapFriend(dbFriend: DbFriend): Friend {
  return {
    ...dbFriend,
    status: dbFriend.status as FriendStatus,
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export const friendsService = {
  /**
   * Get all accepted friends for current user
   * CONTRACT: Uses profiles_public for identity
   */
  async getFriends(): Promise<FriendWithProfile[]> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("friends")
        .select("*")
        .eq("status", "accepted")
        .or(`requested_by.eq.${userId},requested_to.eq.${userId}`);

      if (error) throw error;

      const friends = data || [];

      // Get the "other" user's ID for each friendship
      const otherUserIds = friends.map((f) =>
        f.requested_by === userId ? f.requested_to : f.requested_by
      );

      // Fetch profiles from profiles_public
      // Guard against empty array to prevent PostgREST error
      let profileMap = new Map<string, ProfilePublic>();
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("*")
          .in("id", otherUserIds);

        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      }

      return friends.map((f) => {
        const otherId =
          f.requested_by === userId ? f.requested_to : f.requested_by;
        return {
          ...mapFriend(f),
          friend_profile: profileMap.get(otherId) || {
            id: otherId,
            username: "Unknown",
            display_name: null,
            avatar_url: null,
            updated_at: "",
          },
        };
      });
    });
  },

  /**
   * Get pending friend requests (received)
   * CONTRACT: Only shows requests where current user is recipient
   */
  async getPendingRequests(): Promise<PendingRequest[]> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("friends")
        .select("id, requested_by, created_at")
        .eq("requested_to", userId)
        .eq("status", "pending");

      if (error) throw error;

      const requests = data || [];
      const requesterIds = requests.map((r) => r.requested_by);

      // Fetch requester profiles
      // Guard against empty array to prevent PostgREST error
      let profileMap = new Map<string, ProfilePublic>();
      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("*")
          .in("id", requesterIds);

        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      }

      return requests.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        requester: profileMap.get(r.requested_by) || {
          id: r.requested_by,
          username: "Unknown",
          display_name: null,
          avatar_url: null,
          updated_at: "",
        },
      }));
    });
  },

  /**
   * Send a friend request
   * CONTRACT: RLS enforces requested_by = auth.uid() and status = 'pending'
   */
  async sendRequest(targetUserId: string): Promise<void> {
    return withAuth(async (userId) => {
      if (targetUserId === userId) {
        throw new Error("Cannot send friend request to yourself");
      }

      const { error } = await supabase.from("friends").insert({
        requested_by: userId,
        requested_to: targetUserId,
        status: "pending",
      });

      if (error) {
        // Handle duplicate request
        if (error.code === "23505") {
          throw new Error("Friend request already exists");
        }
        throw error;
      }
    });
  },

  /**
   * Accept a friend request
   * CONTRACT: Only recipient can accept (RLS enforced)
   */
  async acceptRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (error) throw error;
  },

  /**
   * Decline a friend request
   * CONTRACT: Only recipient can decline (RLS enforced)
   */
  async declineRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from("friends")
      .delete()
      .eq("id", friendshipId);

    if (error) throw error;
  },

  /**
   * Remove a friendship
   * CONTRACT: Either party can delete (RLS enforced)
   */
  async removeFriend(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from("friends")
      .delete()
      .eq("id", friendshipId);

    if (error) throw error;
  },
};
