// src/types/database.ts
// Generated types for Supabase database
// Keep in sync with migrations

export type ChallengeType = 'steps' | 'active_minutes' | 'workouts' | 'distance' | 'custom';
export type WinCondition = 'highest_total' | 'first_to_goal' | 'longest_streak' | 'all_complete';
export type ChallengeStatus = 'draft' | 'pending' | 'active' | 'completed' | 'archived' | 'cancelled';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'removed';
export type FriendStatus = 'pending' | 'accepted' | 'blocked';
export type ActivitySource = 'manual' | 'healthkit' | 'googlefit';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          xp_total: number;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          is_premium: boolean;
          preferred_language: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          preferred_language?: string;
        };
      };
      profiles_public: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          updated_at: string;
        };
        Insert: never; // Sync trigger only
        Update: never; // Sync trigger only
      };
      challenges: {
        Row: {
          id: string;
          creator_id: string | null;
          title: string;
          description: string | null;
          challenge_type: ChallengeType;
          goal_value: number;
          goal_unit: string;
          win_condition: WinCondition;
          daily_target: number | null;
          start_date: string;
          end_date: string;
          status: ChallengeStatus;
          xp_reward: number;
          max_participants: number;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          creator_id: string;
          title: string;
          description?: string | null;
          challenge_type: ChallengeType;
          goal_value: number;
          goal_unit: string;
          win_condition?: WinCondition;
          daily_target?: number | null;
          start_date: string;
          end_date: string;
          status?: ChallengeStatus;
          xp_reward?: number;
          max_participants?: number;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: ChallengeStatus;
        };
      };
      challenge_participants: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          invite_status: InviteStatus;
          current_progress: number;
          current_streak: number;
          completed: boolean;
          completed_at: string | null;
          final_rank: number | null;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          challenge_id: string;
          user_id: string;
          invite_status?: InviteStatus;
        };
        Update: {
          invite_status?: InviteStatus;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string | null;
          activity_type: ChallengeType;
          value: number;
          unit: string;
          source: ActivitySource;
          recorded_at: string;
          created_at: string;
          client_event_id: string | null;
          source_external_id: string | null;
        };
        Insert: {
          user_id: string;
          challenge_id?: string | null;
          activity_type: ChallengeType;
          value: number;
          unit: string;
          source: ActivitySource;
          recorded_at: string;
          client_event_id?: string | null;
          source_external_id?: string | null;
        };
        Update: never; // Immutable
      };
      friends: {
        Row: {
          id: string;
          requested_by: string;
          requested_to: string;
          status: FriendStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          requested_by: string;
          requested_to: string;
          status?: FriendStatus;
        };
        Update: {
          status?: FriendStatus;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          data: Record<string, unknown>;
          read_at: string | null;
          push_sent_at: string | null;
          created_at: string;
        };
        Insert: never; // Server-side only
        Update: {
          read_at?: string | null;
        };
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_type: string;
          unlocked_at: string;
        };
        Insert: never; // Server-side only
        Update: never;
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web' | null;
          created_at: string;
          last_seen_at: string | null;
          disabled_at: string | null;
        };
        Insert: {
          user_id: string;
          token: string;
          platform?: 'ios' | 'android' | 'web' | null;
        };
        Update: {
          last_seen_at?: string | null;
          disabled_at?: string | null;
        };
      };
      consent_records: {
        Row: {
          id: string;
          user_id: string;
          consent_type: string;
          granted: boolean;
          consent_version: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          consent_type: string;
          granted: boolean;
          consent_version: string;
        };
        Update: never; // Append-only
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          details: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never; // Via function only
        Update: never;
      };
    };
    Functions: {
      log_activity: {
        Args: {
          p_challenge_id: string;
          p_activity_type: string;
          p_value: number;
          p_recorded_at: string;
          p_source: string;
          p_client_event_id?: string | null;
          p_source_external_id?: string | null;
        };
        Returns: void;
      };
      enqueue_challenge_invite_notification: {
        Args: {
          p_challenge_id: string;
          p_invited_user_id: string;
        };
        Returns: void;
      };
      update_challenge_statuses: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
  };
}

// Helper types for common use cases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfilePublic = Database['public']['Tables']['profiles_public']['Row'];
export type Challenge = Database['public']['Tables']['challenges']['Row'];
export type ChallengeInsert = Database['public']['Tables']['challenges']['Insert'];
export type ChallengeParticipant = Database['public']['Tables']['challenge_participants']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type Friend = Database['public']['Tables']['friends']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
