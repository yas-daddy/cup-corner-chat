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
      bet_transactions: {
        Row: {
          amount: number
          bet_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          player_id: string
        }
        Insert: {
          amount: number
          bet_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          player_id: string
        }
        Update: {
          amount?: number
          bet_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_transactions_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      bets: {
        Row: {
          decimal_odds: number
          id: string
          match_id: string
          payout: number | null
          placed_at: string
          player_id: string
          selection: string
          settled_at: string | null
          stake: number
          status: string
          updated_at: string
        }
        Insert: {
          decimal_odds: number
          id?: string
          match_id: string
          payout?: number | null
          placed_at?: string
          player_id: string
          selection: string
          settled_at?: string | null
          stake: number
          status?: string
          updated_at?: string
        }
        Update: {
          decimal_odds?: number
          id?: string
          match_id?: string
          payout?: number | null
          placed_at?: string
          player_id?: string
          selection?: string
          settled_at?: string | null
          stake?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "bets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "bets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      champion_predictions: {
        Row: {
          created_at: string
          player_id: string
          team: string
          team_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          player_id: string
          team: string
          team_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          player_id?: string
          team?: string
          team_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
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
          {
            foreignKeyName: "comments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      espn_match_events: {
        Row: {
          athlete_name: string | null
          clock_display: string | null
          created_at: string
          idx: number
          is_own_goal: boolean
          is_penalty: boolean
          is_scoring_play: boolean
          match_id: string
          payload: Json | null
          team_code: string | null
          type_text: string
        }
        Insert: {
          athlete_name?: string | null
          clock_display?: string | null
          created_at?: string
          idx: number
          is_own_goal?: boolean
          is_penalty?: boolean
          is_scoring_play?: boolean
          match_id: string
          payload?: Json | null
          team_code?: string | null
          type_text: string
        }
        Update: {
          athlete_name?: string | null
          clock_display?: string | null
          created_at?: string
          idx?: number
          is_own_goal?: boolean
          is_penalty?: boolean
          is_scoring_play?: boolean
          match_id?: string
          payload?: Json | null
          team_code?: string | null
          type_text?: string
        }
        Relationships: []
      }
      espn_matches: {
        Row: {
          advanced_side: string | null
          away_code: string | null
          away_logo: string | null
          away_score: number | null
          away_team: string
          clock_display: string | null
          completed: boolean
          group_label: string | null
          home_code: string | null
          home_logo: string | null
          home_score: number | null
          home_team: string
          id: string
          is_knockout: boolean
          kickoff_at: string
          last_synced_at: string
          linked_match_id: string | null
          odds_away_decimal: number | null
          odds_draw_decimal: number | null
          odds_home_decimal: number | null
          odds_provider: string | null
          odds_updated_at: string | null
          stage: string | null
          state: string
          status_detail: string | null
        }
        Insert: {
          advanced_side?: string | null
          away_code?: string | null
          away_logo?: string | null
          away_score?: number | null
          away_team: string
          clock_display?: string | null
          completed?: boolean
          group_label?: string | null
          home_code?: string | null
          home_logo?: string | null
          home_score?: number | null
          home_team: string
          id: string
          is_knockout?: boolean
          kickoff_at: string
          last_synced_at?: string
          linked_match_id?: string | null
          odds_away_decimal?: number | null
          odds_draw_decimal?: number | null
          odds_home_decimal?: number | null
          odds_provider?: string | null
          odds_updated_at?: string | null
          stage?: string | null
          state: string
          status_detail?: string | null
        }
        Update: {
          advanced_side?: string | null
          away_code?: string | null
          away_logo?: string | null
          away_score?: number | null
          away_team?: string
          clock_display?: string | null
          completed?: boolean
          group_label?: string | null
          home_code?: string | null
          home_logo?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          is_knockout?: boolean
          kickoff_at?: string
          last_synced_at?: string
          linked_match_id?: string | null
          odds_away_decimal?: number | null
          odds_draw_decimal?: number | null
          odds_home_decimal?: number | null
          odds_provider?: string | null
          odds_updated_at?: string | null
          stage?: string | null
          state?: string
          status_detail?: string | null
        }
        Relationships: []
      }
      espn_standings: {
        Row: {
          d: number
          ga: number
          gd: number
          gf: number
          gp: number
          group_label: string
          l: number
          last_synced_at: string
          pts: number
          rank: number | null
          team_code: string
          team_logo: string | null
          team_name: string
          w: number
        }
        Insert: {
          d?: number
          ga?: number
          gd?: number
          gf?: number
          gp?: number
          group_label: string
          l?: number
          last_synced_at?: string
          pts?: number
          rank?: number | null
          team_code: string
          team_logo?: string | null
          team_name: string
          w?: number
        }
        Update: {
          d?: number
          ga?: number
          gd?: number
          gf?: number
          gp?: number
          group_label?: string
          l?: number
          last_synced_at?: string
          pts?: number
          rank?: number | null
          team_code?: string
          team_logo?: string | null
          team_name?: string
          w?: number
        }
        Relationships: []
      }
      feed_activities: {
        Row: {
          actor_id: string
          away_score: number | null
          body: string | null
          created_at: string
          home_score: number | null
          id: string
          is_correct_result: boolean | null
          is_exact: boolean | null
          kind: string
          match_id: string | null
          points: number | null
          pred_away: number | null
          pred_home: number | null
        }
        Insert: {
          actor_id: string
          away_score?: number | null
          body?: string | null
          created_at?: string
          home_score?: number | null
          id?: string
          is_correct_result?: boolean | null
          is_exact?: boolean | null
          kind: string
          match_id?: string | null
          points?: number | null
          pred_away?: number | null
          pred_home?: number | null
        }
        Update: {
          actor_id?: string
          away_score?: number | null
          body?: string | null
          created_at?: string
          home_score?: number | null
          id?: string
          is_correct_result?: boolean | null
          is_exact?: boolean | null
          kind?: string
          match_id?: string | null
          points?: number | null
          pred_away?: number | null
          pred_home?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
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
            foreignKeyName: "feed_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
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
      match_lineups: {
        Row: {
          captain: boolean
          created_at: string
          espn_player_id: string | null
          formation: string | null
          full_name: string
          idx: number
          is_starter: boolean
          jersey_number: number | null
          match_id: string
          position: string | null
          team_code: string
          updated_at: string
        }
        Insert: {
          captain?: boolean
          created_at?: string
          espn_player_id?: string | null
          formation?: string | null
          full_name: string
          idx: number
          is_starter?: boolean
          jersey_number?: number | null
          match_id: string
          position?: string | null
          team_code: string
          updated_at?: string
        }
        Update: {
          captain?: boolean
          created_at?: string
          espn_player_id?: string | null
          formation?: string | null
          full_name?: string
          idx?: number
          is_starter?: boolean
          jersey_number?: number | null
          match_id?: string
          position?: string | null
          team_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          advanced_side: string | null
          away_code: string | null
          away_score: number | null
          away_team: string
          group_name: string | null
          home_code: string | null
          home_score: number | null
          home_team: string
          id: string
          is_knockout: boolean
          kickoff_at: string
          last_synced_at: string
          stage: string | null
          status: string
        }
        Insert: {
          advanced_side?: string | null
          away_code?: string | null
          away_score?: number | null
          away_team: string
          group_name?: string | null
          home_code?: string | null
          home_score?: number | null
          home_team: string
          id: string
          is_knockout?: boolean
          kickoff_at: string
          last_synced_at?: string
          stage?: string | null
          status?: string
        }
        Update: {
          advanced_side?: string | null
          away_code?: string | null
          away_score?: number | null
          away_team?: string
          group_name?: string | null
          home_code?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          is_knockout?: boolean
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
          last_open_at: string | null
          pwa_display_mode: string | null
          pwa_installed_at: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          display_name: string
          id?: string
          last_open_at?: string | null
          pwa_display_mode?: string | null
          pwa_installed_at?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          display_name?: string
          id?: string
          last_open_at?: string | null
          pwa_display_mode?: string | null
          pwa_installed_at?: string | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          advance_pick: string | null
          created_at: string
          id: string
          last_emitted_at: string | null
          last_emitted_away: number | null
          last_emitted_home: number | null
          match_id: string
          player_id: string
          pred_away: number
          pred_home: number
          updated_at: string
        }
        Insert: {
          advance_pick?: string | null
          created_at?: string
          id?: string
          last_emitted_at?: string | null
          last_emitted_away?: number | null
          last_emitted_home?: number | null
          match_id: string
          player_id: string
          pred_away: number
          pred_home: number
          updated_at?: string
        }
        Update: {
          advance_pick?: string | null
          created_at?: string
          id?: string
          last_emitted_at?: string | null
          last_emitted_away?: number | null
          last_emitted_home?: number | null
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
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
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
          {
            foreignKeyName: "predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      push_seen_matches: {
        Row: {
          match_id: string
          notified_at: string
          player_id: string
        }
        Insert: {
          match_id: string
          notified_at?: string
          player_id: string
        }
        Update: {
          match_id?: string
          notified_at?: string
          player_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          player_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          player_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          player_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          answered_at: string
          choice_index: number
          player_id: string
          points: number
          question_id: string
        }
        Insert: {
          answered_at?: string
          choice_index: number
          player_id: string
          points: number
          question_id: string
        }
        Update: {
          answered_at?: string
          choice_index?: number
          player_id?: string
          points?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "quiz_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "quiz_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          category: string
          choices: Json
          correct_index: number
          explanation: string | null
          id: string
          order_index: number
          text: string
          unlock_date: string
        }
        Insert: {
          category: string
          choices: Json
          correct_index: number
          explanation?: string | null
          id?: string
          order_index: number
          text: string
          unlock_date: string
        }
        Update: {
          category?: string
          choices?: Json
          correct_index?: number
          explanation?: string | null
          id?: string
          order_index?: number
          text?: string
          unlock_date?: string
        }
        Relationships: []
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
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
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
          {
            foreignKeyName: "reactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      squad_players: {
        Row: {
          captain: boolean
          club: string | null
          club_country_code: string | null
          created_at: string
          display_name: string | null
          dob: string | null
          full_name: string
          height_cm: number | null
          id: string
          image_url: string | null
          jersey_number: number | null
          last_synced_at: string
          position: string | null
          team_code: string
          updated_at: string
        }
        Insert: {
          captain?: boolean
          club?: string | null
          club_country_code?: string | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          full_name: string
          height_cm?: number | null
          id: string
          image_url?: string | null
          jersey_number?: number | null
          last_synced_at?: string
          position?: string | null
          team_code: string
          updated_at?: string
        }
        Update: {
          captain?: boolean
          club?: string | null
          club_country_code?: string | null
          created_at?: string
          display_name?: string | null
          dob?: string | null
          full_name?: string
          height_cm?: number | null
          id?: string
          image_url?: string | null
          jersey_number?: number | null
          last_synced_at?: string
          position?: string | null
          team_code?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      bank_balances: {
        Row: {
          balance: number | null
          player_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      bank_leaderboard: {
        Row: {
          avatar: string | null
          balance: number | null
          biggest_win: number | null
          display_name: string | null
          losses: number | null
          player_id: string | null
          settled_count: number | null
          wins: number | null
        }
        Relationships: []
      }
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
          advance_pick: string | null
          advanced_side: string | null
          away_score: number | null
          home_score: number | null
          id: string | null
          is_correct_result: boolean | null
          is_exact: boolean | null
          is_knockout: boolean | null
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
            referencedRelation: "bank_leaderboard"
            referencedColumns: ["player_id"]
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
          {
            foreignKeyName: "predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "quiz_leaderboard"
            referencedColumns: ["player_id"]
          },
        ]
      }
      quiz_leaderboard: {
        Row: {
          answered: number | null
          avatar: string | null
          correct: number | null
          display_name: string | null
          player_id: string | null
          total_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_champion: {
        Args: { _player_id: string }
        Returns: undefined
      }
      admin_delete_prediction: {
        Args: { _match_id: string; _player_id: string }
        Returns: undefined
      }
      admin_upsert_champion: {
        Args: { _player_id: string; _team: string; _team_code: string }
        Returns: {
          created_at: string
          player_id: string
          team: string
          team_code: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "champion_predictions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_prediction: {
        Args: {
          _away: number
          _home: number
          _match_id: string
          _player_id: string
        }
        Returns: {
          advance_pick: string | null
          created_at: string
          id: string
          last_emitted_at: string | null
          last_emitted_away: number | null
          last_emitted_home: number | null
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
