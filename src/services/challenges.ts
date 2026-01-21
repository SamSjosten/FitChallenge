// src/services/challenges.ts
// Challenge management service

import { z } from "zod";
import { getSupabaseClient, withAuth } from "@/lib/supabase";
import {
  validate,
  createChallengeSchema,
  inviteParticipantSchema,
  respondToInviteSchema,
  CreateChallengeInput,
} from "@/lib/validation";
import type {
  Challenge,
  ChallengeParticipant,
  ProfilePublic,
} from "@/types/database";

// =============================================================================
// RPC RESPONSE VALIDATION
// =============================================================================

/**
 * Zod schema for validating get_my_challenges RPC response rows.
 * Matches the RETURNS TABLE definition in migration 018.
 */
const challengeRpcRowSchema = z.object({
  // Challenge fields
  id: z.string().uuid(),
  creator_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  challenge_type: z.enum([
    "steps",
    "active_minutes",
    "workouts",
    "distance",
    "custom",
  ]),
  goal_value: z.number(),
  goal_unit: z.string(),
  win_condition: z.enum([
    "highest_total",
    "first_to_goal",
    "longest_streak",
    "all_complete",
  ]),
  daily_target: z.number().nullable(),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum([
    "draft",
    "pending",
    "active",
    "completed",
    "archived",
    "cancelled",
  ]),
  xp_reward: z.number().nullable(),
  max_participants: z.number().nullable(),
  is_public: z.boolean().nullable(),
  custom_activity_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  // Participation fields (from RPC)
  my_invite_status: z.string(),
  my_current_progress: z.number(),
  // Aggregations (from RPC)
  participant_count: z.number(),
  my_rank: z.number(),
});

const challengeRpcResponseSchema = z.array(challengeRpcRowSchema);

type ChallengeRpcRow = z.infer<typeof challengeRpcRowSchema>;

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
  participant_count?: number; // Total accepted participants
  my_rank?: number; // User's rank (1-indexed)
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
// RPC RESPONSE MAPPING
// =============================================================================

/**
 * Maps flat RPC response row to ChallengeWithParticipation interface.
 * Transforms server-side aggregations to existing UI data shape.
 */
function mapRpcToChallengeWithParticipation(
  row: ChallengeRpcRow,
): ChallengeWithParticipation {
  const {
    my_invite_status,
    my_current_progress,
    participant_count,
    my_rank,
    ...challengeFields
  } = row;

  return {
    ...challengeFields,
    my_participation: {
      invite_status: my_invite_status,
      current_progress: my_current_progress,
    },
    participant_count,
    my_rank,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map raw participation data to MyParticipation, coalescing numeric nulls to 0
 */
function mapParticipation(
  raw: ParticipationFields | undefined,
): MyParticipation | undefined {
  if (!raw) return undefined;
  return {
    invite_status: raw.invite_status, // Keep as-is (nullable)
    current_progress: raw.current_progress ?? 0,
  };
}

/**
 * Assign ranks to all participants using standard competition ranking.
 *
 * @param participants - Sorted array (by current_progress DESC, user_id ASC)
 * @returns Array of ranks corresponding to each participant
 */
function assignRanksWithTies(
  participants: Array<{ current_progress: number }>,
): number[] {
  if (participants.length === 0) return [];

  const ranks: number[] = [];
  let currentRank = 1;

  for (let i = 0; i < participants.length; i++) {
    if (i === 0) {
      // First participant is always rank 1
      ranks.push(1);
    } else if (
      participants[i].current_progress === participants[i - 1].current_progress
    ) {
      // Same progress as previous = same rank
      ranks.push(ranks[i - 1]);
    } else {
      // Different progress = rank is position + 1
      ranks.push(i + 1);
    }
  }

  return ranks;
}

// =============================================================================
// SERVICE
// =============================================================================

export const challengeService = {
  /**
   * Create a new challenge
   * CONTRACT: Creator auto-added as accepted participant (atomic via RPC)
   *
   * Uses create_challenge_with_participant RPC to ensure both the challenge
   * and creator participation are created in a single transaction.
   * If either insert fails, the entire operation is rolled back.
   */
  async create(input: unknown): Promise<Challenge> {
    const validated = validate(createChallengeSchema, input);

    // Call atomic RPC - no withAuth needed as RPC uses auth.uid() internally
    // Parameter order: required params first, optional params last
    const { data: challenge, error } = await getSupabaseClient().rpc(
      "create_challenge_with_participant",
      {
        // Required parameters
        p_title: validated.title,
        p_challenge_type: validated.challenge_type,
        p_goal_value: validated.goal_value,
        p_goal_unit: validated.goal_unit,
        p_start_date: validated.start_date,
        p_end_date: validated.end_date,
        // Optional parameters
        p_description: validated.description ?? null,
        p_custom_activity_name:
          validated.challenge_type === "custom"
            ? validated.custom_activity_name
            : null,
        p_win_condition: validated.win_condition,
        p_daily_target: validated.daily_target ?? null,
      },
    );

    if (error) {
      // Map RPC errors to more descriptive messages
      if (error.message?.includes("authentication_required")) {
        throw new Error("Authentication required to create a challenge");
      }
      if (error.message?.includes("invalid_dates")) {
        throw new Error("End date must be after start date");
      }
      if (error.message?.includes("invalid_goal_value")) {
        throw new Error("Goal value must be positive");
      }
      throw error;
    }

    if (!challenge) {
      throw new Error("Failed to create challenge: no data returned");
    }

    return challenge as Challenge;
  },

  /**
   * Get challenges where current user is an accepted participant
   * Includes participant_count and my_rank for home screen display
   *
   * CONTRACT: Uses atomic RPC for consistent snapshot (no race windows)
   * CONTRACT: Server-authoritative time filtering via PostgreSQL now()
   * CONTRACT: Standard competition ranking computed server-side
   */
  async getMyActiveChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "get_my_challenges",
        {
          p_filter: "active",
        },
      );

      if (error) throw error;

      // Validate response shape (catches schema drift between migrations)
      const validated = challengeRpcResponseSchema.parse(data);

      return validated.map(mapRpcToChallengeWithParticipation);
    });
  },

  /**
   * Get completed challenges for current user
   *
   * CONTRACT: Uses atomic RPC for consistent snapshot (no race windows)
   * CONTRACT: Server-authoritative time filtering via PostgreSQL now()
   * CONTRACT: Returns max 20 most recently completed (server-side limit)
   */
  async getCompletedChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "get_my_challenges",
        {
          p_filter: "completed",
        },
      );

      if (error) throw error;

      // Validate response shape (catches schema drift between migrations)
      const validated = challengeRpcResponseSchema.parse(data);

      return validated.map(mapRpcToChallengeWithParticipation);
    });
  },

  /**
   * Get pending invites for current user
   * CONTRACT: Uses profiles_public for creator identity
   */
  async getPendingInvites(): Promise<PendingInvite[]> {
    return withAuth(async (userId) => {
      const { data, error } = await getSupabaseClient()
        .from("challenge_participants")
        .select(
          `
          joined_at,
          challenge:challenges!inner (
            *
          )
        `,
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
              (id): id is string => typeof id === "string" && id.length > 0,
            ),
        ),
      ];

      // Guard: skip query if no creator IDs to fetch (empty .in() is problematic)
      let creatorMap = new Map<string, ProfilePublic>();
      if (creatorIds.length > 0) {
        const { data: creators, error: creatorsError } =
          await getSupabaseClient()
            .from("profiles_public")
            .select("*")
            .in("id", creatorIds);

        if (creatorsError) {
          throw new Error("Unable to load invite details. Please try again.");
        }

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
    challengeId: string,
  ): Promise<ChallengeWithParticipation | null> {
    return withAuth(async (userId) => {
      const { data, error } = await getSupabaseClient()
        .from("challenges")
        .select(
          `
          *,
          challenge_participants (
            invite_status,
            current_progress
          )
        `,
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
   * CONTRACT: Only creator can invite (RLS enforced via SECURITY INVOKER)
   * CONTRACT: Max participants enforced atomically by RPC
   * CONTRACT: Triggers notification via server function
   * Defense-in-depth: Requires auth before attempting mutation
   */
  async inviteUser(input: unknown): Promise<void> {
    const { challenge_id, user_id } = validate(inviteParticipantSchema, input);

    return withAuth(async () => {
      // Atomic invite with max_participants check (RLS still enforced)
      const { error: inviteError } = await getSupabaseClient().rpc(
        "invite_to_challenge",
        {
          p_challenge_id: challenge_id,
          p_user_id: user_id,
        },
      );

      if (inviteError) {
        // Handle max participants exceeded
        if (inviteError.message?.includes("challenge_full")) {
          throw new Error("Challenge is full");
        }
        throw inviteError;
      }

      // Trigger notification (server-side function)
      const { error: notifyError } = await getSupabaseClient().rpc(
        "enqueue_challenge_invite_notification",
        { p_challenge_id: challenge_id, p_invited_user_id: user_id },
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
      const { error } = await getSupabaseClient()
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
      const { error } = await getSupabaseClient()
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
    return withAuth(async () => {
      const { error } = await getSupabaseClient()
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
   * Defense-in-depth: Requires auth before querying
   */
  async getLeaderboard(challengeId: string): Promise<LeaderboardEntry[]> {
    return withAuth(async () => {
      const { data, error } = await getSupabaseClient()
        .from("challenge_participants")
        .select("user_id, current_progress, current_streak")
        .eq("challenge_id", challengeId)
        .eq("invite_status", "accepted")
        .order("current_progress", { ascending: false })
        .order("user_id", { ascending: true }); // Tie-breaker for deterministic ranking

      if (error) throw error;

      const participants = data || [];
      const userIds = participants.map((p) => p.user_id);

      // Fetch profiles from profiles_public (not profiles!)
      // Guard against empty array to prevent PostgREST error
      let profileMap = new Map<string, ProfilePublic>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } =
          await getSupabaseClient()
            .from("profiles_public")
            .select("*")
            .in("id", userIds);

        if (profilesError) {
          throw new Error(
            "Unable to load leaderboard profiles. Please try again.",
          );
        }

        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      }

      // Coalesce numeric nulls to 0 and prepare for ranking
      const coalesced = participants.map((p) => ({
        user_id: p.user_id,
        current_progress: p.current_progress ?? 0,
        current_streak: p.current_streak ?? 0,
      }));

      // Calculate ranks with standard competition ranking (ties get equal rank)
      const ranks = assignRanksWithTies(coalesced);

      return coalesced.map((p, index) => ({
        user_id: p.user_id,
        current_progress: p.current_progress,
        current_streak: p.current_streak,
        rank: ranks[index],
        profile: profileMap.get(p.user_id) || {
          id: p.user_id,
          username: "Unknown",
          display_name: null,
          avatar_url: null,
          updated_at: "",
        },
      }));
    });
  },

  /**
   * Check if current user is an accepted participant
   * Used to gate leaderboard access in UI
   */
  async canViewLeaderboard(challengeId: string): Promise<boolean> {
    return withAuth(async (userId) => {
      const { data } = await getSupabaseClient()
        .from("challenge_participants")
        .select("invite_status")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .single();

      return data?.invite_status === "accepted";
    });
  },
};
