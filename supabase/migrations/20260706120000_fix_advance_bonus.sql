-- Fix: knockout advance (+4) bonus was skipped whenever matches.advanced_side
-- was NULL, even for regular-time results where the winner is obvious.
--
-- advanced_side is derived from ESPN's per-competitor `winner` flag, which is
-- frequently absent (regular-time results, seed/demo data, sync timing). The
-- old advance CASE gated entirely on advanced_side, so e.g. Argentina 3-2 Cape
-- Verde awarded a correct win prediction only +3 (direction) and dropped the
-- +4 advance bonus — the winner plainly WAS the advancer.
--
-- Fix: use an "effective advanced side" = COALESCE(advanced_side, side derived
-- from the scoreline). For a non-drawn result the advancer is unambiguous from
-- the score; advanced_side is only strictly needed to break a tied scoreline
-- (penalty shootout), where it still takes precedence. All other scoring terms
-- (direction / home / away / GD-with-exact-draw allowance / exact) are carried
-- over unchanged from 20260629090000.

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
           WHEN p.pred_home > p.pred_away
                AND COALESCE(m.advanced_side, CASE WHEN m.home_score > m.away_score THEN 'home' WHEN m.away_score > m.home_score THEN 'away' END) = 'home' THEN 4
           WHEN p.pred_home < p.pred_away
                AND COALESCE(m.advanced_side, CASE WHEN m.home_score > m.away_score THEN 'home' WHEN m.away_score > m.home_score THEN 'away' END) = 'away' THEN 4
           WHEN p.pred_home = p.pred_away
                AND p.advance_pick = COALESCE(m.advanced_side, CASE WHEN m.home_score > m.away_score THEN 'home' WHEN m.away_score > m.home_score THEN 'away' END) THEN 4
           ELSE 0
         END)
      + (CASE WHEN p.pred_home = m.home_score AND p.pred_away = m.away_score THEN 2 ELSE 0 END)
  END AS points,
  (m.status = 'FINISHED' AND p.pred_home = m.home_score AND p.pred_away = m.away_score) AS is_exact,
  (m.status = 'FINISHED' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
    AND sign((p.pred_home - p.pred_away)::double precision) = sign((m.home_score - m.away_score)::double precision)) AS is_correct_result
FROM public.predictions p
JOIN public.matches m ON m.id = p.match_id;

-- Same effective-advanced-side fix in the trigger that snapshots
-- feed_activities.points at match finish.
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
               WHEN p.pred_home > p.pred_away
                    AND COALESCE(NEW.advanced_side, CASE WHEN NEW.home_score > NEW.away_score THEN 'home' WHEN NEW.away_score > NEW.home_score THEN 'away' END) = 'home' THEN 4
               WHEN p.pred_home < p.pred_away
                    AND COALESCE(NEW.advanced_side, CASE WHEN NEW.home_score > NEW.away_score THEN 'home' WHEN NEW.away_score > NEW.home_score THEN 'away' END) = 'away' THEN 4
               WHEN p.pred_home = p.pred_away
                    AND p.advance_pick = COALESCE(NEW.advanced_side, CASE WHEN NEW.home_score > NEW.away_score THEN 'home' WHEN NEW.away_score > NEW.home_score THEN 'away' END) THEN 4
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

-- Retroactive: resync feed_activities.points to the corrected view for every
-- already-emitted row. Joining to the (now-fixed) prediction_points view makes
-- this exact and idempotent — only rows whose stored points differ are touched,
-- so re-running is a no-op. is_exact / is_correct_result are unaffected by this
-- fix and so are left as-is.
UPDATE public.feed_activities fa
SET points = pp.points
FROM public.prediction_points pp
WHERE fa.kind = 'points_awarded'
  AND fa.match_id = pp.match_id
  AND fa.actor_id = pp.player_id
  AND fa.points IS DISTINCT FROM pp.points;
