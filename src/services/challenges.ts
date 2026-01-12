// src/services/challenges.ts
// Challenge management service

import { supabase, withAuth } from "@/lib/supabase";
import {
  validate,
  createChallengeSchema,
  inviteParticipantSchema,
  respondToInviteSchema,
  CreateChallengeInput,
} from "@/lib/validation";
import { getServerNow } from "@/lib/serverTime";
import type {
  Challenge,
  ChallengeParticipant,
  ProfilePublic,
} from "@/types/database";

// =============================================================================
// TYPES
// =============================================================================

// Derive participation type from DB types to reduce drift
type ParticipationFields = Pick<
  ChallengeParticipant,
  "invite_status" | "current_progress"
>;

// Coerced version with non-null numerics (nulls coalesced in service layer)
export interface MyParticipation {
  invite_status: ChallengeParticipant["invite_status"]; // Keep nullable from DB
  current_progress: number; // Coalesced to 0
}

export interface ChallengeWithParticipation extends Challenge {
  my_participation?: MyParticipation;
}

export interface LeaderboardEntry {
  user_id: string;
  current_progress: number; // Coalesced to 0
  current_streak: number; // Coalesced to 0
  rank: number;
  profile: ProfilePublic;
}

export interface PendingInvite {
  challenge: Challenge;
  creator: ProfilePublic;
  invited_at: string | null; // Nullable from DB
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map raw participation data to MyParticipation, coalescing numeric nulls to 0
 */
function mapParticipation(
  raw: ParticipationFields | undefined
): MyParticipation | undefined {
  if (!raw) return undefined;
  return {
    invite_status: raw.invite_status, // Keep as-is (nullable)
    current_progress: raw.current_progress ?? 0,
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export const challengeService = {
  /**
   * Create a new challenge
   * CONTRACT: Creator auto-added as accepted participant
   */
  async create(input: unknown): Promise<Challenge> {
    const validated = validate(createChallengeSchema, input);

    return withAuth(async (userId) => {
      // Insert challenge
      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .insert({
          creator_id: userId,
          title: validated.title,
          description: validated.description,
          challenge_type: validated.challenge_type,
          goal_value: validated.goal_value,
          goal_unit: validated.goal_unit,
          win_condition: validated.win_condition,
          daily_target: validated.daily_target,
          start_date: validated.start_date,
          end_date: validated.end_date,
          status: "pending",
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Auto-add creator as accepted participant
      const { error: participantError } = await supabase
        .from("challenge_participants")
        .insert({
          challenge_id: challenge.id,
          user_id: userId,
          invite_status: "accepted",
        });

      if (participantError) throw participantError;

      return challenge;
    });
  },

  /**
   * Get challenges where current user is an accepted participant
   */
  async getMyActiveChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async (userId) => {
      const now = getServerNow().toISOString();

      const { data, error } = await supabase
        .from("challenges")
        .select(
          `
          *,
          challenge_participants!inner (
            invite_status,
            current_progress
          )
        `
        )
        .eq("challenge_participants.user_id", userId)
        .eq("challenge_participants.invite_status", "accepted")
        // Time-based filtering: active window is [start_date, end_date)
        .lte("start_date", now) // Must have started
        .gt("end_date", now) // Must not have ended
        // Exclude override statuses (cancelled/archived)
        .not("status", "in", '("cancelled","archived")')
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Flatten via destructuring, coalesce numeric nulls
      return (data || []).map(({ challenge_participants, ...challenge }) => ({
        ...challenge,
        my_participation: mapParticipation(challenge_participants?.[0]),
      }));
    });
  },

  /**
   * Get completed challenges for current user
   * CONTRACT: Uses time-derived status - challenges where end_date has passed
   */
  async getCompletedChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async (userId) => {
      const now = getServerNow().toISOString();

      const { data, error } = await supabase
        .from("challenges")
        .select(
          `
          *,
          challenge_participants!inner (
            invite_status,
            current_progress
          )
        `
        )
        .eq("challenge_participants.user_id", userId)
        .eq("challenge_participants.invite_status", "accepted")
        .lte("end_date", now)
        .not("status", "in", '("cancelled","archived")')
        .order("end_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Flatten via destructuring, coalesce numeric nulls
      return (data || []).map(({ challenge_participants, ...challenge }) => ({
        ...challenge,
        my_participation: mapParticipation(challenge_participants?.[0]),
      }));
    });
  },

  /**
   * Get pending invites for current user
   * CONTRACT: Uses profiles_public for creator identity
   */
  async getPendingInvites(): Promise<PendingInvite[]> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("challenge_participants")
        .select(
          `
          joined_at,
          challenge:challenges!inner (
            *
          )
        `
        )
        .eq("user_id", userId)
        .eq("invite_status", "pending");

      if (error) throw error;

      // Fetch creator profiles separately (profiles_public)
      const challenges = data || [];
      const creatorIds = [
        ...new Set(
          challenges
            .map((c) => c.challenge.creator_id)
            .filter(
              (id): id is string => typeof id === "string" && id.length > 0
            )
        ),
      ];

      // Guard: skip query if no creator IDs to fetch (empty .in() is problematic)
      let creatorMap = new Map<string, ProfilePublic>();
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("profiles_public")
          .select("*")
          .in("id", creatorIds);
        creatorMap = new Map(creators?.map((c) => [c.id, c]) || []);
      }

      return challenges.map((item) => ({
        challenge: item.challenge,
        creator: creatorMap.get(item.challenge.creator_id!) || {
          id: item.challenge.creator_id!,
          username: "Unknown",
          display_name: null,
          avatar_url: null,
          updated_at: "",
        },
        invited_at: item.joined_at,
      }));
    });
  },

  /**
   * Get a single challenge by ID
   * CONTRACT: RLS enforces visibility
   */
  async getChallenge(
    challengeId: string
  ): Promise<ChallengeWithParticipation | null> {
    return withAuth(async (userId) => {
      const { data, error } = await supabase
        .from("challenges")
        .select(
          `
          *,
          challenge_participants (
            invite_status,
            current_progress
          )
        `
        )
        .eq("id", challengeId)
        .eq("challenge_participants.user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      // Flatten via destructuring, coalesce numeric nulls
      const { challenge_participants, ...challenge } = data;
      return {
        ...challenge,
        my_participation: mapParticipation(challenge_participants?.[0]),
      };
    });
  },

  /**
   * Invite a user to a challenge
   * CONTRACT: Only creator can invite (RLS enforced)
   * CONTRACT: Triggers notification via server function
   * Defense-in-depth: Requires auth before attempting mutation
   */
  async inviteUser(input: unknown): Promise<void> {
    const { challenge_id, user_id } = validate(inviteParticipantSchema, input);

    return withAuth(async (currentUserId) => {
      // Log for debugging/audit (userId available for future policy expansion)
      console.debug(
        `User ${currentUserId} inviting ${user_id} to challenge ${challenge_id}`
      );

      // Insert participant (RLS enforces creator check)
      const { error: insertError } = await supabase
        .from("challenge_participants")
        .insert({
          challenge_id,
          user_id,
          invite_status: "pending",
        });

      if (insertError) throw insertError;

      // Trigger notification (server-side function)
      const { error: notifyError } = await supabase.rpc(
        "enqueue_challenge_invite_notification",
        { p_challenge_id: challenge_id, p_invited_user_id: user_id }
      );

      // Log but don't fail on notification error
      if (notifyError) {
        console.error("Failed to send invite notification:", notifyError);
      }
    });
  },

  /**
   * Respond to a challenge invite
   * CONTRACT: Only invitee can respond (RLS enforced)
   */
  async respondToInvite(input: unknown): Promise<void> {
    const { challenge_id, response } = validate(respondToInviteSchema, input);

    return withAuth(async (userId) => {
      const { error } = await supabase
        .from("challenge_participants")
        .update({ invite_status: response })
        .eq("challenge_id", challenge_id)
        .eq("user_id", userId);

      if (error) throw error;
    });
  },

  /**
   * Leave a challenge (for non-creator participants)
   * CONTRACT: Only participant can leave their own participation (RLS enforced)
   * Sets invite_status to 'declined' which removes from active view
   */
  async leaveChallenge(challengeId: string): Promise<void> {
    return withAuth(async (userId) => {
      const { error } = await supabase
        .from("challenge_participants")
        .update({ invite_status: "declined" })
        .eq("challenge_id", challengeId)
        .eq("user_id", userId);

      if (error) throw error;
    });
  },

  /**
   * Cancel a challenge (creator only)
   * CONTRACT: Only creator can cancel (RLS enforced)
   * Sets status to 'cancelled' which removes from all users' views
   * Defense-in-depth: Requires auth before attempting mutation
   */
  async cancelChallenge(challengeId: string): Promise<void> {
    return withAuth(async (currentUserId) => {
      // Log for debugging/audit (userId available for future policy expansion)
      console.debug(
        `User ${currentUserId} cancelling challenge ${challengeId}`
      );

      const { error } = await supabase
        .from("challenges")
        .update({ status: "cancelled" })
        .eq("id", challengeId);

      if (error) throw error;
    });
  },

  /**
   * Get leaderboard for a challenge
   * CONTRACT: Uses profiles_public for participant identity
   * CONTRACT: Only accepted participants visible (RLS enforced)
   */
  async getLeaderboard(challengeId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from("challenge_participants")
      .select("user_id, current_progress, current_streak")
      .eq("challenge_id", challengeId)
      .eq("invite_status", "accepted")
      .order("current_progress", { ascending: false });

    if (error) throw error;

    const participants = data || [];
    const userIds = participants.map((p) => p.user_id);

    // Fetch profiles from profiles_public (not profiles!)
    const { data: profiles } = await supabase
      .from("profiles_public")
      .select("*")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    // Coalesce numeric nulls to 0
    return participants.map((p, index) => ({
      user_id: p.user_id,
      current_progress: p.current_progress ?? 0,
      current_streak: p.current_streak ?? 0,
      rank: index + 1,
      profile: profileMap.get(p.user_id) || {
        id: p.user_id,
        username: "Unknown",
        display_name: null,
        avatar_url: null,
        updated_at: "",
      },
    }));
  },

  /**
   * Check if current user is an accepted participant
   * Used to gate leaderboard access in UI
   */
  async canViewLeaderboard(challengeId: string): Promise<boolean> {
    return withAuth(async (userId) => {
      const { data } = await supabase
        .from("challenge_participants")
        .select("invite_status")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .single();

      return data?.invite_status === "accepted";
    });
  },
};
