CREATE OR REPLACE VIEW public.leaderboard AS
SELECT pl.id AS player_id,
       pl.display_name,
       pl.avatar,
       pl.created_at,
       count(pp.id) AS predictions_made,
       count(*) FILTER (WHERE pp.is_correct_result) AS correct_results,
       count(*) FILTER (WHERE pp.is_exact) AS exact_scores,
       COALESCE(sum(pp.points), 0::bigint) AS total_points
FROM public.players pl
LEFT JOIN public.prediction_points pp ON pp.player_id = pl.id
GROUP BY pl.id, pl.display_name, pl.avatar, pl.created_at;

GRANT SELECT ON public.leaderboard TO anon, authenticated;