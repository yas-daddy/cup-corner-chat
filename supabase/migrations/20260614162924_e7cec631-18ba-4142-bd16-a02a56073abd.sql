
CREATE OR REPLACE VIEW public.prediction_points AS
SELECT p.id,
       p.player_id,
       p.match_id,
       p.pred_home,
       p.pred_away,
       m.home_score,
       m.away_score,
       m.status,
       CASE
         WHEN m.status <> 'FINISHED' OR m.home_score IS NULL OR m.away_score IS NULL THEN 0
         WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 10
         ELSE
           (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN 5 ELSE 0 END)
           + (CASE WHEN p.pred_home = m.home_score THEN 1 ELSE 0 END)
           + (CASE WHEN p.pred_away = m.away_score THEN 1 ELSE 0 END)
           + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)
                    AND (p.pred_home - p.pred_away) = (m.home_score - m.away_score) THEN 3 ELSE 0 END)
       END AS points,
       CASE
         WHEN m.status = 'FINISHED' AND p.pred_home = m.home_score AND p.pred_away = m.away_score THEN true
         ELSE false
       END AS is_exact,
       CASE
         WHEN m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
              AND sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision) THEN true
         ELSE false
       END AS is_correct_result
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
        WHEN p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score THEN 10
        ELSE
          (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision) THEN 5 ELSE 0 END)
          + (CASE WHEN p.pred_home = NEW.home_score THEN 1 ELSE 0 END)
          + (CASE WHEN p.pred_away = NEW.away_score THEN 1 ELSE 0 END)
          + (CASE WHEN sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision)
                   AND (p.pred_home - p.pred_away) = (NEW.home_score - NEW.away_score) THEN 3 ELSE 0 END)
      END,
      (p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score),
      (sign((p.pred_home - p.pred_away)::double precision) = sign((NEW.home_score - NEW.away_score)::double precision))
    FROM public.predictions p WHERE p.match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
