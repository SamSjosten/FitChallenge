/**
 * Database Type Helpers
 *
 * This file contains convenience type aliases derived from the auto-generated
 * database.ts. These are kept separate so they survive type regeneration.
 *
 * USAGE:
 *   import type { Challenge, Profile } from '@/types/database-helpers';
 *
 * AFTER REGENERATING database.ts:
 *   1. Run: npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *   2. This file remains unchanged ✓
 *   3. Verify no new tables need aliases added here
 */

import type { Database } from "./database";

// =============================================================================
// TABLE ROW TYPES (Read)
// =============================================================================

/** User's private profile (self-only via RLS) */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** User's public identity (global read via RLS) */
export type ProfilePublic =
  Database["public"]["Tables"]["profiles_public"]["Row"];

/** Challenge definition */
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

/** Challenge participant record */
export type ChallengeParticipant =
  Database["public"]["Tables"]["challenge_participants"]["Row"];

/** Activity log entry (immutable) */
export type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];

/** Friend relationship */
export type Friend = Database["public"]["Tables"]["friends"]["Row"];

/** Push notification token */
export type PushToken = Database["public"]["Tables"]["push_tokens"]["Row"];

/** In-app notification */
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

/** Achievement record */
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];

/** Consent record (GDPR) */
export type ConsentRecord =
  Database["public"]["Tables"]["consent_records"]["Row"];

/** Audit log entry */
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];

/** Health provider connection */
export type HealthConnection =
  Database["public"]["Tables"]["health_connections"]["Row"];

/** Health sync log entry */
export type HealthSyncLog =
  Database["public"]["Tables"]["health_sync_logs"]["Row"];

// =============================================================================
// TABLE INSERT TYPES (Create)
// =============================================================================

export type ChallengeInsert =
  Database["public"]["Tables"]["challenges"]["Insert"];
export type ChallengeParticipantInsert =
  Database["public"]["Tables"]["challenge_participants"]["Insert"];
export type ActivityLogInsert =
  Database["public"]["Tables"]["activity_logs"]["Insert"];
export type FriendInsert = Database["public"]["Tables"]["friends"]["Insert"];
export type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

// =============================================================================
// TABLE UPDATE TYPES (Modify)
// =============================================================================

export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
export type ChallengeUpdate =
  Database["public"]["Tables"]["challenges"]["Update"];
export type ChallengeParticipantUpdate =
  Database["public"]["Tables"]["challenge_participants"]["Update"];

// =============================================================================
// ENUM TYPES
// =============================================================================

export type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];
export type ChallengeType = Database["public"]["Enums"]["challenge_type"];
export type WinCondition = Database["public"]["Enums"]["win_condition"];

// =============================================================================
// RPC RETURN TYPES
// =============================================================================

/** Return type for get_my_challenges RPC */
export type GetMyChallengesRow =
  Database["public"]["Functions"]["get_my_challenges"]["Returns"][number];

/** Return type for get_leaderboard RPC */
export type GetLeaderboardRow =
  Database["public"]["Functions"]["get_leaderboard"]["Returns"][number];

/** Return type for get_activity_summary RPC */
export type GetActivitySummaryRow =
  Database["public"]["Functions"]["get_activity_summary"]["Returns"][number];

/** Return type for get_health_connection RPC */
export type GetHealthConnectionRow =
  Database["public"]["Functions"]["get_health_connection"]["Returns"][number];

// =============================================================================
// RE-EXPORT DATABASE TYPE AND UTILITIES
// =============================================================================

export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
  Json,
} from "./database";
export { Constants } from "./database";
