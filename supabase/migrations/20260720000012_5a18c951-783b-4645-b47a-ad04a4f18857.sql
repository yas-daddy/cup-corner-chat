
-- Champion bonus: award 25 points to players whose champion pick matches the tournament winner.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS champion_team_code text;

UPDATE public.app_settings SET champion_team_code = 'ES' WHERE id = true;

CREATE OR REPLACE FUNCTION public.admin_set_champion_result(_team_code text)
RETURNS public.app_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.app_settings;
BEGIN
  UPDATE public.app_settings
    SET champion_team_code = NULLIF(_team_code, ''),
        updated_at = now()
    WHERE id = true
  RETURNING * INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_champion_result(text) TO anon, authenticated;

-- Rebuild leaderboard view to include +25 champion bonus.
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
SELECT
  pl.id AS player_id,
  pl.display_name,
  pl.avatar,
  pl.created_at,
  count(pp.id) AS predictions_made,
  count(*) FILTER (WHERE pp.is_correct_result) AS correct_results,
  count(*) FILTER (WHERE pp.is_exact) AS exact_scores,
  COALESCE(sum(pp.points), 0::bigint)
    + COALESCE((
        SELECT 25
        FROM public.champion_predictions cp, public.app_settings s
        WHERE cp.player_id = pl.id
          AND s.id = true
          AND s.champion_team_code IS NOT NULL
          AND cp.team_code = s.champion_team_code
      ), 0) AS total_points
FROM public.players pl
LEFT JOIN public.prediction_points pp ON pp.player_id = pl.id
GROUP BY pl.id, pl.display_name, pl.avatar, pl.created_at;

GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT ALL  ON public.leaderboard TO service_role;

-- Emit a points_awarded feed activity (25 pts) for each winning champion picker,
-- so it shows in the feed and fires the result notification. Idempotent via NOT EXISTS.
INSERT INTO public.feed_activities (kind, actor_id, match_id, points, body)
SELECT 'points_awarded', cp.player_id, NULL, 25,
       'Champion bonus: ' || cp.team || ' 🏆 +25'
FROM public.champion_predictions cp, public.app_settings s
WHERE s.id = true
  AND s.champion_team_code IS NOT NULL
  AND cp.team_code = s.champion_team_code
  AND NOT EXISTS (
    SELECT 1 FROM public.feed_activities fa
    WHERE fa.actor_id = cp.player_id
      AND fa.kind = 'points_awarded'
      AND fa.match_id IS NULL
      AND fa.points = 25
  );
