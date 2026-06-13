export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  kickoff_at: string;
  stage: string | null;
  group_name: string | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | string;
  home_score: number | null;
  away_score: number | null;
};

export type Prediction = {
  id: string;
  player_id: string;
  match_id: string;
  pred_home: number;
  pred_away: number;
};

export type LeaderRow = {
  player_id: string;
  display_name: string;
  predictions_made: number;
  correct_results: number;
  exact_scores: number;
  total_points: number;
};

export type PredictionPointRow = {
  id: string;
  player_id: string;
  match_id: string;
  pred_home: number;
  pred_away: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  points: number;
  is_exact: boolean;
  is_correct_result: boolean;
};
