
CREATE OR REPLACE VIEW public.prediction_points AS
SELECT p.id, p.player_id, p.match_id, p.pred_home, p.pred_away,
       m.home_score, m.away_score, m.status,
       CASE
         WHEN m.status <> 'FINISHED' OR m.home_score IS NULL OR m.away_score IS NULL THEN 0
         WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 8
         ELSE
             (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 3 ELSE 0 END)
           + (CASE WHEN p.pred_home = m.home_score THEN 1 ELSE 0 END)
           + (CASE WHEN p.pred_away = m.away_score THEN 1 ELSE 0 END)
           + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
                    AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score)
                    AND (m.home_score - m.away_score) <> 0 THEN 1 ELSE 0 END)
       END AS points,
       (m.status = 'FINISHED' AND p.pred_home = m.home_score AND p.pred_away = m.away_score) AS is_exact,
       (m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
         AND sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)) AS is_correct_result
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id;

CREATE OR REPLACE FUNCTION public.emit_match_finished_activities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'FINISHED'
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM 'FINISHED'
       OR OLD.home_score IS DISTINCT FROM NEW.home_score
       OR OLD.away_score IS DISTINCT FROM NEW.away_score
     )
  THEN
    DELETE FROM public.feed_activities WHERE match_id = NEW.id AND kind = 'points_awarded';
    INSERT INTO public.feed_activities (kind, actor_id, match_id, pred_home, pred_away, home_score, away_score, points, is_exact, is_correct_result)
    SELECT
      'points_awarded',
      p.player_id, p.match_id, p.pred_home, p.pred_away, NEW.home_score, NEW.away_score,
      CASE
        WHEN p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score THEN 8
        ELSE
            (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision) THEN 3 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score THEN 1 ELSE 0 END)
          + (CASE WHEN p.pred_away = NEW.away_score THEN 1 ELSE 0 END)
          + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision)
                   AND (p.pred_home - p.pred_away) = (NEW.home_score - NEW.away_score)
                   AND (NEW.home_score - NEW.away_score) <> 0 THEN 1 ELSE 0 END)
      END,
      (p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score),
      (sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision))
    FROM public.predictions p WHERE p.match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Re-emit points_awarded rows for already-finished matches with new scoring
DELETE FROM public.feed_activities WHERE kind = 'points_awarded';
INSERT INTO public.feed_activities (kind, actor_id, match_id, pred_home, pred_away, home_score, away_score, points, is_exact, is_correct_result)
SELECT 'points_awarded', p.player_id, p.match_id, p.pred_home, p.pred_away, m.home_score, m.away_score,
       CASE
         WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 8
         ELSE
             (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 3 ELSE 0 END)
           + (CASE WHEN p.pred_home = m.home_score THEN 1 ELSE 0 END)
           + (CASE WHEN p.pred_away = m.away_score THEN 1 ELSE 0 END)
           + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
                    AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score)
                    AND (m.home_score - m.away_score) <> 0 THEN 1 ELSE 0 END)
       END,
       (p.pred_home = m.home_score AND p.pred_away = m.away_score),
       (sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision))
  FROM public.predictions p
  JOIN public.matches m ON m.id = p.match_id
 WHERE m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL;
