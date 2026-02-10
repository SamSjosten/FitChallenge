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
import type { Challenge, ChallengeParticipant, ProfilePublic } from "@/types/database-helpers";
import { getServerNow } from "@/lib/serverTime";

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
  challenge_type: z.enum(["steps", "active_minutes", "workouts", "distance", "custom"]),
  goal_value: z.number(),
  goal_unit: z.string(),
  win_condition: z.enum(["highest_total", "first_to_goal", "longest_streak", "all_complete"]),
  daily_target: z.number().nullable(),
  start_date: z.string(),
  end_date: z.string(),
  starting_soon_notified_at: z.string().nullable().optional(),
  ending_soon_notified_at: z.string().nullable().optional(),
  status: z.enum(["draft", "pending", "active", "completed", "archived", "cancelled"]),
  xp_reward: z.number().nullable(),
  max_participants: z.number().nullable(),
  is_public: z.boolean().nullable(),
  custom_activity_name: z.string().nullable(),
  allowed_workout_types: z.array(z.string()).nullable().optional(),
  is_solo: z.boolean(),
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

/**
 * Zod schema for validating get_leaderboard RPC response rows.
 * Matches the RETURNS TABLE definition in migration 019.
 */
const leaderboardRpcRowSchema = z.object({
  user_id: z.string().uuid(),
  current_progress: z.number(),
  current_streak: z.number(),
  rank: z.number(),
  today_change: z.number().default(0), // Defaults to 0 if migration 033 not yet applied
  // Flattened profile fields
  username: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

const leaderboardRpcResponseSchema = z.array(leaderboardRpcRowSchema);

type LeaderboardRpcRow = z.infer<typeof leaderboardRpcRowSchema>;

// =============================================================================
// TYPES
// =============================================================================

// Derive participation type from DB types to reduce drift
type ParticipationFields = Pick<ChallengeParticipant, "invite_status" | "current_progress">;

// Coerced version with non-null numerics (nulls coalesced in service layer)
export interface MyParticipation {
  invite_status: ChallengeParticipant["invite_status"]; // Keep nullable from DB
  current_progress: number; // Coalesced to 0
}

export interface ChallengeWithParticipation extends Challenge {
  my_participation?: MyParticipation;
  participant_count?: number; // Total accepted participants
  my_rank?: number; // User's rank (1-indexed)
  is_creator?: boolean; // Whether current user created this challenge
  creator_name?: string; // Creator's display name (for "Invited by X" UI)
  allowed_workout_types?: string[] | null; // Workout type filter (null = all)
  is_solo?: boolean; // Solo challenge flag (default false)
}

export interface LeaderboardEntry {
  user_id: string;
  current_progress: number; // Coalesced to 0
  current_streak: number; // Coalesced to 0
  rank: number;
  today_change: number; // Sum of today's activity (UTC day boundary)
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
function mapRpcToChallengeWithParticipation(row: ChallengeRpcRow): ChallengeWithParticipation {
  const {
    my_invite_status,
    my_current_progress,
    participant_count,
    my_rank,
    starting_soon_notified_at,
    ending_soon_notified_at,
    ...challengeFields
  } = row;

  return {
    ...challengeFields,
    starting_soon_notified_at: starting_soon_notified_at ?? null,
    ending_soon_notified_at: ending_soon_notified_at ?? null,
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
function mapParticipation(raw: ParticipationFields | undefined): MyParticipation | undefined {
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
    //
    // NOTE: Optional RPC parameters use TypeScript's `?:` syntax (string | undefined).
    // Do NOT pass `null` explicitly - omit the key or pass `undefined`.
    // PostgreSQL will use column defaults (NULL) for omitted parameters.
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
        // Optional parameters (undefined = use database default)
        p_description: validated.description,
        p_custom_activity_name:
          validated.challenge_type === "custom" ? validated.custom_activity_name : undefined,
        p_win_condition: validated.win_condition,
        p_daily_target: validated.daily_target,
        // Workout points + retention (migration 034/035)
        p_is_solo: validated.is_solo,
        p_allowed_workout_types:
          validated.challenge_type === "workouts" &&
          validated.allowed_workout_types &&
          validated.allowed_workout_types.length > 0
            ? validated.allowed_workout_types
            : undefined,
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
      const { data, error } = await getSupabaseClient().rpc("get_my_challenges", {
        p_filter: "active",
      });

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
      const { data, error } = await getSupabaseClient().rpc("get_my_challenges", {
        p_filter: "completed",
      });

      if (error) throw error;

      // Validate response shape (catches schema drift between migrations)
      const validated = challengeRpcResponseSchema.parse(data);

      return validated.map(mapRpcToChallengeWithParticipation);
    });
  },

  /**
   * @deprecated Use getMyActiveChallenges() and filter client-side by start_date.
   * The get_my_challenges RPC already returns all challenges where end_date > now(),
   * which includes both "starting soon" and "in progress" challenges.
   *
   * See useHomeScreenData for the correct pattern:
   *   const { inProgress, startingSoon } = splitChallengesByStartDate(activeChallenges)
   *
   * CONTRACT: Status is 'pending' (not yet started)
   * CONTRACT: start_date > now() (in the future)
   * CONTRACT: User is an accepted participant (created OR joined)
   */
  async getStartingSoonChallenges(): Promise<ChallengeWithParticipation[]> {
    return withAuth(async (userId) => {
      // Query challenges where user is an accepted participant
      // This includes both challenges they created AND challenges they joined
      const { data, error } = await getSupabaseClient()
        .from("challenges")
        .select(
          `
          *,
          challenge_participants!inner (
            user_id,
            invite_status,
            current_progress
          )
        `,
        )
        .eq("challenge_participants.user_id", userId)
        .eq("challenge_participants.invite_status", "accepted")
        .eq("status", "pending")
        .gt("start_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Get participant counts for each challenge
      const challengeIds = (data || []).map((c) => c.id);

      // Guard: skip query if no challenges
      let participantCounts = new Map<string, number>();
      if (challengeIds.length > 0) {
        const { data: counts, error: countsError } = await getSupabaseClient()
          .from("challenge_participants")
          .select("challenge_id")
          .in("challenge_id", challengeIds)
          .eq("invite_status", "accepted");

        if (!countsError && counts) {
          // Count participants per challenge
          for (const row of counts) {
            const current = participantCounts.get(row.challenge_id) || 0;
            participantCounts.set(row.challenge_id, current + 1);
          }
        }
      }

      // Fetch creator names for challenges where user is NOT the creator
      // This is needed for "Invited by {name}" UI
      const creatorIds = (data || [])
        .filter((c) => c.creator_id && c.creator_id !== userId)
        .map((c) => c.creator_id!);

      let creatorNames = new Map<string, string>();
      if (creatorIds.length > 0) {
        const { data: creators, error: creatorsError } = await getSupabaseClient()
          .from("profiles_public")
          .select("id, username, display_name")
          .in("id", creatorIds);

        if (!creatorsError && creators) {
          for (const creator of creators) {
            creatorNames.set(creator.id, creator.display_name || creator.username || "Someone");
          }
        }
      }

      return (data || []).map((challenge) => {
        // Find the current user's participation row
        const myParticipation = Array.isArray(challenge.challenge_participants)
          ? challenge.challenge_participants.find((p: any) => p.user_id === userId)
          : challenge.challenge_participants;

        // Determine if user is creator (for UI differentiation if needed)
        const isCreator = challenge.creator_id === userId;

        return {
          ...challenge,
          challenge_participants: undefined, // Remove nested data
          my_participation: myParticipation
            ? {
                invite_status: myParticipation.invite_status,
                current_progress: myParticipation.current_progress ?? 0,
              }
            : undefined,
          participant_count: participantCounts.get(challenge.id) || 1,
          my_rank: 1, // Not meaningful for not-started challenges
          is_creator: isCreator,
          creator_name:
            !isCreator && challenge.creator_id ? creatorNames.get(challenge.creator_id) : undefined,
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
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      ];

      // Guard: skip query if no creator IDs to fetch (empty .in() is problematic)
      let creatorMap = new Map<string, ProfilePublic>();
      if (creatorIds.length > 0) {
        const { data: creators, error: creatorsError } = await getSupabaseClient()
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
  async getChallenge(challengeId: string): Promise<ChallengeWithParticipation | null> {
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

      // Resolve creator display name from profiles_public (Rule 4)
      let creatorName: string | undefined;
      if (challenge.creator_id) {
        const { data: creator } = await getSupabaseClient()
          .from("profiles_public")
          .select("display_name, username")
          .eq("id", challenge.creator_id)
          .single();

        if (creator) {
          creatorName = creator.display_name || creator.username || undefined;
        }
      }

      return {
        ...challenge,
        my_participation: mapParticipation(challenge_participants?.[0]),
        creator_name: creatorName,
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
      const { error: inviteError } = await getSupabaseClient().rpc("invite_to_challenge", {
        p_challenge_id: challenge_id,
        p_user_id: user_id,
      });

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
   * CONTRACT: Atomic RPC updates participant AND marks notification as read
   * CONTRACT: Prevents stale notifications pointing to inaccessible resources
   */
  async respondToInvite(input: unknown): Promise<void> {
    const { challenge_id, response } = validate(respondToInviteSchema, input);

    return withAuth(async () => {
      const { error } = await getSupabaseClient().rpc("respond_to_challenge_invite", {
        p_challenge_id: challenge_id,
        p_response: response,
      });

      if (error) {
        if (error.message?.includes("invite_not_found")) {
          throw new Error("No pending invite found for this challenge");
        }
        if (error.message?.includes("invalid_response")) {
          throw new Error("Response must be 'accepted' or 'declined'");
        }
        throw error;
      }
    });
  },

  /**
   * Leave a challenge (for non-creator participants)
   * CONTRACT: Atomic RPC updates status AND marks notifications as read
   * CONTRACT: Prevents stale notifications pointing to inaccessible resources
   */
  async leaveChallenge(challengeId: string): Promise<void> {
    return withAuth(async () => {
      const { error } = await getSupabaseClient().rpc("leave_challenge", {
        p_challenge_id: challengeId,
      });

      if (error) {
        if (error.message?.includes("not_participant")) {
          throw new Error("You are not a participant in this challenge");
        }
        throw error;
      }
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
   *
   * CONTRACT: Uses atomic RPC for consistent snapshot (no race windows)
   * CONTRACT: Server-side ranking via RANK() window function
   * CONTRACT: Explicit + RLS visibility check (defense-in-depth)
   * CONTRACT: Returns empty array if caller is not accepted participant
   */
  async getLeaderboard(challengeId: string): Promise<LeaderboardEntry[]> {
    return withAuth(async () => {
      const { data, error } = await getSupabaseClient().rpc("get_leaderboard", {
        p_challenge_id: challengeId,
      });

      if (error) throw error;

      // Validate response shape (catches schema drift between migrations)
      const validated = leaderboardRpcResponseSchema.parse(data);

      // Map flat RPC response to LeaderboardEntry with nested profile
      return validated.map((row) => ({
        user_id: row.user_id,
        current_progress: row.current_progress,
        current_streak: row.current_streak,
        rank: row.rank,
        today_change: row.today_change,
        profile: {
          id: row.user_id,
          username: row.username,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          updated_at: "", // Not returned by RPC (not needed for display)
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

  /**
   * Create a rematch challenge from an existing completed challenge.
   * CONTRACT: Duplicates parameters with fresh dates, invites all previous participants.
   * CONTRACT: Uses existing create() + inviteUser() — no new schema required.
   * CONTRACT: Uses server-authoritative time for date computation.
   *
   * @returns New challenge ID
   */
  async rematchChallenge(
    original: ChallengeWithParticipation,
    previousParticipantIds: string[],
  ): Promise<string> {
    return withAuth(async (userId) => {
      // Compute same duration with new dates (starting tomorrow UTC midnight)
      const originalStart = new Date(original.start_date);
      const originalEnd = new Date(original.end_date);
      const durationMs = originalEnd.getTime() - originalStart.getTime();

      // Use server-authoritative time, not device clock
      const now = getServerNow();
      const tomorrowUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      );

      const newEnd = new Date(tomorrowUTC.getTime() + durationMs);

      // Filter to participants other than creator (for invite loop)
      const othersToInvite = previousParticipantIds.filter((id) => id !== userId);

      // Create the new challenge via existing create flow
      const newChallenge = await challengeService.create({
        title: original.title,
        description: original.description ?? undefined,
        challenge_type: original.challenge_type,
        goal_value: original.goal_value,
        goal_unit: original.goal_unit,
        win_condition: original.win_condition,
        daily_target: original.daily_target ?? undefined,
        start_date: tomorrowUTC.toISOString(),
        end_date: newEnd.toISOString(),
        is_solo: original.is_solo ?? false, // Preserve original — DB fact, not inference
        // Carry over custom activity name (required for custom type validation)
        custom_activity_name:
          original.challenge_type === "custom"
            ? (original.custom_activity_name ?? undefined)
            : undefined,
        allowed_workout_types:
          original.challenge_type === "workouts"
            ? (original.allowed_workout_types ?? undefined)
            : undefined,
      });

      // Fire invites in parallel — failures are non-blocking
      const inviteResults = await Promise.allSettled(
        othersToInvite.map((participantId) =>
          challengeService.inviteUser({
            challenge_id: newChallenge.id,
            user_id: participantId,
          }),
        ),
      );

      const failedInvites = inviteResults.filter((r) => r.status === "rejected");
      if (failedInvites.length > 0) {
        console.warn(`Rematch: ${failedInvites.length}/${othersToInvite.length} invites failed`);
      }

      return newChallenge.id;
    });
  },
};
