CREATE OR REPLACE FUNCTION public.emit_match_finished_activities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  existing_count int;
  matching_count int;
  pred_count int;
BEGIN
  IF NEW.status = 'FINISHED'
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM 'FINISHED'
       OR OLD.home_score IS DISTINCT FROM NEW.home_score
       OR OLD.away_score IS DISTINCT FROM NEW.away_score
     )
  THEN
    -- Idempotency guard: if existing points_awarded rows for this match
    -- already reflect the same scores for every prediction, do nothing.
    -- Prevents notification/feed spam when the upstream score "flaps" and
    -- comes back to the same value.
    SELECT COUNT(*) INTO pred_count
      FROM public.predictions p WHERE p.match_id = NEW.id;

    SELECT COUNT(*) INTO existing_count
      FROM public.feed_activities f
      WHERE f.match_id = NEW.id AND f.kind = 'points_awarded';

    SELECT COUNT(*) INTO matching_count
      FROM public.feed_activities f
      WHERE f.match_id = NEW.id
        AND f.kind = 'points_awarded'
        AND f.home_score = NEW.home_score
        AND f.away_score = NEW.away_score;

    IF existing_count = pred_count AND matching_count = existing_count AND existing_count > 0 THEN
      RETURN NEW;
    END IF;

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