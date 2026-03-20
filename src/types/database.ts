export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_type: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_type: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_type?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          activity_type: Database["public"]["Enums"]["challenge_type"]
          challenge_id: string | null
          client_event_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          recorded_at: string
          source: string
          source_external_id: string | null
          unit: string
          user_id: string
          value: number
          workout_activity_key: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["challenge_type"]
          challenge_id?: string | null
          client_event_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          recorded_at: string
          source: string
          source_external_id?: string | null
          unit: string
          user_id: string
          value: number
          workout_activity_key?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["challenge_type"]
          challenge_id?: string | null
          client_event_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          recorded_at?: string
          source?: string
          source_external_id?: string | null
          unit?: string
          user_id?: string
          value?: number
          workout_activity_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          current_progress: number | null
          current_streak: number | null
          final_rank: number | null
          id: string
          invite_status: string | null
          joined_at: string | null
          milestone_notified: number
          previous_rank: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean | null
          completed_at?: string | null
          current_progress?: number | null
          current_streak?: number | null
          final_rank?: number | null
          id?: string
          invite_status?: string | null
          joined_at?: string | null
          milestone_notified?: number
          previous_rank?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean | null
          completed_at?: string | null
          current_progress?: number | null
          current_streak?: number | null
          final_rank?: number | null
          id?: string
          invite_status?: string | null
          joined_at?: string | null
          milestone_notified?: number
          previous_rank?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          allowed_workout_types: string[] | null
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          completed_notified_at: string | null
          created_at: string | null
          creator_id: string | null
          custom_activity_name: string | null
          daily_target: number | null
          description: string | null
          end_date: string
          ending_soon_notified_at: string | null
          final_push_notified_at: string | null
          goal_unit: string
          goal_value: number
          id: string
          is_public: boolean | null
          is_solo: boolean
          max_participants: number | null
          start_date: string
          starting_soon_notified_at: string | null
          status: Database["public"]["Enums"]["challenge_status"] | null
          title: string
          updated_at: string | null
          win_condition: Database["public"]["Enums"]["win_condition"]
          workout_activity_filter: string[] | null
          xp_reward: number | null
        }
        Insert: {
          allowed_workout_types?: string[] | null
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          completed_notified_at?: string | null
          created_at?: string | null
          creator_id?: string | null
          custom_activity_name?: string | null
          daily_target?: number | null
          description?: string | null
          end_date: string
          ending_soon_notified_at?: string | null
          final_push_notified_at?: string | null
          goal_unit: string
          goal_value: number
          id?: string
          is_public?: boolean | null
          is_solo?: boolean
          max_participants?: number | null
          start_date: string
          starting_soon_notified_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"] | null
          title: string
          updated_at?: string | null
          win_condition?: Database["public"]["Enums"]["win_condition"]
          workout_activity_filter?: string[] | null
          xp_reward?: number | null
        }
        Update: {
          allowed_workout_types?: string[] | null
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          completed_notified_at?: string | null
          created_at?: string | null
          creator_id?: string | null
          custom_activity_name?: string | null
          daily_target?: number | null
          description?: string | null
          end_date?: string
          ending_soon_notified_at?: string | null
          final_push_notified_at?: string | null
          goal_unit?: string
          goal_value?: number
          id?: string
          is_public?: boolean | null
          is_solo?: boolean
          max_participants?: number | null
          start_date?: string
          starting_soon_notified_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"] | null
          title?: string
          updated_at?: string | null
          win_condition?: Database["public"]["Enums"]["win_condition"]
          workout_activity_filter?: string[] | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          consent_version: string
          created_at: string | null
          granted: boolean
          id: string
          user_id: string
        }
        Insert: {
          consent_type: string
          consent_version: string
          created_at?: string | null
          granted: boolean
          id?: string
          user_id: string
        }
        Update: {
          consent_type?: string
          consent_version?: string
          created_at?: string | null
          granted?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          created_at: string | null
          id: string
          requested_by: string
          requested_to: string
          status: string
          updated_at: string | null
          user_high: string | null
          user_low: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          requested_by: string
          requested_to: string
          status?: string
          updated_at?: string | null
          user_high?: string | null
          user_low?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          requested_by?: string
          requested_to?: string
          status?: string
          updated_at?: string | null
          user_high?: string | null
          user_low?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friends_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_requested_to_fkey"
            columns: ["requested_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_connections: {
        Row: {
          connected_at: string
          created_at: string
          disconnected_at: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          permissions_granted: Json
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          permissions_granted?: Json
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          permissions_granted?: Json
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider: string
          records_deduplicated: number | null
          records_inserted: number | null
          records_processed: number | null
          started_at: string
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          records_deduplicated?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          started_at?: string
          status?: string
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          records_deduplicated?: number | null
          records_inserted?: number | null
          records_processed?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_sync_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          dismissed_at: string | null
          id: string
          push_sent_at: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          dismissed_at?: string | null
          id?: string
          push_sent_at?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          dismissed_at?: string | null
          id?: string
          push_sent_at?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_streak: number | null
          display_name: string | null
          health_setup_completed_at: string | null
          id: string
          is_premium: boolean | null
          last_activity_date: string | null
          last_digest_sent_at: string | null
          longest_streak: number | null
          preferred_language: string | null
          streak_warning_sent_date: string | null
          timezone: string | null
          updated_at: string | null
          username: string
          xp_total: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          health_setup_completed_at?: string | null
          id: string
          is_premium?: boolean | null
          last_activity_date?: string | null
          last_digest_sent_at?: string | null
          longest_streak?: number | null
          preferred_language?: string | null
          streak_warning_sent_date?: string | null
          timezone?: string | null
          updated_at?: string | null
          username: string
          xp_total?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          health_setup_completed_at?: string | null
          id?: string
          is_premium?: boolean | null
          last_activity_date?: string | null
          last_digest_sent_at?: string | null
          longest_streak?: number | null
          preferred_language?: string | null
          streak_warning_sent_date?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string
          xp_total?: number | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_public_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          disabled_at: string | null
          id: string
          last_seen_at: string | null
          platform: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          disabled_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          disabled_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_type_catalog: {
        Row: {
          category: string
          display_name: string
          healthkit_identifier: string | null
          is_active: boolean
          multiplier: number
          sort_order: number
          workout_type: string
        }
        Insert: {
          category: string
          display_name: string
          healthkit_identifier?: string | null
          is_active?: boolean
          multiplier?: number
          sort_order?: number
          workout_type: string
        }
        Update: {
          category?: string
          display_name?: string
          healthkit_identifier?: string | null
          is_active?: boolean
          multiplier?: number
          sort_order?: number
          workout_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_notification: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      cancel_challenge: {
        Args: { p_challenge_id: string }
        Returns: undefined
      }
      challenge_effective_status: {
        Args: { p_challenge_id: string }
        Returns: string
      }
      check_participant_status: {
        Args: {
          p_challenge_id: string
          p_statuses: string[]
          p_user_id: string
        }
        Returns: boolean
      }
      complete_health_sync: {
        Args: {
          p_error_message?: string
          p_log_id: string
          p_metadata?: Json
          p_records_deduplicated?: number
          p_records_inserted?: number
          p_records_processed?: number
          p_status: string
        }
        Returns: undefined
      }
      connect_health_provider: {
        Args: { p_permissions?: Json; p_provider: string }
        Returns: string
      }
      create_challenge_with_participant: {
        Args: {
          p_allowed_workout_types?: string[]
          p_challenge_type: string
          p_custom_activity_name?: string
          p_daily_target?: number
          p_description?: string
          p_end_date: string
          p_goal_unit: string
          p_goal_value: number
          p_is_solo?: boolean
          p_start_date: string
          p_title: string
          p_win_condition?: string
        }
        Returns: {
          allowed_workout_types: string[] | null
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          completed_notified_at: string | null
          created_at: string | null
          creator_id: string | null
          custom_activity_name: string | null
          daily_target: number | null
          description: string | null
          end_date: string
          ending_soon_notified_at: string | null
          final_push_notified_at: string | null
          goal_unit: string
          goal_value: number
          id: string
          is_public: boolean | null
          is_solo: boolean
          max_participants: number | null
          start_date: string
          starting_soon_notified_at: string | null
          status: Database["public"]["Enums"]["challenge_status"] | null
          title: string
          updated_at: string | null
          win_condition: Database["public"]["Enums"]["win_condition"]
          workout_activity_filter: string[] | null
          xp_reward: number | null
        }
        SetofOptions: {
          from: "*"
          to: "challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      disconnect_health_provider: {
        Args: { p_provider: string }
        Returns: undefined
      }
      enqueue_challenge_invite_notification: {
        Args: { p_challenge_id: string; p_invited_user_id: string }
        Returns: undefined
      }
      enqueue_friend_request_notification: {
        Args: { p_recipient_user_id: string }
        Returns: undefined
      }
      get_activity_summary: {
        Args: { p_challenge_id: string }
        Returns: {
          count: number
          last_recorded_at: string
          total_value: number
        }[]
      }
      get_challenges_for_health_sync: {
        Args: never
        Returns: {
          challenge_id: string
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          end_date: string
          start_date: string
          workout_activity_filter: string[]
        }[]
      }
      get_health_connection: {
        Args: { p_provider: string }
        Returns: {
          connected_at: string
          id: string
          is_active: boolean
          last_sync_at: string
          permissions_granted: Json
          provider: string
        }[]
      }
      get_leaderboard: {
        Args: { p_challenge_id: string }
        Returns: {
          avatar_url: string
          current_progress: number
          current_streak: number
          display_name: string
          rank: number
          today_change: number
          user_id: string
          username: string
        }[]
      }
      get_my_challenges: {
        Args: { p_filter: string }
        Returns: {
          allowed_workout_types: string[]
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          created_at: string
          creator_id: string
          custom_activity_name: string
          daily_target: number
          description: string
          end_date: string
          ending_soon_notified_at: string
          goal_unit: string
          goal_value: number
          id: string
          is_public: boolean
          is_solo: boolean
          max_participants: number
          my_current_progress: number
          my_invite_status: string
          my_rank: number
          participant_count: number
          start_date: string
          starting_soon_notified_at: string
          status: Database["public"]["Enums"]["challenge_status"]
          title: string
          updated_at: string
          win_condition: Database["public"]["Enums"]["win_condition"]
          xp_reward: number
        }[]
      }
      get_recent_health_activities: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          activity_type: Database["public"]["Enums"]["challenge_type"]
          challenge_id: string | null
          challenge_title: string | null
          id: string
          recorded_at: string
          source: string
          unit: string
          value: number
        }[]
      }
      get_server_time: { Args: never; Returns: string }
      invite_to_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: undefined
      }
      is_challenge_creator: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: boolean
      }
      is_challenge_participant: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: boolean
      }
      leave_challenge: { Args: { p_challenge_id: string }; Returns: undefined }
      log_activity: {
        Args: {
          p_activity_type: string
          p_challenge_id: string
          p_client_event_id?: string
          p_recorded_at?: string
          p_source: string
          p_source_external_id?: string
          p_value: number
        }
        Returns: undefined
      }
      log_health_activity: { Args: { p_activities: Json }; Returns: Json }
      log_workout: {
        Args: {
          p_challenge_id: string
          p_client_event_id?: string
          p_duration_minutes: number
          p_recorded_at: string
          p_source: string
          p_source_external_id?: string
          p_workout_type: string
        }
        Returns: number
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      process_scheduled_notifications: { Args: never; Returns: undefined }
      purge_old_notifications: { Args: never; Returns: number }
      record_audit: {
        Args: { p_action: string; p_details?: Json; p_user_id: string }
        Returns: undefined
      }
      respond_to_challenge_invite: {
        Args: { p_challenge_id: string; p_response: string }
        Returns: undefined
      }
      restore_notification: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      send_challenge_completion_results: { Args: never; Returns: undefined }
      send_challenge_ending_soon_notifications: {
        Args: never
        Returns: undefined
      }
      send_challenge_starting_soon_notifications: {
        Args: never
        Returns: undefined
      }
      send_final_push_notifications: { Args: never; Returns: undefined }
      send_streak_warning_notifications: { Args: never; Returns: undefined }
      send_weekly_digest_notifications: { Args: never; Returns: undefined }
      start_health_sync: {
        Args: { p_provider: string; p_sync_type: string }
        Returns: string
      }
      update_challenge_statuses: { Args: never; Returns: undefined }
      update_health_last_sync: {
        Args: { p_provider: string }
        Returns: undefined
      }
    }
    Enums: {
      challenge_status:
        | "draft"
        | "pending"
        | "active"
        | "completed"
        | "archived"
        | "cancelled"
      challenge_type:
        | "steps"
        | "active_minutes"
        | "workouts"
        | "distance"
        | "custom"
        | "calories"
      win_condition:
        | "highest_total"
        | "first_to_goal"
        | "longest_streak"
        | "all_complete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      challenge_status: [
        "draft",
        "pending",
        "active",
        "completed",
        "archived",
        "cancelled",
      ],
      challenge_type: [
        "steps",
        "active_minutes",
        "workouts",
        "distance",
        "custom",
        "calories",
      ],
      win_condition: [
        "highest_total",
        "first_to_goal",
        "longest_streak",
        "all_complete",
      ],
    },
  },
} as const
