// src/services/challenges.ts
// Challenge management service

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
 * Calculate rank for a user in a sorted participant list using standard competition ranking.
 *
 * RANKING BEHAVIOR (1224 / "standard competition ranking"):
 * - Equal progress = equal rank
 * - Next different progress = position + 1 (gaps in ranking)
 *
 * Example: [1000, 1000, 1000, 500] → ranks [1, 1, 1, 4]
 *
 * REQUIREMENTS:
 * - participants must be pre-sorted by (current_progress DESC, user_id ASC)
 * - user_id tie-breaker ensures stable ordering for equal progress
 *
 * @param participants - Sorted array of participants with current_progress
 * @param userId - The user ID to find rank for
 * @returns 1-indexed rank, or undefined if user not found
 */
function calculateRankWithTies(
  participants: Array<{ user_id: string; current_progress: number }>,
  userId: string,
): number | undefined {
  const userIndex = participants.findIndex((p) => p.user_id === userId);
  if (userIndex < 0) return undefined;

  const userProgress = participants[userIndex].current_progress;

  // Find how many people have strictly higher progress
  // Rank = count of people with higher progress + 1
  let rank = 1;
  for (const p of participants) {
    if (p.current_progress > userProgress) {
      rank++;
    }
  }

  return rank;
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
   * CONTRACT: Uses server-authoritative time filtering via RPC
   * The RPC uses PostgreSQL now() to determine active window [start_date, end_date)
   */
  async getMyActiveChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async (userId) => {
      // Step 1: Get active challenge IDs using server-authoritative time
      const { data: idRows, error: idsError } = await getSupabaseClient().rpc(
        "get_active_challenge_ids",
      );

      if (idsError) throw idsError;

      const challengeIds = (idRows || []).map((row) => row.challenge_id);

      // Guard: empty .in() fails in PostgREST
      if (challengeIds.length === 0) {
        return [];
      }

      // Step 2: Fetch full challenge data by IDs
      // Explicit ordering to match RPC order (start_date ASC)
      const { data, error } = await getSupabaseClient()
        .from("challenges")
        .select(
          `
          *,
          challenge_participants!inner (
            invite_status,
            current_progress
          )
        `,
        )
        .in("id", challengeIds)
        .eq("challenge_participants.user_id", userId)
        .eq("challenge_participants.invite_status", "accepted")
        .order("start_date", { ascending: true });

      if (error) throw error;

      const challenges = data || [];

      // Step 3: Batch fetch all participants for these challenges to get counts and ranks
      let participantData: {
        challenge_id: string;
        user_id: string;
        current_progress: number;
      }[] = [];
      if (challengeIds.length > 0) {
        const { data: participants, error: participantsError } =
          await getSupabaseClient()
            .from("challenge_participants")
            .select("challenge_id, user_id, current_progress")
            .in("challenge_id", challengeIds)
            .eq("invite_status", "accepted")
            .order("current_progress", { ascending: false })
            .order("user_id", { ascending: true }); // Tie-breaker for deterministic ranking

        if (participantsError) {
          throw new Error(
            "Unable to load challenge participants. Please try again.",
          );
        }

        // Coalesce nulls at service boundary (explicit to avoid spread type issues)
        participantData = (participants || []).map((p) => ({
          challenge_id: p.challenge_id,
          user_id: p.user_id,
          current_progress: p.current_progress ?? 0,
        }));
      }

      // Group participants by challenge (already sorted by progress DESC, user_id ASC)
      const challengeParticipants = new Map<string, typeof participantData>();
      for (const p of participantData) {
        if (!challengeParticipants.has(p.challenge_id)) {
          challengeParticipants.set(p.challenge_id, []);
        }
        challengeParticipants.get(p.challenge_id)!.push(p);
      }

      // Flatten via destructuring, add counts and ranks
      // Uses standard competition ranking: equal progress = equal rank
      return challenges.map(({ challenge_participants, ...challenge }) => {
        const participants = challengeParticipants.get(challenge.id) || [];

        return {
          ...challenge,
          my_participation: mapParticipation(challenge_participants?.[0]),
          participant_count: participants.length,
          my_rank: calculateRankWithTies(participants, userId),
        };
      });
    });
  },

  /**
   * Get completed challenges for current user
   *
   * CONTRACT: Uses server-authoritative time filtering via RPC
   * The RPC uses PostgreSQL now() to determine completed = end_date <= now()
   * Includes participant_count and my_rank for historical display
   */
  async getCompletedChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async (userId) => {
      // Step 1: Get completed challenge IDs using server-authoritative time
      const { data: idRows, error: idsError } = await getSupabaseClient().rpc(
        "get_completed_challenge_ids",
      );

      if (idsError) throw idsError;

      const challengeIds = (idRows || []).map((row) => row.challenge_id);

      // Guard: empty .in() fails in PostgREST
      if (challengeIds.length === 0) {
        return [];
      }

      // Step 2: Fetch full challenge data by IDs
      // Explicit ordering to match RPC order (end_date DESC)
      const { data, error } = await getSupabaseClient()
        .from("challenges")
        .select(
          `
          *,
          challenge_participants!inner (
            invite_status,
            current_progress
          )
        `,
        )
        .in("id", challengeIds)
        .eq("challenge_participants.user_id", userId)
        .eq("challenge_participants.invite_status", "accepted")
        .order("end_date", { ascending: false });

      if (error) throw error;

      const challenges = data || [];

      // Step 3: Batch fetch all participants for these challenges to get counts and ranks
      let participantData: {
        challenge_id: string;
        user_id: string;
        current_progress: number;
      }[] = [];
      if (challengeIds.length > 0) {
        const { data: participants, error: participantsError } =
          await getSupabaseClient()
            .from("challenge_participants")
            .select("challenge_id, user_id, current_progress")
            .in("challenge_id", challengeIds)
            .eq("invite_status", "accepted")
            .order("current_progress", { ascending: false })
            .order("user_id", { ascending: true }); // Tie-breaker for deterministic ranking

        if (participantsError) {
          throw new Error(
            "Unable to load challenge participants. Please try again.",
          );
        }

        // Coalesce nulls at service boundary (explicit to avoid spread type issues)
        participantData = (participants || []).map((p) => ({
          challenge_id: p.challenge_id,
          user_id: p.user_id,
          current_progress: p.current_progress ?? 0,
        }));
      }

      // Group participants by challenge (already sorted by progress DESC, user_id ASC)
      const challengeParticipants = new Map<string, typeof participantData>();
      for (const p of participantData) {
        if (!challengeParticipants.has(p.challenge_id)) {
          challengeParticipants.set(p.challenge_id, []);
        }
        challengeParticipants.get(p.challenge_id)!.push(p);
      }

      // Flatten via destructuring, add counts and ranks
      // Uses standard competition ranking: equal progress = equal rank
      return challenges.map(({ challenge_participants, ...challenge }) => {
        const participants = challengeParticipants.get(challenge.id) || [];

        return {
          ...challenge,
          my_participation: mapParticipation(challenge_participants?.[0]),
          participant_count: participants.length,
          my_rank: calculateRankWithTies(participants, userId),
        };
      });
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
