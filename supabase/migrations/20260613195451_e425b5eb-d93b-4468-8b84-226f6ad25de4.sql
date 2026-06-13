
-- Players (trust-based identity, just a first name)
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Matches (mirror of football API data)
CREATE TABLE public.matches (
  id text PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_code text,
  away_code text,
  kickoff_at timestamptz NOT NULL,
  stage text,
  group_name text,
  status text NOT NULL DEFAULT 'SCHEDULED',
  home_score int,
  away_score int,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_kickoff_idx ON public.matches (kickoff_at);

-- Predictions
CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  pred_home int NOT NULL CHECK (pred_home >= 0 AND pred_home <= 30),
  pred_away int NOT NULL CHECK (pred_away >= 0 AND pred_away <= 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, match_id)
);
CREATE INDEX predictions_player_idx ON public.predictions (player_id);
CREATE INDEX predictions_match_idx ON public.predictions (match_id);

-- Grants (trust-based; anon role is the only client role used by the app)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO anon, authenticated;
GRANT ALL ON public.players, public.matches, public.predictions TO service_role;

-- RLS (permissive — this is a private trust-based group league)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players open" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "matches read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches write" ON public.matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "predictions open" ON public.predictions FOR ALL USING (true) WITH CHECK (true);

-- Server-side lock: cannot create/modify predictions after kickoff
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k timestamptz;
BEGIN
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN
    RAISE EXCEPTION 'Match % not found', NEW.match_id;
  END IF;
  IF now() >= k THEN
    RAISE EXCEPTION 'Predictions are locked for this match';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER predictions_lock_trigger
BEFORE INSERT OR UPDATE ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_lock();

-- Per-prediction points view
CREATE OR REPLACE VIEW public.prediction_points AS
SELECT
  p.id,
  p.player_id,
  p.match_id,
  p.pred_home,
  p.pred_away,
  m.home_score,
  m.away_score,
  m.status,
  CASE
    WHEN m.status <> 'FINISHED' OR m.home_score IS NULL OR m.away_score IS NULL THEN 0
    WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 8
    WHEN sign(p.pred_home - p.pred_away) = sign(m.home_score - m.away_score) THEN 3
    ELSE 0
  END AS points,
  CASE
    WHEN m.status = 'FINISHED' AND p.pred_home = m.home_score AND p.pred_away = m.away_score THEN true
    ELSE false
  END AS is_exact,
  CASE
    WHEN m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
      AND sign(p.pred_home - p.pred_away) = sign(m.home_score - m.away_score) THEN true
    ELSE false
  END AS is_correct_result
FROM public.predictions p
JOIN public.matches m ON m.id = p.match_id;

GRANT SELECT ON public.prediction_points TO anon, authenticated, service_role;

-- Leaderboard view
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  pl.id AS player_id,
  pl.display_name,
  pl.created_at,
  COUNT(pp.id) FILTER (WHERE pp.status = 'FINISHED') AS predictions_made,
  COUNT(*) FILTER (WHERE pp.is_correct_result) AS correct_results,
  COUNT(*) FILTER (WHERE pp.is_exact) AS exact_scores,
  COALESCE(SUM(pp.points), 0) AS total_points
FROM public.players pl
LEFT JOIN public.prediction_points pp ON pp.player_id = pl.id
GROUP BY pl.id, pl.display_name, pl.created_at;

GRANT SELECT ON public.leaderboard TO anon, authenticated, service_role;
