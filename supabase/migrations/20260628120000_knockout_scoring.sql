-- Knockout-stage scoring.
-- All bonuses now stack — no "exact replaces the rest" shortcut, just a sum.
-- For knockouts the granular bonuses double (+2 vs +1) and a +4 advance-team
-- bonus appears. Group-stage scoring is unchanged in net effect; the view is
-- rewritten to make the additive nature explicit and to branch on is_knockout.

-- 1) Schema additions
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_knockout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advanced_side text
    CHECK (advanced_side IS NULL OR advanced_side IN ('home','away'));

ALTER TABLE public.espn_matches
  ADD COLUMN IF NOT EXISTS is_knockout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advanced_side text
    CHECK (advanced_side IS NULL OR advanced_side IN ('home','away'));

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS advance_pick text
    CHECK (advance_pick IS NULL OR advance_pick IN ('home','away'));

-- 2) Tighten the prediction-lock trigger so advance_pick is also locked at
-- kickoff (the existing "allow non-score updates" escape only checked the
-- score columns).
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE k timestamptz;
BEGIN
  IF current_setting('app.bypass_lock', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.pred_home IS NOT DISTINCT FROM OLD.pred_home
     AND NEW.pred_away IS NOT DISTINCT FROM OLD.pred_away
     AND NEW.advance_pick IS NOT DISTINCT FROM OLD.advance_pick
  THEN
    RETURN NEW;
  END IF;
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN RAISE EXCEPTION 'Match % not found', NEW.match_id; END IF;
  IF now() >= k THEN RAISE EXCEPTION 'Predictions are locked for this match'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 3) Rewrite prediction_points to branch on is_knockout.
-- Group stage: +3 direction, +1 home, +1 away, +1 GD, +2 exact bonus (max 8).
-- Knockout:    +3 direction, +2 home, +2 away, +2 GD, +4 advance, +2 exact bonus (max 15).
CREATE OR REPLACE VIEW public.prediction_points AS
SELECT
  p.id, p.player_id, p.match_id, p.pred_home, p.pred_away, p.advance_pick,
  m.home_score, m.away_score, m.status, m.is_knockout, m.advanced_side,
  CASE
    WHEN m.status <> 'FINISHED' OR m.home_score IS NULL OR m.away_score IS NULL THEN 0
    WHEN NOT m.is_knockout THEN
      -- Group stage: existing 8/6/3/0 ladder, written additively.
        (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 3 ELSE 0 END)
      + (CASE WHEN p.pred_home = m.home_score THEN 1 ELSE 0 END)
      + (CASE WHEN p.pred_away = m.away_score THEN 1 ELSE 0 END)
      + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
              AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score)
              AND (m.home_score - m.away_score) <> 0 THEN 1 ELSE 0 END)
      + (CASE WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 2 ELSE 0 END)
    ELSE
      -- Knockout: same shape, doubled granular bonuses + advance + exact.
        (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 3 ELSE 0 END)
      + (CASE WHEN p.pred_home = m.home_score THEN 2 ELSE 0 END)
      + (CASE WHEN p.pred_away = m.away_score THEN 2 ELSE 0 END)
      + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
              AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score)
              AND (m.home_score - m.away_score) <> 0 THEN 2 ELSE 0 END)
      + (CASE
           WHEN m.advanced_side IS NULL THEN 0
           WHEN p.pred_home > p.pred_away AND m.advanced_side = 'home' THEN 4
           WHEN p.pred_home < p.pred_away AND m.advanced_side = 'away' THEN 4
           WHEN p.pred_home = p.pred_away AND p.advance_pick = m.advanced_side THEN 4
           ELSE 0
         END)
      + (CASE WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 2 ELSE 0 END)
  END AS points,
  (m.status = 'FINISHED' AND p.pred_home = m.home_score AND p.pred_away = m.away_score) AS is_exact,
  (m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
    AND sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)) AS is_correct_result
FROM public.predictions p
JOIN public.matches m ON m.id = p.match_id;

-- 4) Rewrite emit_match_finished_activities to use the same scoring shape.
CREATE OR REPLACE FUNCTION public.emit_match_finished_activities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'FINISHED'
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM 'FINISHED'
       OR OLD.home_score IS DISTINCT FROM NEW.home_score
       OR OLD.away_score IS DISTINCT FROM NEW.away_score
       OR OLD.is_knockout IS DISTINCT FROM NEW.is_knockout
       OR OLD.advanced_side IS DISTINCT FROM NEW.advanced_side
     )
  THEN
    DELETE FROM public.feed_activities WHERE match_id = NEW.id AND kind = 'points_awarded';
    INSERT INTO public.feed_activities (kind, actor_id, match_id, pred_home, pred_away, home_score, away_score, points, is_exact, is_correct_result)
    SELECT
      'points_awarded',
      p.player_id, p.match_id, p.pred_home, p.pred_away, NEW.home_score, NEW.away_score,
      CASE
        WHEN NOT NEW.is_knockout THEN
            (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision) THEN 3 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score THEN 1 ELSE 0 END)
          + (CASE WHEN p.pred_away = NEW.away_score THEN 1 ELSE 0 END)
          + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision)
                  AND (p.pred_home - p.pred_away) = (NEW.home_score - NEW.away_score)
                  AND (NEW.home_score - NEW.away_score) <> 0 THEN 1 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score THEN 2 ELSE 0 END)
        ELSE
            (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision) THEN 3 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score THEN 2 ELSE 0 END)
          + (CASE WHEN p.pred_away = NEW.away_score THEN 2 ELSE 0 END)
          + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision)
                  AND (p.pred_home - p.pred_away) = (NEW.home_score - NEW.away_score)
                  AND (NEW.home_score - NEW.away_score) <> 0 THEN 2 ELSE 0 END)
          + (CASE
               WHEN NEW.advanced_side IS NULL THEN 0
               WHEN p.pred_home > p.pred_away AND NEW.advanced_side = 'home' THEN 4
               WHEN p.pred_home < p.pred_away AND NEW.advanced_side = 'away' THEN 4
               WHEN p.pred_home = p.pred_away AND p.advance_pick = NEW.advanced_side THEN 4
               ELSE 0
             END)
          + (CASE WHEN p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score THEN 2 ELSE 0 END)
      END,
      (p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score),
      (sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision))
    FROM public.predictions p
    WHERE p.match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
