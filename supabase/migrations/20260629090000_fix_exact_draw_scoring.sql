-- Fix: exact draw predictions were losing the goal-difference bonus.
--
-- The 28-Jun rewrite made the scoring purely additive. The GD term keeps a
-- guard "AND (home - away) <> 0" to avoid rewarding a trivially-correct GD on
-- non-exact draw picks. But that guard also fires on exact draw picks, so a
-- predicted 1-1 for a 1-1 was 3+1+1+0+2 = 7 instead of 8 (group), and 3+2+2+0
-- +[advance]+2 = 13 or 9 instead of 15/11 (knockout).
--
-- Fix: allow the GD bonus through when the prediction is exact. The rule
-- becomes "GD bonus applies on non-draws OR exact predictions".

CREATE OR REPLACE VIEW public.prediction_points AS
SELECT
  p.id, p.player_id, p.match_id, p.pred_home, p.pred_away, p.advance_pick,
  m.home_score, m.away_score, m.status, m.is_knockout, m.advanced_side,
  CASE
    WHEN m.status <> 'FINISHED' OR m.home_score IS NULL OR m.away_score IS NULL THEN 0
    WHEN NOT m.is_knockout THEN
        (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 3 ELSE 0 END)
      + (CASE WHEN p.pred_home = m.home_score THEN 1 ELSE 0 END)
      + (CASE WHEN p.pred_away = m.away_score THEN 1 ELSE 0 END)
      + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
              AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score)
              AND ((m.home_score - m.away_score) <> 0
                   OR (p.pred_home = m.home_score AND p.pred_away = m.away_score))
              THEN 1 ELSE 0 END)
      + (CASE WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 2 ELSE 0 END)
    ELSE
        (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 3 ELSE 0 END)
      + (CASE WHEN p.pred_home = m.home_score THEN 2 ELSE 0 END)
      + (CASE WHEN p.pred_away = m.away_score THEN 2 ELSE 0 END)
      + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
              AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score)
              AND ((m.home_score - m.away_score) <> 0
                   OR (p.pred_home = m.home_score AND p.pred_away = m.away_score))
              THEN 2 ELSE 0 END)
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

-- Same fix in the trigger function that writes feed_activities.points.
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
                  AND ((NEW.home_score - NEW.away_score) <> 0
                       OR (p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score))
                  THEN 1 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score THEN 2 ELSE 0 END)
        ELSE
            (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision) THEN 3 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score THEN 2 ELSE 0 END)
          + (CASE WHEN p.pred_away = NEW.away_score THEN 2 ELSE 0 END)
          + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision)
                  AND (p.pred_home - p.pred_away) = (NEW.home_score - NEW.away_score)
                  AND ((NEW.home_score - NEW.away_score) <> 0
                       OR (p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score))
                  THEN 2 ELSE 0 END)
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

-- Retroactive: bump feed_activities.points for any exact-draw row that landed
-- on a known buggy value. Targets specific values (7 for group, 9 or 13 for
-- knockout) so re-running this migration is a no-op — anything already at
-- the correct 8/11/15 falls outside the IN clause.
UPDATE public.feed_activities fa
SET points = fa.points + (CASE WHEN m.is_knockout THEN 2 ELSE 1 END)
FROM public.matches m
WHERE fa.match_id = m.id
  AND fa.kind = 'points_awarded'
  AND fa.is_exact = true
  AND fa.home_score = fa.away_score
  AND (
    (NOT m.is_knockout AND fa.points = 7)
    OR (m.is_knockout AND fa.points IN (9, 13))
  );
