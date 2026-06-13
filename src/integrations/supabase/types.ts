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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          player_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          player_id: string
          target_id: string
          target_type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          player_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "comments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_activities: {
        Row: {
          actor_id: string
          away_score: number | null
          created_at: string
          home_score: number | null
          id: string
          is_correct_result: boolean | null
          is_exact: boolean | null
          kind: string
          match_id: string
          points: number | null
          pred_away: number | null
          pred_home: number | null
        }
        Insert: {
          actor_id: string
          away_score?: number | null
          created_at?: string
          home_score?: number | null
          id?: string
          is_correct_result?: boolean | null
          is_exact?: boolean | null
          kind: string
          match_id: string
          points?: number | null
          pred_away?: number | null
          pred_home?: number | null
        }
        Update: {
          actor_id?: string
          away_score?: number | null
          created_at?: string
          home_score?: number | null
          id?: string
          is_correct_result?: boolean | null
          is_exact?: boolean | null
          kind?: string
          match_id?: string
          points?: number | null
          pred_away?: number | null
          pred_home?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "feed_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_activities_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_code: string | null
          away_score: number | null
          away_team: string
          group_name: string | null
          home_code: string | null
          home_score: number | null
          home_team: string
          id: string
          kickoff_at: string
          last_synced_at: string
          stage: string | null
          status: string
        }
        Insert: {
          away_code?: string | null
          away_score?: number | null
          away_team: string
          group_name?: string | null
          home_code?: string | null
          home_score?: number | null
          home_team: string
          id: string
          kickoff_at: string
          last_synced_at?: string
          stage?: string | null
          status?: string
        }
        Update: {
          away_code?: string | null
          away_score?: number | null
          away_team?: string
          group_name?: string | null
          home_code?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff_at?: string
          last_synced_at?: string
          stage?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          match_id: string | null
          points: number | null
          read_at: string | null
          recipient_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          match_id?: string | null
          points?: number | null
          read_at?: string | null
          recipient_id: string
          target_id: string
          target_type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          match_id?: string | null
          points?: number | null
          read_at?: string | null
          recipient_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          avatar: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name: string
          id?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          match_id: string
          player_id: string
          pred_away: number
          pred_home: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          pred_away: number
          pred_home: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          pred_away?: number
          pred_home?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          id: string
          player_id: string
          target_id: string
          target_type: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          target_id: string
          target_type: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          target_id?: string
          target_type?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "reactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar: string | null
          correct_results: number | null
          created_at: string | null
          display_name: string | null
          exact_scores: number | null
          player_id: string | null
          predictions_made: number | null
          total_points: number | null
        }
        Relationships: []
      }
      prediction_points: {
        Row: {
          away_score: number | null
          home_score: number | null
          id: string | null
          is_correct_result: boolean | null
          is_exact: boolean | null
          match_id: string | null
          player_id: string | null
          points: number | null
          pred_away: number | null
          pred_home: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_prediction: {
        Args: { _match_id: string; _player_id: string }
        Returns: undefined
      }
      admin_upsert_prediction: {
        Args: {
          _away: number
          _home: number
          _match_id: string
          _player_id: string
        }
        Returns: {
          created_at: string
          id: string
          match_id: string
          player_id: string
          pred_away: number
          pred_home: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "predictions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
